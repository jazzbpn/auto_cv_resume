import { render } from 'preact';
import { App } from './app';
import './styles/tokens.css';
import './styles/base.css';
import './styles/editor.css';
import './styles/preview.css';
import './styles/ai.css';
import './styles/import.css';
import './styles/langpicker.css';
import './styles/installguide.css';
import './styles/feedbackfab.css';

const SPLASH_MIN_MS = 3500;
const splashStart = performance.now();

function dismissSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  splash.classList.add('splash-hide');
  splash.addEventListener('transitionend', () => splash.remove(), { once: true });
}

const root = document.getElementById('app');
if (root) {
  render(<App />, root);
  const elapsed = performance.now() - splashStart;
  const wait = Math.max(0, SPLASH_MIN_MS - elapsed);
  setTimeout(dismissSplash, wait);
}

if ('serviceWorker' in navigator) {
  // vite-plugin-pwa registers SW in production builds.
  // In dev, registration is a no-op.
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true })).catch(() => {});
}
