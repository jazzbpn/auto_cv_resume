import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installState = signal<'hidden' | 'available' | 'ios'>('hidden');

export function InstallPrompt() {
  useEffect(() => {
    if (localStorage.getItem('pwa-dismissed')) return;

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;

    if (isIOS) {
      const t = setTimeout(() => { installState.value = 'ios'; }, 4000);
      return () => clearTimeout(t);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      installState.value = 'available';
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const dismiss = () => {
    installState.value = 'hidden';
    localStorage.setItem('pwa-dismissed', '1');
  };

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    installState.value = 'hidden';
    if (outcome === 'accepted') localStorage.setItem('pwa-dismissed', '1');
  };

  const state = installState.value;
  if (state === 'hidden') return null;

  return (
    <div class="install-prompt" role="complementary" aria-label="Install app">
      <img src="/icon-192.png" class="install-icon" alt="" width="40" height="40" />
      <div class="install-body">
        {state === 'ios' ? (
          <>
            <strong>Add to Home Screen</strong>
            <span>Tap <ShareIcon /> then "Add to Home Screen"</span>
          </>
        ) : (
          <>
            <strong>Install ResumePDF</strong>
            <span>Works offline · no browser chrome</span>
          </>
        )}
      </div>
      {state === 'available' && (
        <button class="install-cta" type="button" onClick={install}>Install</button>
      )}
      <button class="install-close" type="button" onClick={dismiss} aria-label="Dismiss">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden>
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      style="display:inline;width:13px;height:13px;vertical-align:-1px;margin:0 1px" aria-hidden>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
      <polyline points="16 6 12 2 8 6"/>
      <line x1="12" y1="2" x2="12" y2="15"/>
    </svg>
  );
}
