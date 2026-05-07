import { lazy } from 'preact/compat';
import type { TemplateId } from '../types';

export const TEMPLATES: Record<TemplateId, ReturnType<typeof lazy>> = {
  classic: lazy(() => import('./Classic').then(m => ({ default: m.Classic }))),
  modern: lazy(() => import('./Modern').then(m => ({ default: m.Modern }))),
  minimal: lazy(() => import('./Minimal').then(m => ({ default: m.Minimal }))),
};
