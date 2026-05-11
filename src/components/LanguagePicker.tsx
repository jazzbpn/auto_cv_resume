import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { cvLang, setCvLang } from '../state/store';
import { LANG_META, type LangCode } from '../i18n/sections';

const open = signal(false);

export function LanguagePicker() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        open.value = false;
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = LANG_META[cvLang.value];

  return (
    <div class="lang-fab" ref={ref}>
      {open.value && (
        <div class="lang-fab-menu">
          {(Object.entries(LANG_META) as [LangCode, typeof LANG_META[LangCode]][]).map(([code, meta]) => (
            <button
              key={code}
              class={`lang-fab-opt${cvLang.value === code ? ' active' : ''}`}
              onClick={() => { setCvLang(code); open.value = false; }}
            >
              <span class="lang-fab-native">{meta.nativeLabel}</span>
              <span class="lang-fab-eng">{meta.label}</span>
            </button>
          ))}
        </div>
      )}
      <button
        class={`lang-fab-btn${open.value ? ' open' : ''}`}
        onClick={() => { open.value = !open.value; }}
        title="Change CV language"
        aria-label="Change CV language"
      >
        <span class="lang-fab-globe">🌐</span>
        <span class="lang-fab-label">{current.nativeLabel}</span>
        <span class="lang-fab-arrow">{open.value ? '▲' : '▼'}</span>
      </button>
    </div>
  );
}
