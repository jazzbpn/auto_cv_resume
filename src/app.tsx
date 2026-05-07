import { signal } from '@preact/signals';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';
import { Editor } from './components/Editor';
import { Preview } from './components/Preview';
import { AnalysePanel } from './components/AnalysePanel';
import { ImportModal } from './components/ImportModal';
import { Toast } from './components/Toast';
import { mobilePanel } from './state/ui';
import type { MobilePanel } from './state/ui';

export const importOpen = signal(false);

export function App() {
  const panel: MobilePanel = mobilePanel.value;
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
    </>
  );
}
