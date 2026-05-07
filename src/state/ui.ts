import { signal } from '@preact/signals';

export type MobilePanel = 'edit' | 'preview' | 'analyse';
export const mobilePanel = signal<MobilePanel>('edit');
