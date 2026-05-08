import { signal } from '@preact/signals';
import { cv, visibility, aiResult, aiOptimize } from './store';
import { reviewCV, optimizeCV } from '../services/aiClient';

export const aiJD = signal('');
export const aiStatus = signal<'idle' | 'loading' | 'error'>('idle');
export const aiError = signal('');

/**
 * Status of the parallel optimize call. The analysis panel paints from
 * aiResult as soon as the analyse stream surfaces a partial; rewrites land
 * independently from this call. Auto-Fix awaits this if the user clicks
 * before it lands.
 */
export const aiOptimizeStatus = signal<'idle' | 'loading' | 'error'>('idle');
export const aiOptimizeError = signal('');

let optimizeInflight: Promise<void> | null = null;

export async function runAIReview(): Promise<void> {
  if (aiStatus.value === 'loading') return;
  aiStatus.value = 'loading';
  aiError.value = '';
  // Don't clear aiOptimize up-front — keeping it preserves the visual
  // "fixed" state of the HeroScore during a Re-analyse from fixed state.
  // The optimize call below will overwrite it with fresh rewrites.
  aiOptimizeStatus.value = 'idle';
  aiOptimizeError.value = '';

  // Fire optimize in PARALLEL with analyse: total perceived time becomes
  // max(analyse, optimize) instead of analyse + optimize. The optimize call
  // is self-sufficient (doesn't need the analysis result), so we don't wait.
  // Reset the inflight handle so this run replaces any stale prior call.
  optimizeInflight = null;
  void runAIOptimize();

  try {
    const result = await reviewCV(cv.value, aiJD.value, visibility.value, (partial) => {
      aiResult.value = partial;
    });
    aiResult.value = result;
    aiStatus.value = 'idle';
  } catch (e) {
    aiStatus.value = 'error';
    aiError.value = e instanceof Error ? e.message : 'Analysis failed';
  }
}

/**
 * Fetch (or re-use the in-flight Promise for) the rewrites. Auto-Fix awaits
 * this; runAIReview triggers it eagerly. Dedupes concurrent callers so a
 * click-while-loading doesn't fire a second request.
 */
export function runAIOptimize(): Promise<void> {
  if (optimizeInflight) return optimizeInflight;
  aiOptimizeStatus.value = 'loading';
  aiOptimizeError.value = '';
  optimizeInflight = (async () => {
    try {
      const result = await optimizeCV(cv.value, aiJD.value, visibility.value);
      aiOptimize.value = result;
      aiOptimizeStatus.value = 'idle';
    } catch (e) {
      aiOptimizeStatus.value = 'error';
      aiOptimizeError.value = e instanceof Error ? e.message : 'Optimize failed';
    } finally {
      optimizeInflight = null;
    }
  })();
  return optimizeInflight;
}
