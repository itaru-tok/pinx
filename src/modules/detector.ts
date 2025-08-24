export interface TweetInfo {
  id?: string;
  url?: string;
  text?: string;
  authorHandle?: string;
  authorName?: string;
  element: Element;
}

export class TweetDetector {
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
    
    console.log(`[XBookmark] Following tab check - Selected: ${isSelected}, HasActiveStyle: ${hasActiveStyle}`);
    
    return isSelected || hasActiveStyle;
  }
  
  public async switchToFollowingTab(): Promise<boolean> {
    // Find all tab links
    const tabs = document.querySelectorAll('a[href="/home"][role="tab"]');
    if (tabs.length < 2) {
      console.log('[XBookmark] Following tab not found');
      return false;
    }
    
    // The Following tab is usually the second tab
    const followingTab = tabs[1] as HTMLElement;
    
    // Check if already on Following tab
    if (this.isFollowingTabActive()) {
      console.log('[XBookmark] Already on Following tab');
      return true;
    }
    
    // Click the Following tab
    console.log('[XBookmark] Switching to Following tab');
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
          element: article
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

  public findTweetById(id: string): Element | null {
    const links = document.querySelectorAll(`a[href*="/status/${id}"]`);
    for (const link of links) {
      const article = link.closest('article[data-testid="tweet"]');
      if (article) return article;
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
    console.log(`[XBookmark] Loading check - NearBottom: ${nearBottom}, HasLoader: ${hasLoader}, ScrollBottom: ${scrollBottom}, DocHeight: ${documentHeight}`);
    
    // Return true if we have any loader, regardless of position (X sometimes loads in the middle)
    return hasLoader || nearBottom;
  }

  private async waitForNewTweetsToLoad(timeout = 5000): Promise<boolean> {
    const startTime = Date.now();
    const initialTweetCount = document.querySelectorAll('article[data-testid="tweet"]').length;
    let wasLoading = false;
    let previousHeight = document.documentElement.scrollHeight;
    
    console.log(`[XBookmark] Waiting for new tweets to load. Initial count: ${initialTweetCount}`);
    
    while (Date.now() - startTime < timeout) {
      const isCurrentlyLoading = this.isLoadingMore();
      const currentHeight = document.documentElement.scrollHeight;
      
      // Track if we see loading state
      if (isCurrentlyLoading) {
        wasLoading = true;
      }
      
      // Check multiple conditions for new content
      const currentTweetCount = document.querySelectorAll('article[data-testid="tweet"]').length;
      const heightChanged = currentHeight > previousHeight;
      const tweetsAdded = currentTweetCount > initialTweetCount;
      
      // If we were loading and now we're not, or if content changed
      if ((wasLoading && !isCurrentlyLoading) || heightChanged || tweetsAdded) {
        if (tweetsAdded || heightChanged) {
          console.log(`[XBookmark] New content detected! Tweets: ${initialTweetCount} -> ${currentTweetCount}, Height: ${previousHeight} -> ${currentHeight}`);
          await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for DOM to settle
          return true;
        }
      }
      
      previousHeight = currentHeight;
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log('[XBookmark] Timeout waiting for new tweets');
    return false;
  }

  public async waitForTweet(id: string, savedScrollPosition?: number, maxAttempts = 50): Promise<Element | null> {
    console.log(`[XBookmark] Starting search for tweet ${id}`);
    
    // First check if tweet is already loaded
    let tweet = this.findTweetById(id);
    if (tweet) {
      console.log('[XBookmark] Tweet found immediately');
      return tweet;
    }
    
    // If we have a saved scroll position, try to get close to it first
    if (savedScrollPosition !== undefined) {
      const currentScroll = window.scrollY;
      const distance = Math.abs(currentScroll - savedScrollPosition);
      
      // If we're far from the saved position, jump closer first
      if (distance > window.innerHeight * 3) {
        console.log(`[XBookmark] Large distance detected (${distance}px), jumping to saved position`);
        
        // For very deep positions, do progressive jumps
        if (distance > window.innerHeight * 10) {
          // Jump in stages to trigger loading
          const jumpStages = 5; // More stages for better loading
          const stageDistance = (savedScrollPosition - currentScroll) / jumpStages;
          
          for (let i = 1; i <= jumpStages; i++) {
            const targetScroll = currentScroll + (stageDistance * i);
            window.scrollTo({
              top: targetScroll,
              behavior: 'auto'
            });
            console.log(`[XBookmark] Jump stage ${i}/${jumpStages}, position: ${targetScroll}`);
            
            // Always wait for potential loading after each jump
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Check if tweet appeared
            tweet = this.findTweetById(id);
            if (tweet) {
              console.log(`[XBookmark] Tweet found after jump stage ${i}`);
              return tweet;
            }
            
            // Check for loading and wait longer if needed
            if (this.isLoadingMore() || i === jumpStages) {
              console.log('[XBookmark] Loading detected or final stage, waiting for tweets...');
              const loaded = await this.waitForNewTweetsToLoad(10000); // More time
              if (loaded) {
                // Check again after loading
                tweet = this.findTweetById(id);
                if (tweet) return tweet;
              }
            }
          }
        } else {
          // Single jump for moderate distances
          window.scrollTo({
            top: savedScrollPosition,
            behavior: 'auto'
          });
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check again after jumping
          tweet = this.findTweetById(id);
          if (tweet) return tweet;
        }
      }
    }
    
    // Now search in the most logical direction
    // If we have a saved position and we're past it, search upward
    // Otherwise, always search downward (more common case)
    const searchDirection = savedScrollPosition !== undefined && window.scrollY > savedScrollPosition ? 'up' : 'down';
    
    console.log(`[XBookmark] Searching ${searchDirection} for tweet`);
    
    // Only search in one direction
    const directions = [searchDirection];
    
    for (const direction of directions) {
      let attemptCount = 0;
      let noProgressCount = 0;
      
      while (attemptCount < maxAttempts) {
        attemptCount++;
        
        // Record current position
        const beforeScroll = window.scrollY;
        
        // Scroll in the current direction
        // Use larger scroll amounts for faster searching
        const scrollAmount = window.innerHeight * 1.5 * (direction === 'up' ? -1 : 1);
        window.scrollBy(0, scrollAmount);
        
        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Check if tweet appeared
        tweet = this.findTweetById(id);
        if (tweet) return tweet;
        
        // Check if we made progress
        const afterScroll = window.scrollY;
        if (Math.abs(afterScroll - beforeScroll) < 10) {
          noProgressCount++;
          
          // If we're stuck and going down, check for loading state
          if (direction === 'down' && noProgressCount >= 2) {
            // Check if we're at a loading point
            const isLoading = this.isLoadingMore();
            console.log(`[XBookmark] No progress count: ${noProgressCount}, Loading: ${isLoading}`);
            
            if (isLoading || noProgressCount >= 2) {
              // Force scroll to bottom to trigger loading
              const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
              window.scrollTo(0, maxScroll);
              console.log('[XBookmark] Forced scroll to bottom to trigger loading');
              
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Small scroll to trigger loading
              window.scrollBy(0, 10);
              await new Promise(resolve => setTimeout(resolve, 500));
              
              console.log('[XBookmark] Loading detected, waiting for new tweets...');
              const tweetsBefore = document.querySelectorAll('article[data-testid="tweet"]').length;
              const loaded = await this.waitForNewTweetsToLoad(10000); // Give more time
              const tweetsAfter = document.querySelectorAll('article[data-testid="tweet"]').length;
              
              if (loaded) {
                console.log(`[XBookmark] New tweets loaded! Before: ${tweetsBefore}, After: ${tweetsAfter}`);
                noProgressCount = 0; // Reset counter
                
                // After loading, check if we found the tweet
                tweet = this.findTweetById(id);
                if (tweet) {
                  console.log('[XBookmark] Found tweet after loading!');
                  return tweet;
                }
                continue;
              } else {
                console.log('[XBookmark] No new tweets loaded after waiting');
              }
            }
            
            // If still no progress after waiting, we're truly at the end
            if (noProgressCount >= 3) {
              console.log('Reached the end of timeline');
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
    
    return null;
  }
}