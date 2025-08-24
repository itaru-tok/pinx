export interface SavedPosition {
  tweetId?: string;
  tweetUrl?: string;
  tweetText?: string;
  authorHandle?: string;
  authorName?: string;  // Display name for better matching
  tweetTimestamp?: string;  // The tweet's post time (e.g., "7h", "Aug 23")
  timestamp: number;
  scrollPosition?: number;
  tweetOffsetTop?: number;  // How far from viewport top the tweet was
  pageUrl?: string;  // Current page URL to detect if we're on the same timeline
  isFollowingTab?: boolean;  // Whether saved on Following tab
  nearbyTweets?: {  // Save info about nearby tweets for better matching
    before?: { id?: string; handle?: string; text?: string };
    after?: { id?: string; handle?: string; text?: string };
  };
}

export class StorageManager {
  private readonly STORAGE_KEY = 'x_bookmark_position';
  private readonly MAX_AGE_DAYS = 30;

  async savePosition(position: SavedPosition): Promise<void> {
    await chrome.storage.local.set({
      [this.STORAGE_KEY]: position
    });
  }

  async getPosition(): Promise<SavedPosition | null> {
    const result = await chrome.storage.local.get(this.STORAGE_KEY);
    const position = result[this.STORAGE_KEY] as SavedPosition | undefined;
    
    if (!position) return null;
    
    // Check if position is too old
    const ageInDays = (Date.now() - position.timestamp) / (1000 * 60 * 60 * 24);
    if (ageInDays > this.MAX_AGE_DAYS) {
      await this.clearPosition();
      return null;
    }
    
    return position;
  }

  async clearPosition(): Promise<void> {
    await chrome.storage.local.remove(this.STORAGE_KEY);
  }

  async hasPosition(): Promise<boolean> {
    const position = await this.getPosition();
    return position !== null;
  }
}