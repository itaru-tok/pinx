import { TweetDetector } from '../modules/detector';
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
          timestamp: Date.now(),
          scrollPosition: window.scrollY,
          tweetOffsetTop: tweetRect.top,
          pageUrl: window.location.href,
          isFollowingTab: true,
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
        ui.showToast('Position saved', 'success');
        ui.updateRestoreButtonState(true);
      } catch (error) {
        console.error('Failed to save position:', error);
        ui.showToast('Failed to save', 'error');
      }
    };

    // Restore saved position
    const restorePosition = async () => {
      try {
        const savedPosition = await storage.getPosition();
        
        if (!savedPosition) {
          ui.showToast('No saved position', 'error');
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

        // First, try to find the tweet if it's already loaded
        if (savedPosition.tweetId) {
          let tweetElement = detector.findTweetById(savedPosition.tweetId);
          
          // If not found, try to load it
          if (!tweetElement) {
            ui.showToast('Searching for tweet...', 'success');
            
            // Show debug info
            console.log(`[XBookmark] Searching for tweet: ${savedPosition.tweetId}`);
            console.log(`[XBookmark] Saved scroll position: ${savedPosition.scrollPosition}`);
            console.log(`[XBookmark] Tweet age: ${Math.round((Date.now() - savedPosition.timestamp) / (1000 * 60))} minutes`);
            
            // Show periodic updates during long searches
            let searchTime = 0;
            const searchInterval = setInterval(() => {
              searchTime += 3;
              if (searchTime < 10) {
                ui.showToast('Still searching... Loading more tweets', 'success');
              } else if (searchTime < 20) {
                ui.showToast('This is taking a while... Loading deep tweets', 'success');
              } else {
                ui.showToast('Almost there... Please wait', 'success');
              }
            }, 3000);
            
            try {
              tweetElement = await detector.waitForTweet(
                savedPosition.tweetId, 
                savedPosition.scrollPosition
              );
            } finally {
              clearInterval(searchInterval);
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
            ui.showToast('Position restored', 'success');
            return;
          }
        }

        // Fallback: Try to find a nearby tweet by text or author
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
            
            // Try exact match first
            let similarTweet = allTweets.find(tweet => 
              (savedPosition.authorHandle && tweet.authorHandle === savedPosition.authorHandle) &&
              (savedPosition.tweetText && tweet.text && tweet.text.includes(savedPosition.tweetText.slice(0, 50)))
            );
            
            // If not found, try to find using nearby tweet context
            if (!similarTweet && savedPosition.nearbyTweets) {
              // Look for the before/after tweets
              const beforeTweet = savedPosition.nearbyTweets.before ? 
                allTweets.find(t => t.id === savedPosition.nearbyTweets!.before!.id) : null;
              const afterTweet = savedPosition.nearbyTweets.after ? 
                allTweets.find(t => t.id === savedPosition.nearbyTweets!.after!.id) : null;
              
              // If we found a nearby tweet, position relative to it
              if (beforeTweet || afterTweet) {
                const referenceElement = (beforeTweet || afterTweet)!.element;
                const rect = referenceElement.getBoundingClientRect();
                const offset = beforeTweet ? window.innerHeight * 0.2 : -window.innerHeight * 0.2;
                
                window.scrollTo({
                  top: window.scrollY + rect.top + offset,
                  behavior: 'smooth'
                });
                ui.showToast('Positioned near saved location', 'success');
                return;
              }
            }
            
            // If not found, try more lenient match
            if (!similarTweet) {
              similarTweet = allTweets.find(tweet => 
                (savedPosition.authorHandle && tweet.authorHandle === savedPosition.authorHandle) ||
                (savedPosition.authorName && tweet.authorName === savedPosition.authorName) ||
                (savedPosition.tweetText && tweet.text && tweet.text.includes(savedPosition.tweetText.slice(0, 30)))
              );
            }
            
            if (similarTweet) {
              similarTweet.element.scrollIntoView({ behavior: 'smooth', block: 'start' });
              ui.showToast('Found similar tweet', 'success');
              return;
            }
          }
          
          // Give more context about why it's approximate
          const minutesAgo = Math.round((Date.now() - savedPosition.timestamp) / (1000 * 60));
          if (minutesAgo > 60) {
            const hoursAgo = Math.round(minutesAgo / 60);
            ui.showToast(`Restored to approximate position (saved ${hoursAgo}h ago)`, 'info');
          } else {
            ui.showToast(`Restored to approximate position (saved ${minutesAgo}m ago)`, 'info');
          }
        } else {
          ui.showToast('Tweet not found', 'error');
        }
      } catch (error) {
        console.error('Failed to restore position:', error);
        ui.showToast('Failed to restore', 'error');
      }
    };

    // Initialize UI
    ui = new UIManager(savePosition, restorePosition);
    ui.init();

    // Update restore button state
    storage.hasPosition().then(hasPosition => {
      ui.updateRestoreButtonState(hasPosition);
      
      // Auto-restore on page load if position exists
      if (hasPosition) {
        storage.getPosition().then(pos => {
          // Auto-restore if we're on home timeline
          if (pos && window.location.pathname === '/home') {
            console.log('[XBookmark] Auto-restoring position on home timeline');
            // Wait a bit longer for initial page load
            setTimeout(() => {
              restorePosition();
            }, 2000);
          }
        });
      }
    });

    // Detect theme
    const detectTheme = () => {
      const isDark = document.documentElement.style.backgroundColor === 'rgb(0, 0, 0)' ||
                     document.body.style.backgroundColor === 'rgb(0, 0, 0)';
      ui.setTheme(isDark);
    };

    detectTheme();

    // Watch for theme changes
    const themeObserver = new MutationObserver(detectTheme);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style']
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Shift + S to save
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        savePosition();
      }
      // Ctrl/Cmd + Shift + R to restore
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        restorePosition();
      }
    });
  }
};