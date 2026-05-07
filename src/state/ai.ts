import { signal } from '@preact/signals';
import { cv, aiResult } from './store';
import { reviewCV } from '../services/aiClient';

export const aiJD = signal('');
export const aiStatus = signal<'idle' | 'loading' | 'error'>('idle');
export const aiError = signal('');

export async function runAIReview(): Promise<void> {
  if (aiStatus.value === 'loading') return;
  aiStatus.value = 'loading';
  aiError.value = '';
  try {
    const result = await reviewCV(cv.value, aiJD.value);
    aiResult.value = result;
    aiStatus.value = 'idle';
  } catch (e) {
    aiStatus.value = 'error';
    aiError.value = e instanceof Error ? e.message : 'Analysis failed';
  }
}
