import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { cvLang } from '../state/store';
import { getUI } from '../i18n/sections';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installState = signal<'hidden' | 'available' | 'ios' | 'ios-other' | 'safari-macos'>('hidden');

function detectPlatform(): 'ios-safari' | 'ios-other' | 'safari-macos' | 'chromium' | 'other' {
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
  if (isIOS) {
    // CriOS = Chrome on iOS, FxiOS = Firefox, OPiOS = Opera, EdgiOS = Edge
    if (/CriOS|FxiOS|OPiOS|EdgiOS/i.test(ua)) return 'ios-other';
    return 'ios-safari';
  }
  // Safari on macOS: vendor is Apple, no Chrome/Chromium in UA
  const isSafariMac =
    navigator.vendor === 'Apple Computer, Inc.' &&
    !/chrome|chromium|crios/i.test(ua) &&
    /safari/i.test(ua);
  if (isSafariMac) return 'safari-macos';
  if ('BeforeInstallPromptEvent' in window || /chrome/i.test(ua)) return 'chromium';
  return 'other';
}

export function InstallPrompt() {
  useEffect(() => {
    if (localStorage.getItem('pwa-dismissed')) return;

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    const platform = detectPlatform();

    if (platform === 'ios-safari') {
      const t = setTimeout(() => { installState.value = 'ios'; }, 4000);
      return () => clearTimeout(t);
    }

    if (platform === 'ios-other') {
      const t = setTimeout(() => { installState.value = 'ios-other'; }, 4000);
      return () => clearTimeout(t);
    }

    if (platform === 'safari-macos') {
      const t = setTimeout(() => { installState.value = 'safari-macos'; }, 4000);
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

  const ui = getUI(cvLang.value);

  return (
    <div class="install-prompt" role="complementary" aria-label="Install app">
      <img src="/icon-192.png" class="install-icon" alt="" width="40" height="40" />
      <div class="install-body">
        {state === 'ios' && (
          <>
            <strong>{ui.installAddToHome}</strong>
            <span>{ui.installTap} <ThreeDotsIcon /> → <ShareIcon /> {ui.installShare} → {ui.installAddToHome}</span>
          </>
        )}
        {state === 'ios-other' && (
          <>
            <strong>{ui.installIOSOtherTitle}</strong>
            <span>{ui.installIOSOtherHint}</span>
          </>
        )}
        {state === 'safari-macos' && (
          <>
            <strong>{ui.installMacTitle}</strong>
            <span>{ui.installMacHint}</span>
          </>
        )}
        {state === 'available' && (
          <>
            <strong>{ui.installTitle}</strong>
            <span>{ui.installDesc}</span>
          </>
        )}
      </div>
      {state === 'available' && (
        <button class="install-cta" type="button" onClick={install}>{ui.installBtn}</button>
      )}
      <button class="install-close" type="button" onClick={dismiss} aria-label="Dismiss">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden>
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}

function ThreeDotsIcon() {
  return (
    <svg viewBox="0 0 20 6" fill="currentColor"
      style="display:inline;width:16px;height:10px;vertical-align:-1px;margin:0 1px" aria-hidden>
      <circle cx="2" cy="3" r="2"/>
      <circle cx="10" cy="3" r="2"/>
      <circle cx="18" cy="3" r="2"/>
    </svg>
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
