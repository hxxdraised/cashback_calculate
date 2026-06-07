import { deserializeSettings, serializeSettings } from './settings';
import type { CashbackSettings } from './types';

const storageKey = 'cashback-calculate-settings';

export function loadStoredSettings(): CashbackSettings | null {
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }

  return deserializeSettings(raw);
}

export function saveStoredSettings(settings: CashbackSettings): void {
  localStorage.setItem(storageKey, serializeSettings(settings));
}
