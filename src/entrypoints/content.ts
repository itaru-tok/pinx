import { TweetDetector, type TweetInfo, type WaitForTweetResult } from '../modules/detector';
import { StorageManager, SavedPosition } from '../modules/storage';
import { UIManager } from '../modules/ui';
import '../styles/content.css';

export default {
  matches: ['https://x.com/*', 'https://twitter.com/*'],
  runAt: 'document_idle',
  
  main() {
    const detector = new TweetDetector();
    const storage = new StorageManager();
    let ui: UIManager;

    // Save current position
    const savePosition = async () => {
      try {
        // Check if we're on Following tab
        if (!detector.isFollowingTabActive()) {
          ui.showToast('Please switch to Following tab', 'error');
          return;
        }
        
        const { tweet: topTweet, context } = detector.getTopVisibleTweetWithContext();
        
        if (!topTweet) {
          ui.showToast('No tweet found', 'error');
          return;
        }

        const tweetRect = topTweet.element.getBoundingClientRect();
        const position: SavedPosition = {
          tweetId: topTweet.id,
          tweetUrl: topTweet.url,
          tweetText: topTweet.text,
          authorHandle: topTweet.authorHandle,
          authorName: topTweet.authorName,
          tweetTimestamp: topTweet.timestamp,
          timestamp: Date.now(),
          scrollPosition: window.scrollY,
          tweetOffsetTop: tweetRect.top,
          pageUrl: window.location.href,
          isFollowingTab: true,
          savedHasSocialContext: (topTweet as TweetInfo).hasSocialContext === true,
          savedIsPromoted: (topTweet as TweetInfo).isPromoted === true,
          nearbyTweets: {
            before: context.before ? {
              id: context.before.id,
              handle: context.before.authorHandle,
              text: context.before.text?.slice(0, 50)
            } : undefined,
            after: context.after ? {
              id: context.after.id,
              handle: context.after.authorHandle,
              text: context.after.text?.slice(0, 50)
            } : undefined
          }
        };

        await storage.savePosition(position);
        ui.showToast('Tweet pinned', 'pinned');
        ui.updateRestoreButtonState(true, position.timestamp, position.tweetTimestamp);
      } catch (error) {
        ui.showToast('Failed to pin', 'error');
      }
    };

    // Restore saved position
    const restorePosition = async () => {
      try {
        const savedPosition = await storage.getPosition();
        
        if (!savedPosition) {
          ui.showToast('No pinned position', 'error');
          return;
        }
        
        // Switch to Following tab if saved position was on Following tab
        if (savedPosition.isFollowingTab && !detector.isFollowingTabActive()) {
          ui.showToast('Switching to Following tab...', 'info');
          const switched = await detector.switchToFollowingTab();
          if (!switched) {
            ui.showToast('Failed to switch to Following tab', 'error');
            return;
          }
          // Wait a bit more for content to load after tab switch
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // If saved item was a promoted/ad, skip exact match and use nearby positioning
        if (savedPosition.savedIsPromoted) {
          // Jump to approximate position and use context to find a nearby real tweet
          if (savedPosition.scrollPosition !== undefined) {
            window.scrollTo({ top: savedPosition.scrollPosition, behavior: 'auto' });
            await new Promise(resolve => setTimeout(resolve, 800));
          }
        } else if (savedPosition.tweetId) {
          // First, try to find the tweet if it's already loaded (respect repost preference)
          let tweetElement = detector.findTweetById(savedPosition.tweetId, savedPosition.savedHasSocialContext);
          
          // If not found, try to load it
          if (!tweetElement) {
            // Show searching UI with stop button and time ago
            ui.startSearching(() => {
              detector.cancelSearch();
            }, savedPosition.timestamp);
            
            try {
              const result: WaitForTweetResult = await detector.waitForTweet(
                savedPosition.tweetId, 
                savedPosition.scrollPosition,
                (message) => {
                  ui.updateSearchingProgress(message);
                },
                savedPosition.savedHasSocialContext
              );
              tweetElement = result.element;
              
              // Check if search timed out
              if (!tweetElement && result.timedOut) {
                ui.showToast('Time\'s up!', 'info');
                return;
              }
              // If we reached a load limit (can't load older tweets), inform and stop
              if (!tweetElement && result.noMoreLoading) {
                ui.showToast("Can't load more", 'info');
                return;
              }
            } finally {
              ui.stopSearching();
            }
            
            // Check if search was cancelled vs not found
            if (!tweetElement) {
              if (detector.wasSearchCancelled()) {
                ui.showToast('Search cancelled', 'info');
                return;
              } else if (savedPosition.scrollPosition !== undefined) {
                // Tweet not found (probably deleted), but we scrolled to saved position
                ui.showToast('Found nearby!', 'info');
                return;
              }
            }
          }

          if (tweetElement) {
            // Calculate exact position to restore
            const currentRect = tweetElement.getBoundingClientRect();
            const targetScrollY = window.scrollY + currentRect.top - (savedPosition.tweetOffsetTop || 0);
            
            window.scrollTo({
              top: targetScrollY,
              behavior: 'smooth'
            });
            ui.showToast('Found it!', 'success');
            return;
          }
        }

        // Fallback: Try to find a nearby tweet by text AND author (tighter match)
        if (savedPosition.scrollPosition !== undefined) {
          // First jump to the approximate position
          window.scrollTo({
            top: savedPosition.scrollPosition,
            behavior: 'auto'
          });
          
          // Wait for content to load
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Try to find a tweet with similar content
          if (savedPosition.authorHandle || savedPosition.authorName || savedPosition.tweetText) {
            const allTweets = detector.getVisibleTweets();
            // Choose candidate set based on whether the saved item had social context or was an ad
            const base = allTweets.filter(t => !t.isPromoted);
            const candidates = savedPosition.savedHasSocialContext ? base.filter(t => t.hasSocialContext) : base.filter(t => !t.hasSocialContext);
            
            // Try exact match first
            let similarTweet = candidates.find(tweet => 
              (savedPosition.authorHandle && tweet.authorHandle === savedPosition.authorHandle) &&
              (savedPosition.tweetText && tweet.text && savedPosition.tweetText.length >= 10 && tweet.text.includes(savedPosition.tweetText.slice(0, 50)))
            );
            
            // If not found, try to find using nearby tweet context
            if (!similarTweet && savedPosition.nearbyTweets) {
              // Look for the before/after tweets
              const beforeTweet = savedPosition.nearbyTweets.before ? 
                candidates.find(t => t.id === savedPosition.nearbyTweets!.before!.id) : null;
              const afterTweet = savedPosition.nearbyTweets.after ? 
                candidates.find(t => t.id === savedPosition.nearbyTweets!.after!.id) : null;
              
              // If we found a nearby tweet, position relative to it
              if (beforeTweet || afterTweet) {
                const referenceElement = (beforeTweet || afterTweet)!.element;
                const rect = referenceElement.getBoundingClientRect();
                const offset = beforeTweet ? window.innerHeight * 0.2 : -window.innerHeight * 0.2;
                
                window.scrollTo({
                  top: window.scrollY + rect.top + offset,
                  behavior: 'smooth'
                });
                ui.showToast('Found nearby (approximate)', 'info');
                return;
              }
            }
            
            if (similarTweet) {
              similarTweet.element.scrollIntoView({ behavior: 'smooth', block: 'start' });
              ui.showToast('Found nearby (matched content)', 'info');
              return;
            }
          }
          
          // If we get here, avoid jumping to wrong content
          ui.showToast('Pinned tweet not found (timeline shifted)', 'error');
        } else {
          ui.showToast('Tweet not found', 'error');
        }
      } catch (error) {
        ui.showToast('Failed to restore', 'error');
      }
    };

    // Initialize UI
    ui = new UIManager(savePosition, restorePosition);
    ui.init();

    // Update restore button state
    storage.hasPosition().then(hasPosition => {
      if (hasPosition) {
        storage.getPosition().then(position => {
          ui.updateRestoreButtonState(true, position?.timestamp, position?.tweetTimestamp);
        });
      } else {
        ui.updateRestoreButtonState(false);
      }
      
      // // Auto-restore on page load if position exists
      // if (hasPosition) {
      //   storage.getPosition().then(pos => {
      //     // Auto-restore if we're on home timeline
      //     if (pos && window.location.pathname === '/home') {
      //       // Wait a bit longer for initial page load
      //       setTimeout(() => {
      //         restorePosition();
      //       }, 2000);
      //     }
      //   });
      // }
    });

    // Detect theme (robust for X Default/Dim/Lights out and SPA updates)
    const detectTheme = () => {
      try {
        const parseRgb = (c: string): { r: number; g: number; b: number; a: number } | null => {
          if (!c) return null;
          if (c === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
          const m = c.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d*\.?\d+))?\)/);
          if (!m) return null;
          const r = parseInt(m[1], 10), g = parseInt(m[2], 10), b = parseInt(m[3], 10);
          const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
          return { r, g, b, a };
        };
        const parseHex = (hex: string): { r: number; g: number; b: number } | null => {
          if (!hex) return null;
          const h = hex.replace('#', '');
          if (h.length === 3) {
            const r = parseInt(h[0] + h[0], 16);
            const g = parseInt(h[1] + h[1], 16);
            const b = parseInt(h[2] + h[2], 16);
            return { r, g, b };
          }
          if (h.length === 6) {
            const r = parseInt(h.substring(0, 2), 16);
            const g = parseInt(h.substring(2, 4), 16);
            const b = parseInt(h.substring(4, 6), 16);
            return { r, g, b };
          }
          return null;
        };
        const isTransparent = (p: { r: number; g: number; b: number; a: number } | null) => !p || p.a === 0;
        const luminance = (p: { r: number; g: number; b: number }) => 0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b;

        const pickBg = (el: Element | null): { r: number; g: number; b: number; a: number } | null => {
          if (!el) return null;
          const c = getComputedStyle(el).backgroundColor;
          return parseRgb(c);
        };

        // Check meta theme-color first (X updates this per theme)
        const meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
        const metaRgb = meta?.content ? parseHex(meta.content) : null;
        if (metaRgb) {
          const metaIsDark = luminance(metaRgb) < 140;
          ui.setTheme(metaIsDark);
          return;
        }

        // Fallback: sample common containers in order
        const candidates: (Element | null)[] = [
          document.documentElement,
          document.body,
          document.querySelector('main'),
          document.getElementById('layers'),
          document.querySelector('[data-testid="primaryColumn"]'),
        ];
        let picked: { r: number; g: number; b: number; a: number } | null = null;
        for (const el of candidates) {
          const bg = pickBg(el);
          if (bg && !isTransparent(bg)) { picked = bg; break; }
        }
        // If still transparent, assume light by default to avoid forcing dark erroneously
        const isDark = picked ? luminance(picked) < 140 : (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        ui.setTheme(isDark);
      } catch {
        const prefersDark = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
        ui.setTheme(prefersDark);
      }
    };

    detectTheme();

    // Watch for theme changes
    const themeObserver = new MutationObserver(detectTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class', 'data-theme', 'data-color-mode']
    });
    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['style', 'class', 'data-theme', 'data-color-mode']
    });
    const layers = document.getElementById('layers');
    if (layers) {
      const layersObserver = new MutationObserver(detectTheme);
      layersObserver.observe(layers, { attributes: true, attributeFilter: ['style', 'class'] });
    }

    // Also react to system scheme changes
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', detectTheme);
      } else if (typeof (mq as any).addListener === 'function') {
        (mq as any).addListener(detectTheme);
      }
    } catch {}

    // Re-check shortly after load to catch SPA paints
    setTimeout(detectTheme, 500);
    setTimeout(detectTheme, 1500);
  }
};
