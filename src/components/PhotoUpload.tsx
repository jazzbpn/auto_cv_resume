import { photo, showPhoto, setPhoto, setShowPhoto, cvLang } from '../state/store';
import { cropAndCompress } from '../services/photo';
import { getUI } from '../i18n/sections';
import './PhotoUpload.css';

export function PhotoUpload() {
  const ui = getUI(cvLang.value);
  const src = photo.value;

  async function handleChange(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const compressed = await cropAndCompress(file);
      setPhoto(compressed);
    } catch {
      /* corrupt or unsupported file — silently ignore */
    }
  }

  return (
    <div class="pu-wrap">
      <div class="pu-container">
        <div class="pu-avatar">
          <input
            type="file"
            accept="image/*"
            class="pu-file-input"
            aria-label={ui.uploadPhoto}
            onChange={handleChange}
          />
          {src
            ? <img src={src} alt="" class="pu-img" aria-hidden="true" />
            : (
              <div class="pu-placeholder" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                </svg>
                <span>{ui.uploadPhoto}</span>
              </div>
            )
          }
        </div>
        {src && (
          <button
            type="button"
            class="pu-remove"
            onClick={() => setPhoto(null)}
            aria-label={ui.removePhoto}
          >
            ×
          </button>
        )}
      </div>
      <label class="pu-toggle">
        <input
          type="checkbox"
          checked={showPhoto.value}
          onChange={() => setShowPhoto(!showPhoto.value)}
        />
        {ui.showPhotoLabel}
      </label>
    </div>
  );
}
