import { deserializeSettings, serializeSettings } from './settings';
import type { CashbackSettings, ClientStatusMap } from './types';

const storageKey = 'cashback-calculate-settings';
const clientStatusesStorageKey = 'cashback-calculate-client-statuses';

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

export function loadStoredClientStatuses(): ClientStatusMap {
  const raw = localStorage.getItem(clientStatusesStorageKey);
  if (!raw) {
    return {};
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(parsed).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
  );
}

export function saveStoredClientStatuses(statuses: ClientStatusMap): void {
  localStorage.setItem(clientStatusesStorageKey, JSON.stringify(statuses));
}
