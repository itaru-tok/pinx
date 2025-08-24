export class UIManager {
  private container: HTMLElement | null = null;
  private saveButton: HTMLButtonElement | null = null;
  private restoreButton: HTMLButtonElement | null = null;
  private stopButton: HTMLButtonElement | null = null;
  private toast: HTMLElement | null = null;
  private searchingToast: HTMLElement | null = null;
  private onStop: (() => void) | null = null;

  constructor(
    private onSave: () => void,
    private onRestore: () => void
  ) {}

  public formatTimeAgo(savedTime: number): string {
    const ageSeconds = Math.floor((Date.now() - savedTime) / 1000);
    const ageMinutes = Math.floor(ageSeconds / 60);
    const ageHours = Math.floor(ageMinutes / 60);
    const ageDays = Math.floor(ageHours / 24);
    
    // Match Twitter's format exactly
    if (ageDays >= 1) {
      // For days, use ceiling to match Twitter's behavior
      // (25 hours = 2 days, not 1 day)
      const displayDays = Math.ceil(ageHours / 24);
      return `${displayDays}d`;
    } else if (ageHours >= 1) {
      return `${ageHours}h`;
    } else if (ageMinutes >= 1) {
      return `${ageMinutes}m`;
    } else {
      return `${ageSeconds}s`;
    }
  }

  init(): void {
    if (typeof window === 'undefined') return;
    this.createContainer();
    this.createButtons();
    this.createToast();
    this.attachToPage();
  }

  private createContainer(): void {
    this.container = document.createElement('div');
    this.container.id = 'x-bookmark-controls';
    this.container.className = 'x-bookmark-container';
  }

  private createButtons(): void {
    if (!this.container) return;

    // Save button
    this.saveButton = document.createElement('button');
    this.saveButton.className = 'x-bookmark-btn x-bookmark-save';
    this.saveButton.innerHTML = '📍 Pin';
    this.saveButton.title = 'Pin current tweet position';
    this.saveButton.addEventListener('click', () => this.onSave());

    // Restore button
    this.restoreButton = document.createElement('button');
    this.restoreButton.className = 'x-bookmark-btn x-bookmark-restore';
    this.restoreButton.innerHTML = '↩️ Jump';
    this.restoreButton.title = 'Jump back to pinned position';
    this.restoreButton.addEventListener('click', () => this.onRestore());

    // Stop button (hidden by default)
    this.stopButton = document.createElement('button');
    this.stopButton.className = 'x-bookmark-btn x-bookmark-stop';
    this.stopButton.innerHTML = '⏹️ Cancel';
    this.stopButton.title = 'Stop searching';
    this.stopButton.style.display = 'none';
    this.stopButton.addEventListener('click', () => {
      if (this.onStop) {
        this.onStop();
      }
    });

    this.container.appendChild(this.saveButton);
    this.container.appendChild(this.restoreButton);
    this.container.appendChild(this.stopButton);
  }

  private createToast(): void {
    this.toast = document.createElement('div');
    this.toast.className = 'x-bookmark-toast';
    document.body.appendChild(this.toast);

    // Searching toast (persistent)
    this.searchingToast = document.createElement('div');
    this.searchingToast.className = 'x-bookmark-toast x-bookmark-searching-toast';
    this.searchingToast.innerHTML = `
      <div class="x-bookmark-searching-content">
        <div class="x-bookmark-spinner"></div>
        <span class="x-bookmark-searching-text">Searching...</span>
      </div>
    `;
    document.body.appendChild(this.searchingToast);
  }

  private attachToPage(): void {
    if (!this.container) return;
    
    // Wait for X.com to load
    const attach = () => {
      const main = document.querySelector('main');
      if (main && !document.getElementById('x-bookmark-controls')) {
        document.body.appendChild(this.container!);
      }
    };

    // Try to attach immediately
    attach();

    // Also observe for changes in case the page structure changes
    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(() => {
        if (!document.getElementById('x-bookmark-controls')) {
          attach();
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  showToast(message: string, type: 'success' | 'error' | 'info' = 'success'): void {
    if (!this.toast) return;

    this.toast.textContent = message;
    this.toast.className = `x-bookmark-toast x-bookmark-toast-${type} x-bookmark-toast-show`;

    setTimeout(() => {
      if (this.toast) {
        this.toast.classList.remove('x-bookmark-toast-show');
      }
    }, 3000);
  }

  updateRestoreButtonState(hasPosition: boolean, savedTime?: number, tweetTimestamp?: string): void {
    if (this.restoreButton) {
      this.restoreButton.disabled = !hasPosition;
      this.restoreButton.style.opacity = hasPosition ? '1' : '0.5';
      
      // Update button text with tweet timestamp
      if (hasPosition && tweetTimestamp) {
        // Add 'ago' if the timestamp is a relative time (contains h, m, s, d)
        const needsAgo = /^\d+[hmsd]$/.test(tweetTimestamp);
        const displayTime = needsAgo ? `${tweetTimestamp} ago` : tweetTimestamp;
        this.restoreButton.innerHTML = `↩️ Jump (${displayTime})`;
      } else {
        this.restoreButton.innerHTML = '↩️ Jump';
      }
    }
  }

  setTheme(isDark: boolean): void {
    if (this.container) {
      this.container.classList.toggle('x-bookmark-dark', isDark);
    }
  }


  startSearching(onStop: () => void, savedTime?: number): void {
    this.onStop = onStop;
    
    // Show searching toast with time ago
    if (this.searchingToast) {
      // Calculate time ago
      const textElement = this.searchingToast.querySelector('.x-bookmark-searching-text');
      if (textElement) {
        textElement.textContent = 'Searching...';
      }
      
      this.searchingToast.classList.add('x-bookmark-toast-show');
    }
    
    // Show stop button
    if (this.stopButton) {
      this.stopButton.style.display = 'block';
    }
    
    // Disable restore button during search
    if (this.restoreButton) {
      this.restoreButton.disabled = true;
    }
  }

  updateSearchingProgress(message: string): void {
    if (this.searchingToast) {
      const textElement = this.searchingToast.querySelector('.x-bookmark-searching-text');
      if (textElement) {
        textElement.textContent = message;
      }
    }
  }

  stopSearching(): void {
    this.onStop = null;
    
    // Hide searching toast
    if (this.searchingToast) {
      this.searchingToast.classList.remove('x-bookmark-toast-show');
    }
    
    // Hide stop button
    if (this.stopButton) {
      this.stopButton.style.display = 'none';
    }
    
    // Re-enable restore button
    if (this.restoreButton) {
      this.restoreButton.disabled = false;
    }
  }
}