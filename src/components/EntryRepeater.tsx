import { cv as cvSignal, addItem, removeItem, updateItem } from '../state/store';
import type { CV, CollectionKey } from '../types';

interface FieldDef<T> {
  key: keyof T;
  label: string;
  type?: 'text' | 'textarea' | 'email' | 'tel';
  full?: boolean;
}

interface Props<K extends CollectionKey> {
  collection: K;
  addLabel: string;
  empty: () => CV[K][number];
  fields: FieldDef<CV[K][number]>[];
  titleField?: keyof CV[K][number];
}

export function EntryRepeater<K extends CollectionKey>({
  collection, addLabel, empty, fields, titleField,
}: Props<K>) {
  const items = cvSignal.value[collection];
  return (
    <>
      {items.map((row, i) => {
        const rowAny = row as unknown as Record<string, unknown>;
        const labelText =
          (titleField && String(rowAny[titleField as string] ?? '')) ||
          'New Entry';
        return (
          <div class="entry-block" key={i}>
            <div class="entry-block-hd">
              <span class="entry-block-lbl">#{i + 1} {labelText.slice(0, 40)}</span>
              <button
                type="button"
                class="remove-btn"
                onClick={() => removeItem(collection, i)}
              >
                Remove
              </button>
            </div>
            {fields.map((f) => {
              const value = String(rowAny[f.key as string] ?? '');
              const onInput = (e: Event) => {
                const target = e.currentTarget as HTMLInputElement | HTMLTextAreaElement;
                updateItem(collection, i, f.key, target.value);
              };
              return (
                <div class={`f f-float${f.full ? ' f-full' : ''}`} key={String(f.key)}>
                  {f.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      value={value}
                      placeholder=" "
                      aria-label={f.label}
                      onInput={onInput}
                    />
                  ) : (
                    <input
                      type={f.type ?? 'text'}
                      value={value}
                      placeholder=" "
                      aria-label={f.label}
                      onInput={onInput}
                    />
                  )}
                  <label>{f.label}</label>
                </div>
              );
            })}
          </div>
        );
      })}
      <button type="button" class="add-btn" onClick={() => addItem(collection, empty())}>
        ＋ {addLabel}
      </button>
    </>
  );
}
