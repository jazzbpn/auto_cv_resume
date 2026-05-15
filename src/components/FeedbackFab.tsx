import { signal } from '@preact/signals';
import { useEffect, useRef } from 'preact/hooks';
import { track } from '../services/analytics';

type FeedbackType = 'bug' | 'idea' | 'other';
type SendStatus = 'idle' | 'sending' | 'success' | 'error';

const NTFY_TOPIC = 'UIzlYj62JM2U8raw';
const NTFY_URL = 'https://ntfy.sh';

const open = signal(false);
const feedbackType = signal<FeedbackType>('idea');
const message = signal('');
const email = signal('');
const sendStatus = signal<SendStatus>('idle');

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

async function submit() {
  const emailVal = email.value.trim();
  if (!message.value.trim() || sendStatus.value !== 'idle') return;
  if (emailVal && !isValidEmail(emailVal)) return;
  sendStatus.value = 'sending';

  const typeLabel = feedbackType.value === 'bug' ? 'Bug' : feedbackType.value === 'idea' ? 'Idea' : 'Other';
  const tag = feedbackType.value === 'bug' ? 'bug' : feedbackType.value === 'idea' ? 'bulb' : 'speech_balloon';
  const body = email.value.trim()
    ? `${message.value.trim()}\n\nReply to: ${email.value.trim()}`
    : message.value.trim();

  try {
    // Use JSON API to avoid CORS preflight issues with custom headers
    const res = await fetch(`${NTFY_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: NTFY_TOPIC,
        title: `ResumePDF — ${typeLabel}`,
        message: body,
        tags: [tag],
        priority: feedbackType.value === 'bug' ? 4 : 3,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    sendStatus.value = 'success';
    track('feedback_sent', { type: feedbackType.value });
    setTimeout(() => {
      open.value = false;
      sendStatus.value = 'idle';
      message.value = '';
      email.value = '';
      feedbackType.value = 'idea';
    }, 2000);
  } catch {
    sendStatus.value = 'error';
  }
}

function handleOpen() {
  if (!open.value) track('feedback_open');
  open.value = !open.value;
  if (!open.value && sendStatus.value === 'error') sendStatus.value = 'idle';
}

export function FeedbackFab() {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open.value) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        open.value = false;
        if (sendStatus.value === 'error') sendStatus.value = 'idle';
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open.value]);

  return (
    <div class="fb-wrap" ref={panelRef}>
      {open.value && (
        <>
          <div class="fb-backdrop" onClick={() => { open.value = false; }} />
          <div class="fb-panel" role="dialog" aria-label="Send feedback">
            <div class="fb-header">
              <span class="fb-title">Send Feedback</span>
              <button class="fb-close" type="button" onClick={() => { open.value = false; }} aria-label="Close">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div class="fb-body">
              <div class="fb-types">
                {(['bug', 'idea', 'other'] as FeedbackType[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    class={`fb-type-btn${feedbackType.value === t ? ' fb-type-active' : ''}`}
                    onClick={() => { feedbackType.value = t; }}
                    disabled={sendStatus.value === 'sending' || sendStatus.value === 'success'}
                  >
                    {t === 'bug' ? '🐛 Bug' : t === 'idea' ? '💡 Idea' : '💬 Other'}
                  </button>
                ))}
              </div>
              <textarea
                class="fb-textarea"
                placeholder="Tell us what's on your mind…"
                value={message.value}
                onInput={(e) => { message.value = (e.target as HTMLTextAreaElement).value; }}
                rows={4}
                disabled={sendStatus.value === 'sending' || sendStatus.value === 'success'}
              />
              <input
                class={`fb-email${email.value.trim() && !isValidEmail(email.value.trim()) ? ' fb-email-invalid' : ''}`}
                type="email"
                placeholder="Your email (optional)"
                value={email.value}
                onInput={(e) => { email.value = (e.target as HTMLInputElement).value; }}
                disabled={sendStatus.value === 'sending' || sendStatus.value === 'success'}
              />
              {email.value.trim() && !isValidEmail(email.value.trim()) && (
                <p class="fb-field-error">Enter a valid email address.</p>
              )}
              {sendStatus.value === 'error' && (
                <p class="fb-status fb-status-error">Failed to send. Please try again.</p>
              )}
              {sendStatus.value === 'success' && (
                <p class="fb-status fb-status-success">Thanks for your feedback! 🎉</p>
              )}
              <button
                class="fb-submit"
                type="button"
                onClick={submit}
                disabled={!message.value.trim() || (!!email.value.trim() && !isValidEmail(email.value.trim())) || sendStatus.value === 'sending' || sendStatus.value === 'success'}
              >
                {sendStatus.value === 'sending' ? 'Sending…' : sendStatus.value === 'success' ? 'Sent!' : 'Send'}
              </button>
            </div>
          </div>
        </>
      )}
      <button
        class={`fb-btn${open.value ? ' fb-btn-active' : ''}`}
        type="button"
        onClick={handleOpen}
        aria-label="Send feedback"
        title="Send feedback"
      >
        <ChatIcon />
      </button>
    </div>
  );
}
