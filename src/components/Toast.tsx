import { signal } from '@preact/signals';

interface ToastState { msg: string; visible: boolean; }
const state = signal<ToastState>({ msg: '', visible: false });

let timer: number | undefined;
export function showToast(msg: string) {
  state.value = { msg, visible: true };
  if (timer) clearTimeout(timer);
  timer = window.setTimeout(() => { state.value = { ...state.value, visible: false }; }, 4000);
}

export function Toast() {
  const { msg, visible } = state.value;
  return (
    <div class={`toast${visible ? ' show' : ''}`} role="status" aria-live="polite">
      {msg}
    </div>
  );
}
