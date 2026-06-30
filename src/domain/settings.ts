import { getSubscriptionNames, toDateKey } from './cashback';
import { normalizeMessageTemplates } from './messages';
import type {
  CashbackSettings,
  ClientStatusMap,
  MessageTemplatesSettings,
  PricePeriod,
  PurchaseRecord,
} from './types';

const settingsVersion = 1;

interface SettingsFile {
  version: number;
  settings: CashbackSettings;
  clientStatuses?: ClientStatusMap;
  messageTemplates?: MessageTemplatesSettings;
}

export function createInitialSettings(purchases: PurchaseRecord[]): CashbackSettings {
  const dates = purchases.map((purchase) => toDateKey(purchase.date)).sort();
  const subscriptionNames = getSubscriptionNames(purchases);

  return {
    cashbackPercent: 3,
    periods: [
      {
        id: crypto.randomUUID(),
        name: 'Основной период',
        startDate: dates[0] ?? toDateKey(new Date()),
        endDate: dates.at(-1) ?? toDateKey(new Date()),
        pricesBySubscriptionName: Object.fromEntries(subscriptionNames.map((name) => [name, null])),
      },
    ],
  };
}

export function serializeSettings(
  settings: CashbackSettings,
  clientStatuses?: ClientStatusMap,
  messageTemplates?: MessageTemplatesSettings,
): string {
  const file: SettingsFile = { version: settingsVersion, settings };

  if (clientStatuses) {
    file.clientStatuses = clientStatuses;
  }

  if (messageTemplates) {
    file.messageTemplates = messageTemplates;
  }

  return JSON.stringify(file, null, 2);
}

export function deserializeSettings(raw: string): CashbackSettings {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Не удалось прочитать JSON настроек.');
  }

  const maybeSettings = isRecord(parsed) && 'settings' in parsed ? parsed.settings : parsed;

  if (!isRecord(maybeSettings)) {
    throw new Error('Файл настроек не похож на настройки приложения.');
  }

  if (typeof maybeSettings.cashbackPercent !== 'number' || !Number.isFinite(maybeSettings.cashbackPercent)) {
    throw new Error('Файл настроек не содержит корректный процент кешбека.');
  }

  if (!Array.isArray(maybeSettings.periods)) {
    throw new Error('Файл настроек не содержит периоды цен.');
  }

  return {
    cashbackPercent: maybeSettings.cashbackPercent,
    periods: maybeSettings.periods.map(parsePeriod),
  };
}

export function deserializeClientStatuses(raw: string): ClientStatusMap | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Не удалось прочитать JSON настроек.');
  }

  if (!isRecord(parsed) || !isRecord(parsed.clientStatuses)) {
    return null;
  }

  return parseClientStatuses(parsed.clientStatuses);
}

export function deserializeMessageTemplates(raw: string): MessageTemplatesSettings | null {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Не удалось прочитать JSON настроек.');
  }

  if (!isRecord(parsed) || !('messageTemplates' in parsed)) {
    return null;
  }

  return normalizeMessageTemplates(parsed.messageTemplates);
}

export function normalizeSettingsForSubscriptions(
  settings: CashbackSettings,
  subscriptionNames: string[],
): CashbackSettings {
  return {
    cashbackPercent: settings.cashbackPercent,
    periods: settings.periods.map((period) => ({
      ...period,
      pricesBySubscriptionName: {
        ...Object.fromEntries(subscriptionNames.map((name) => [name, null])),
        ...period.pricesBySubscriptionName,
      },
    })),
  };
}

function parsePeriod(raw: unknown): PricePeriod {
  if (!isRecord(raw)) {
    throw new Error('Один из периодов цен имеет неверный формат.');
  }

  if (
    typeof raw.id !== 'string' ||
    typeof raw.name !== 'string' ||
    typeof raw.startDate !== 'string' ||
    typeof raw.endDate !== 'string' ||
    !isRecord(raw.pricesBySubscriptionName)
  ) {
    throw new Error('Один из периодов цен имеет неверный формат.');
  }

  return {
    id: raw.id,
    name: raw.name,
    startDate: raw.startDate,
    endDate: raw.endDate,
    pricesBySubscriptionName: Object.fromEntries(
      Object.entries(raw.pricesBySubscriptionName).map(([key, value]) => [
        key,
        value === null ? null : typeof value === 'number' && Number.isFinite(value) ? value : null,
      ]),
    ),
  };
}

function parseClientStatuses(raw: Record<string, unknown>): ClientStatusMap {
  return Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
