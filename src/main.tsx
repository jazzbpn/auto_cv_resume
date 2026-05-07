import { render } from 'preact';
import { App } from './app';
import './styles/tokens.css';
import './styles/base.css';
import './styles/editor.css';
import './styles/preview.css';
import './styles/ai.css';
import './styles/import.css';

const root = document.getElementById('app');
if (root) render(<App />, root);

if ('serviceWorker' in navigator) {
  // vite-plugin-pwa registers SW in production builds.
  // In dev, registration is a no-op.
  import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true })).catch(() => {});
}
