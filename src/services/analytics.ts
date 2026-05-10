type UmamiGlobal = { track: (name: string, props?: Record<string, unknown>) => void };

declare global {
  interface Window { umami?: UmamiGlobal }
}

export type AnalyticsEvent =
  | { name: 'template_selected'; props: { id: string } }
  | { name: 'import_success'; props: { format: string } }
  | { name: 'ai_analyze' }
  | { name: 'ai_autofix' }
  | { name: 'ai_autofix_success' }
  | { name: 'export' };

export function track<E extends AnalyticsEvent>(
  ...args: E extends { props: infer P } ? [E['name'], P] : [E['name']]
): void {
  if (typeof window === 'undefined') return;
  try {
    const [name, props] = args as [string, Record<string, unknown> | undefined];
    window.umami?.track(name, props);
  } catch {
    // Analytics failures must never break the app.
  }
}
