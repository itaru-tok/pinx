export class UIManager {
  private container: HTMLElement | null = null;
  private saveButton: HTMLButtonElement | null = null;
  private restoreButton: HTMLButtonElement | null = null;
  private toast: HTMLElement | null = null;

  constructor(
    private onSave: () => void,
    private onRestore: () => void
  ) {}

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
    this.saveButton.innerHTML = '📍 Save';
    this.saveButton.title = 'Save current position';
    this.saveButton.addEventListener('click', () => this.onSave());

    // Restore button
    this.restoreButton = document.createElement('button');
    this.restoreButton.className = 'x-bookmark-btn x-bookmark-restore';
    this.restoreButton.innerHTML = '↩️ Restore';
    this.restoreButton.title = 'Return to saved position';
    this.restoreButton.addEventListener('click', () => this.onRestore());

    this.container.appendChild(this.saveButton);
    this.container.appendChild(this.restoreButton);
  }

  private createToast(): void {
    this.toast = document.createElement('div');
    this.toast.className = 'x-bookmark-toast';
    document.body.appendChild(this.toast);
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

  updateRestoreButtonState(hasPosition: boolean): void {
    if (this.restoreButton) {
      this.restoreButton.disabled = !hasPosition;
      this.restoreButton.style.opacity = hasPosition ? '1' : '0.5';
    }
  }

  setTheme(isDark: boolean): void {
    if (this.container) {
      this.container.classList.toggle('x-bookmark-dark', isDark);
    }
  }
}