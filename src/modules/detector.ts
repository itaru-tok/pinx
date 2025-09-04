export interface TweetInfo {
  id?: string;
  url?: string;
  text?: string;
  authorHandle?: string;
  authorName?: string;
  timestamp?: string;
  element: Element;
  isRepost?: boolean;
  hasSocialContext?: boolean;
  isPromoted?: boolean;
}

export class TweetDetector {
  private searchCancelled = false;

  public cancelSearch(): void {
    this.searchCancelled = true;
  }

  public wasSearchCancelled(): boolean {
    return this.searchCancelled;
  }

  public isFollowingTabActive(): boolean {
    // Check if we're on the home page
    if (window.location.pathname !== '/home') {
      return false;
    }
    
    // Find all tab links
    const tabs = document.querySelectorAll('a[href="/home"][role="tab"]');
    if (tabs.length < 2) return false;
    
    // The Following tab is usually the second tab
    const followingTab = tabs[1];
    if (!followingTab) return false;
    
    // Check if it has aria-selected="true"
    const isSelected = followingTab.getAttribute('aria-selected') === 'true';
    
    // Alternative check: look for the active underline (blue bar)
    const hasActiveStyle = followingTab.querySelector('div[dir="ltr"] > div[style*="rgb(29, 155, 240)"]') !== null;
    
    return isSelected || hasActiveStyle;
  }
  
  public async switchToFollowingTab(): Promise<boolean> {
    // Find all tab links
    const tabs = document.querySelectorAll('a[href="/home"][role="tab"]');
    if (tabs.length < 2) {
      return false;
    }
    
    // The Following tab is usually the second tab
    const followingTab = tabs[1] as HTMLElement;
    
    // Check if already on Following tab
    if (this.isFollowingTabActive()) {
      return true;
    }
    
    // Click the Following tab
    followingTab.click();
    
    // Wait for the tab to load
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return this.isFollowingTabActive();
  }
  private getTweetId(article: Element): string | undefined {
    const link = article.querySelector('a[href*="/status/"]');
    if (link) {
      const match = link.getAttribute('href')?.match(/\/status\/(\d+)/);
      return match?.[1];
    }
    return undefined;
  }

  private getTweetUrl(article: Element): string | undefined {
    const link = article.querySelector('a[href*="/status/"]');
    return link ? `https://x.com${link.getAttribute('href')}` : undefined;
  }

  private getTweetText(article: Element): string | undefined {
    const textElement = article.querySelector('[data-testid="tweetText"]');
    return textElement?.textContent?.slice(0, 100) || undefined;
  }

  private getAuthorHandle(article: Element): string | undefined {
    const handleElement = article.querySelector('a[href^="/"][role="link"] > div > span');
    return handleElement?.textContent || undefined;
  }

  private getAuthorName(article: Element): string | undefined {
    // Look for display name (usually appears before the handle)
    const nameElement = article.querySelector('[data-testid="User-Name"] span:not([dir])');
    return nameElement?.textContent || undefined;
  }

  private getTweetTimestamp(article: Element): string | undefined {
    // Look for the time element in the tweet
    const timeElement = article.querySelector('time');
    return timeElement?.textContent || undefined;
  }

  private hasSocialContext(article: Element): boolean {
    return !!article.querySelector('[data-testid="socialContext"]');
  }

  private isPromoted(article: Element): boolean {
    const text = article.textContent?.toLowerCase() || '';
    const badge = article.querySelector('[data-testid="placementTracking"], [aria-label*="Promoted" i]');
    const keywordLikely = /(promoted|advert|sponsored|プロモーション|広告)/.test(text);
    return !!badge || keywordLikely;
  }

  private isRepost(article: Element): boolean {
    // Heuristic: if a social context exists AND contains a repost/retweet icon or keyword
    const social = article.querySelector('[data-testid="socialContext"]');
    if (!social) return false;
    const text = social.textContent?.toLowerCase() || '';
    const hasIcon = !!social.querySelector('svg');
    // Best-effort keyword check; may be localized, so we also rely on icon presence
    const keywordLikely = /(repost|retweet|retweeted)/.test(text);
    return keywordLikely || hasIcon;
  }

  public getVisibleTweets(): TweetInfo[] {
    const articles = document.querySelectorAll('article[data-testid="tweet"]');
    const tweets: TweetInfo[] = [];
    
    const viewportHeight = window.innerHeight;
    
    Array.from(articles).forEach(article => {
      const rect = article.getBoundingClientRect();
      
      // Check if tweet is visible in viewport
      if (rect.top < viewportHeight && rect.bottom > 0) {
        tweets.push({
          id: this.getTweetId(article),
          url: this.getTweetUrl(article),
          text: this.getTweetText(article),
          authorHandle: this.getAuthorHandle(article),
          authorName: this.getAuthorName(article),
          timestamp: this.getTweetTimestamp(article),
          element: article,
          isRepost: this.isRepost(article),
          hasSocialContext: this.hasSocialContext(article),
          isPromoted: this.isPromoted(article)
        });
      }
    });
    
    return tweets.sort((a, b) => {
      const rectA = a.element.getBoundingClientRect();
      const rectB = b.element.getBoundingClientRect();
      return rectA.top - rectB.top;
    });
  }

  public getTopVisibleTweet(): TweetInfo | null {
    const tweets = this.getVisibleTweets();
    // Find the tweet that's closest to the top of the viewport
    // but with at least 50px visible to ensure it's meaningful
    for (const tweet of tweets) {
      const rect = tweet.element.getBoundingClientRect();
      if (rect.top >= -50 && rect.top <= 100) {
        return tweet;
      }
    }
    return tweets.length > 0 ? tweets[0] : null;
  }
  
  public getTopVisibleTweetWithContext(): { 
    tweet: TweetInfo | null; 
    context: { before?: TweetInfo; after?: TweetInfo } 
  } {
    const tweets = this.getVisibleTweets();
    let targetIndex = -1;
    
    // Find the main tweet
    for (let i = 0; i < tweets.length; i++) {
      const rect = tweets[i].element.getBoundingClientRect();
      if (rect.top >= -50 && rect.top <= 100) {
        targetIndex = i;
        break;
      }
    }
    
    if (targetIndex === -1 && tweets.length > 0) {
      targetIndex = 0;
    }
    
    if (targetIndex === -1) {
      return { tweet: null, context: {} };
    }
    
    return {
      tweet: tweets[targetIndex],
      context: {
        before: targetIndex > 0 ? tweets[targetIndex - 1] : undefined,
        after: targetIndex < tweets.length - 1 ? tweets[targetIndex + 1] : undefined
      }
    };
  }

  public findTweetById(id: string, preferWithContext?: boolean): Element | null {
    const links = document.querySelectorAll(`a[href*="/status/${id}"]`);
    const candidates: Element[] = [];
    const withContext: Element[] = [];
    for (const link of links) {
      const article = link.closest('article[data-testid="tweet"]');
      if (article) {
        if (this.hasSocialContext(article)) withContext.push(article);
        else candidates.push(article);
      }
    }
    // Respect preference if provided
    if (preferWithContext === true) {
      if (withContext.length > 0) return withContext[0];
      if (candidates.length > 0) return candidates[0];
    } else {
      // Default: prefer original (no social context)
      if (candidates.length > 0) return candidates[0];
      if (withContext.length > 0) return withContext[0];
    }
    return null;
  }

  private isLoadingMore(): boolean {
    // Check for various loading indicators
    // 1. Progress bar spinner
    const loadingSpinner = document.querySelector('[role="progressbar"]');
    
    // 2. Loading cell at the bottom
    const loadingCell = document.querySelector('[data-testid="cellInnerDiv"] [role="progressbar"]');
    
    // 3. Shimmer/placeholder elements
    const shimmer = document.querySelector('[data-testid="placeholder"]');
    
    // 4. Check for "Loading" text in timeline
    const loadingText = Array.from(document.querySelectorAll('span')).find(
      span => span.textContent?.toLowerCase().includes('loading')
    );
    
    // 5. Check for timeline spinner (new Twitter/X loading indicator)
    const timelineSpinner = document.querySelector('[data-testid="TimelineLoadingSpinner"]');
    
    // 6. Check if we're near the bottom (where loading happens)
    const scrollBottom = window.scrollY + window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const nearBottom = documentHeight - scrollBottom < 1000;
    
    const hasLoader = !!(loadingSpinner || loadingCell || shimmer || loadingText || timelineSpinner);
    
    // Return true if we have any loader, regardless of position (X sometimes loads in the middle)
    return hasLoader || nearBottom;
  }

  private waitForDOMChanges(): Promise<void> {
    return new Promise((resolve) => {
      // Use requestAnimationFrame for better performance
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
  }

  private async waitForNewTweetsToLoad(timeout = 3000): Promise<boolean> {
    const startTime = Date.now();
    const initialTweetCount = document.querySelectorAll('article[data-testid="tweet"]').length;
    const initialHeight = document.documentElement.scrollHeight;
    
    // Create a MutationObserver to detect DOM changes
    return new Promise((resolve) => {
      let resolved = false;
      
      const observer = new MutationObserver(async () => {
        const currentTweetCount = document.querySelectorAll('article[data-testid="tweet"]').length;
        const currentHeight = document.documentElement.scrollHeight;
        
        if (currentTweetCount > initialTweetCount || currentHeight > initialHeight) {
          if (!resolved) {
            resolved = true;
            observer.disconnect();
            await this.waitForDOMChanges();
            resolve(true);
          }
        }
      });
      
      // Start observing
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      // Timeout fallback
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          observer.disconnect();
          resolve(false);
        }
      }, timeout);
    });
  }

  public async waitForTweet(
    id: string,
    savedScrollPosition?: number,
    onProgress?: (message: string) => void,
    preferWithContext?: boolean
  ): Promise<{ element: Element | null; timedOut?: boolean }> {
    this.searchCancelled = false;
    const startTime = Date.now();
    const MAX_SEARCH_TIME = 90000; // 1.5 minutes for deeper loads
    const MAX_SEARCH_SECONDS = Math.round(MAX_SEARCH_TIME / 1000);
    let timedOut = false;
    
    // First check if tweet is already loaded
    let tweet = this.findTweetById(id, preferWithContext);
    if (tweet) {
      return { element: tweet };
    }
    
    // If we have a saved scroll position, try to get close to it first
    if (savedScrollPosition !== undefined) {
      const currentScroll = window.scrollY;
      const distance = Math.abs(currentScroll - savedScrollPosition);
      
      // If we're far from the saved position, jump closer first
      if (distance > window.innerHeight * 3) {
        
        // For very deep positions, do progressive jumps
        if (distance > window.innerHeight * 10) {
          // Jump in more stages for better loading
          const jumpStages = 10; // More stages to ensure loading
          const stageDistance = (savedScrollPosition - currentScroll) / jumpStages;
          
          for (let i = 1; i <= jumpStages; i++) {
            if (this.searchCancelled) {
              return { element: null };
            }
            const targetScroll = currentScroll + (stageDistance * i);
            window.scrollTo({
              top: targetScroll,
              behavior: 'auto'
            });
            if (onProgress) {
              const elapsed = Math.round((Date.now() - startTime) / 1000);
              onProgress(`Searching... (${elapsed}s / max ${MAX_SEARCH_SECONDS}s)`);
            }
            
            // Wait for content to render
            await this.waitForDOMChanges();
            
            // Check if tweet appeared
            tweet = this.findTweetById(id, preferWithContext);
            if (tweet) {
              return { element: tweet };
            }
            
            // Always wait for potential loading after each jump
            const beforeTweetCount = document.querySelectorAll('article[data-testid="tweet"]').length;
            
            // Force a small scroll to trigger loading if needed
            window.scrollBy(0, 50);
            await this.waitForDOMChanges();
            
            const loaded = await this.waitForNewTweetsToLoad(2000);
            const afterTweetCount = document.querySelectorAll('article[data-testid="tweet"]').length;
            
            if (loaded || afterTweetCount > beforeTweetCount) {
              // Check again after loading
              tweet = this.findTweetById(id);
              if (tweet) {
                return { element: tweet };
              }
            }
          }
        } else {
          // Single jump for moderate distances
          window.scrollTo({
            top: savedScrollPosition,
            behavior: 'auto'
          });
          await this.waitForDOMChanges();
          
          // Check again after jumping
          tweet = this.findTweetById(id, preferWithContext);
          if (tweet) return { element: tweet };
        }
      }
    }
    
    // Decide preferred direction first, but search both directions to be resilient
    const preferred = savedScrollPosition !== undefined && window.scrollY > savedScrollPosition ? 'up' : 'down';
    const directions: Array<'up' | 'down'> = preferred === 'down' ? ['down', 'up'] : ['up', 'down'];
    let totalAttempts = 0;
    
    // Check if we should continue searching
    const shouldContinue = () => {
      // Time limit (1 minute)
      if (Date.now() - startTime > MAX_SEARCH_TIME) {
        timedOut = true;
        return false;
      }
      
      // Check for end of timeline
      const endOfTimeline = document.querySelector('[data-testid="endOfTimelineModule"]');
      if (endOfTimeline) {
        return false;
      }
      
      // User cancelled
      if (this.searchCancelled) {
        return false;
      }
      
      return true;
    };
    
    for (const direction of directions) {
      let attemptCount = 0;
      let noProgressCount = 0;
      
      while (shouldContinue()) {
        attemptCount++;
        totalAttempts++;
        
        // Record current position
        const beforeScroll = window.scrollY;
        
        // Scroll in the current direction
        // Use smaller scroll amount for more control
        const scrollAmount = window.innerHeight * 1.2 * (direction === 'up' ? -1 : 1);
        window.scrollBy({
          top: scrollAmount,
          behavior: 'auto'
        });
        
        // Wait for DOM to stabilize using requestAnimationFrame
        await this.waitForDOMChanges();
        
        // Update progress every few attempts
        if (attemptCount % 5 === 0 && onProgress) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);
          onProgress(`Searching... (${elapsed}s / max ${MAX_SEARCH_SECONDS}s)`);
        }
        
        // Check if tweet appeared
        tweet = this.findTweetById(id, preferWithContext);
        if (tweet) return { element: tweet };
        
        // Check if we made progress
        const afterScroll = window.scrollY;
        if (Math.abs(afterScroll - beforeScroll) < 10) {
          noProgressCount++;
          
          // If we're stuck and going down, check for loading state
          if (direction === 'down' && noProgressCount >= 2) {
            // Check if we're at a loading point
            const isLoading = this.isLoadingMore();
            
            if (isLoading || noProgressCount >= 2) {
              // Force scroll to bottom to trigger loading
              const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
              window.scrollTo(0, maxScroll);
              
              await this.waitForDOMChanges();
              
              // Small scroll to trigger loading
              window.scrollBy(0, 10);
              await this.waitForDOMChanges();
              
              const tweetsBefore = document.querySelectorAll('article[data-testid="tweet"]').length;
            const loaded = await this.waitForNewTweetsToLoad(12000); // Give more time
              const tweetsAfter = document.querySelectorAll('article[data-testid="tweet"]').length;
              
              if (loaded) {
                noProgressCount = 0; // Reset counter
                
                // After loading, check if we found the tweet
                tweet = this.findTweetById(id, preferWithContext);
                if (tweet) {
                  return { element: tweet };
                }
                continue;
              }
            }
            
            // If still no progress after waiting, we're truly at the end
            if (noProgressCount >= 3) {
              break;
            }
          } else if (noProgressCount >= 3) {
            // For upward scrolling or repeated no progress
            break;
          }
        } else {
          // We made progress, reset counter
          noProgressCount = 0;
        }
      }
    }
    
    // If we have a saved position, stay near it instead of going to top
    if (savedScrollPosition !== undefined) {
      // Scroll to approximately where the tweet should have been
      window.scrollTo({
        top: savedScrollPosition,
        behavior: 'smooth'
      });
    }
    
    return { element: null, timedOut };
  }
}
