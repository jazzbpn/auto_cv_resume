export type Platform = 'ios-safari' | 'ios-other' | 'safari-macos' | 'android' | 'chromium' | 'firefox' | 'other';

export function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;

  if (isIOS) {
    return /CriOS|FxiOS|OPiOS|EdgiOS/i.test(ua) ? 'ios-other' : 'ios-safari';
  }

  const isSafariMac =
    navigator.vendor === 'Apple Computer, Inc.' &&
    !/chrome|chromium|crios/i.test(ua) &&
    /safari/i.test(ua);
  if (isSafariMac) return 'safari-macos';

  if (/android/i.test(ua)) return 'android';

  if (/firefox/i.test(ua) && !/seamonkey/i.test(ua)) return 'firefox';

  if ('BeforeInstallPromptEvent' in window || /chrome|chromium|edg|opr/i.test(ua)) return 'chromium';

  return 'other';
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}
