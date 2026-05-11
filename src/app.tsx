import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { Editor } from './components/Editor';
import { Preview } from './components/Preview';
import { AnalysePanel } from './components/AnalysePanel';
import { ImportModal } from './components/ImportModal';
import { Toast } from './components/Toast';
import { LanguagePicker } from './components/LanguagePicker';
import { mobilePanel } from './state/ui';
import { track } from './services/analytics';
import type { MobilePanel } from './state/ui';

export const importOpen = signal(false);

export function App() {
  const panel: MobilePanel = mobilePanel.value;
  useEffect(() => {
    const fire = (e: Event) => {
      if ((e.target as Element | null)?.closest('.panel-edit')) {
        track('editor_first_input');
        document.removeEventListener('input', fire, true);
      }
    };
    document.addEventListener('input', fire, true);
    return () => document.removeEventListener('input', fire, true);
  }, []);
  return (
    <>
      <TopBar onImport={() => { importOpen.value = true; }} />
      <main class="content-area">
        <section
          class={`panel panel-edit${panel !== 'edit' ? ' mobile-hidden' : ''}`}
          aria-label="CV editor"
        >
          <Editor />
        </section>
        <section
          class={`panel panel-preview${panel !== 'preview' ? ' mobile-hidden' : ''}`}
          aria-label="CV preview"
        >
          <Preview />
        </section>
        <section
          class={`panel panel-analyse${panel !== 'analyse' ? ' mobile-hidden' : ''}`}
          aria-label="ATS analysis"
        >
          <AnalysePanel />
        </section>
      </main>
      <BottomNav active={panel} onSelect={(p) => { mobilePanel.value = p; }} />
      {importOpen.value && <ImportModal onClose={() => { importOpen.value = false; }} />}
      <Toast />
      <LanguagePicker />
    </>
  );
}
