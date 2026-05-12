import * as preact from 'preact';
import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { detectPlatform, isStandalone } from '../services/platform';
import type { Platform } from '../services/platform';
import { cvLang } from '../state/store';
import { getUI } from '../i18n/sections';
import type { UILabels } from '../i18n/sections';

const open = signal(false);
const visible = signal(false);

interface PlatformInfo {
  id: Platform;
  Icon: () => preact.JSX.Element;
  name: string;
  steps: string[];
}

function IOSIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="ig-plat-svg" aria-hidden>
      <rect x="6" y="1" width="12" height="22" rx="3" />
      <line x1="12" y1="18.5" x2="12" y2="18.51" stroke-width="2" />
      <line x1="9.5" y1="4" x2="14.5" y2="4" stroke-width="1.5" stroke-linecap="round" />
    </svg>
  );
}

function AndroidIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="ig-plat-svg" aria-hidden>
      {/* antenna */}
      <line x1="8.5" y1="4.5" x2="6.5" y2="2" />
      <line x1="15.5" y1="4.5" x2="17.5" y2="2" />
      {/* head */}
      <path d="M5 10a7 7 0 0 1 14 0v6a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-6z" />
      {/* eyes */}
      <circle cx="9.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="12" r="1" fill="currentColor" stroke="none" />
      {/* legs */}
      <line x1="8" y1="21" x2="8" y2="17" />
      <line x1="16" y1="21" x2="16" y2="17" />
    </svg>
  );
}

function MacIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="ig-plat-svg" aria-hidden>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M2 20h20" />
      <path d="M9 20l1.5-3h3L15 20" />
      {/* Apple logo hint — small leaf */}
      <path d="M12 8.5c0-1 .8-1.5 1.5-2-.5.8-.3 1.8 0 2.5-1 0-1.5-.5-1.5-.5z" fill="currentColor" stroke="none" />
      <path d="M10.5 9c0-1.2 1-2 1.5-2.5-.2 1 .5 2 1 2.8C11.5 10 10.5 10 10.5 9z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LaptopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="ig-plat-svg" aria-hidden>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M2 20h20" />
      <path d="M9 20l1.5-3h3L15 20" />
      {/* install arrow */}
      <line x1="12" y1="8" x2="12" y2="13" />
      <polyline points="9.5 10.5 12 13 14.5 10.5" />
    </svg>
  );
}

function FirefoxIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="ig-plat-svg" aria-hidden>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M2 20h20" />
      <path d="M9 20l1.5-3h3L15 20" />
      {/* X mark */}
      <line x1="10" y1="8.5" x2="14" y2="12.5" />
      <line x1="14" y1="8.5" x2="10" y2="12.5" />
    </svg>
  );
}

function buildPlatforms(ui: UILabels): PlatformInfo[] {
  return [
    { id: 'ios-safari',   Icon: IOSIcon,      name: 'iPhone / iPad — Safari',               steps: ui.igIosSafariSteps },
    { id: 'ios-other',    Icon: IOSIcon,      name: 'iPhone / iPad — Chrome / Firefox',      steps: ui.igIosOtherSteps },
    { id: 'safari-macos', Icon: MacIcon,      name: 'Mac — Safari',                          steps: ui.igMacSteps },
    { id: 'android',      Icon: AndroidIcon,  name: 'Android — Chrome / Samsung Browser',    steps: ui.igAndroidSteps },
    { id: 'chromium',     Icon: LaptopIcon,   name: 'Chrome / Edge / Brave — Desktop',       steps: ui.igChromiumSteps },
    { id: 'firefox',      Icon: FirefoxIcon,  name: 'Firefox',                               steps: ui.igFirefoxSteps },
  ];
}

export function InstallGuide() {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isStandalone()) return;
    visible.value = true;
    if (!localStorage.getItem('ig-seen')) {
      const t = setTimeout(() => {
        open.value = true;
        localStorage.setItem('ig-seen', '1');
      }, 2000);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (!open.value) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        open.value = false;
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open.value]);

  if (!visible.value || isStandalone()) return null;

  const platforms = buildPlatforms(getUI(cvLang.value));
  const current = detectPlatform();
  const platform = platforms.find(p => p.id === current) ?? platforms[4];

  return (
    <div class="ig-wrap" ref={panelRef}>
      {open.value && (
        <>
          <div class="ig-backdrop" onClick={() => { open.value = false; }} />
          <div class="ig-panel" role="dialog" aria-label="How to install ResumePDF">
            <div class="ig-header">
              <div class="ig-title-row">
                <img src="/icon-192.png" class="ig-app-icon" alt="" width="28" height="28" />
                <span class="ig-title">Install ResumePDF App</span>
              </div>
              <button class="ig-close" type="button" onClick={() => { open.value = false; }} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div class="ig-list">
              <div class="ig-platform">
                <p class="ig-plat-name">{platform.name}</p>
                <ol class="ig-steps">
                  {platform.steps.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              </div>
            </div>
          </div>
        </>
      )}
      <button
        class={`ig-btn${open.value ? ' ig-btn-active' : ''}`}
        type="button"
        onClick={() => { open.value = !open.value; }}
        aria-label="How to install this app"
        title="How to install"
      >
        <platform.Icon />
      </button>
    </div>
  );
}
