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
          tweetTimestamp: topTweet.timestamp,
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
        ui.updateRestoreButtonState(true, position.timestamp, position.tweetTimestamp);
      } catch (error) {
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
            // Show searching UI with stop button and time ago
            ui.startSearching(() => {
              detector.cancelSearch();
            }, savedPosition.timestamp);
            
            try {
              const result = await detector.waitForTweet(
                savedPosition.tweetId, 
                savedPosition.scrollPosition,
                (message) => {
                  ui.updateSearchingProgress(message);
                }
              );
              tweetElement = result.element;
              
              // Check if search timed out
              if (!tweetElement && result.timedOut) {
                ui.showToast('Time\'s up!', 'info');
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
                ui.showToast('Found nearby!', 'success');
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
              ui.showToast('Found nearby!', 'success');
              return;
            }
          }
          
          // Give more context about why it's approximate
          ui.showToast('Found nearby!', 'info');
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