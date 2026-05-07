import { Suspense } from 'preact/compat';
import { useEffect, useRef } from 'preact/hooks';
import { cv, template, visibility } from '../state/store';
import { TEMPLATES } from '../templates';
import { buildResumeData } from '../templates/derive';

const RESUME_W = 700;

function ScaledResume() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const doc = docRef.current;
    if (!wrap || !doc) return;
    const scale = () => {
      const panel = wrap.parentElement;
      if (!panel) return;
      wrap.style.transform = 'none';
      wrap.style.width = RESUME_W + 'px';
      wrap.style.marginLeft = '0';
      const panelW = panel.clientWidth;
      const available = Math.max(panelW - 32, 1);
      const s = Math.min(1, available / RESUME_W);
      const visualW = Math.round(RESUME_W * s);
      const naturalH = doc.offsetHeight;
      wrap.style.transformOrigin = 'top left';
      wrap.style.transform = `scale(${s})`;
      wrap.style.marginLeft = Math.max(0, Math.round((panelW - visualW) / 2)) + 'px';
      wrap.style.height = Math.round(naturalH * s) + 'px';
    };
    scale();
    const ro = new ResizeObserver(scale);
    ro.observe(doc);
    if (wrap.parentElement) ro.observe(wrap.parentElement);
    window.addEventListener('resize', scale);
    return () => { ro.disconnect(); window.removeEventListener('resize', scale); };
  }, []);

  const Template = TEMPLATES[template.value];
  const data = buildResumeData(cv.value, visibility.value);

  return (
    <div class="preview-scale-wrap" ref={wrapRef} id="preview-scale-wrap">
      <div ref={docRef}>
        <Suspense fallback={<div class="resume placeholder">Loading template…</div>}>
          {/* @ts-expect-error — Preact lazy types pass through children */}
          <Template data={data} />
        </Suspense>
      </div>
    </div>
  );
}

export function Preview() {
  return (
    <div class="preview-scroll">
      <ScaledResume />
    </div>
  );
}
