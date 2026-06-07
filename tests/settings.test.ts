import { describe, expect, it } from 'vitest';
import {
  createInitialSettings,
  deserializeSettings,
  serializeSettings,
} from '../src/domain/settings';
import type { PurchaseRecord } from '../src/domain/types';

const purchases: PurchaseRecord[] = [
  {
    branch: 'Казань',
    clientName: 'Клиент Один',
    date: new Date('2026-01-21T15:15:00'),
    subscriptionName: 'Абонемент 12П скидка пк',
    paymentBasis: 'Покупка абонемента Абонемент 12П скидка пк #1.',
  },
  {
    branch: 'Казань',
    clientName: 'Клиент Два',
    date: new Date('2026-06-05T19:20:00'),
    subscriptionName: 'Абонемент 8П скидка пк',
    paymentBasis: 'Покупка абонемента Абонемент 8П скидка пк #2.',
  },
];

describe('settings domain', () => {
  it('создает стартовые настройки с периодом на диапазон выгрузки и пустыми ценами', () => {
    expect(createInitialSettings(purchases)).toEqual({
      cashbackPercent: 3,
      periods: [
        {
          id: expect.any(String),
          name: 'Основной период',
          startDate: '2026-01-21',
          endDate: '2026-06-05',
          pricesBySubscriptionName: {
            'Абонемент 12П скидка пк': null,
            'Абонемент 8П скидка пк': null,
          },
        },
      ],
    });
  });

  it('сериализует и десериализует настройки для JSON импорта/экспорта', () => {
    const settings = createInitialSettings(purchases);
    const serialized = serializeSettings(settings);

    expect(deserializeSettings(serialized)).toEqual(settings);
  });

  it('отклоняет некорректный JSON настроек', () => {
    expect(() => deserializeSettings('{bad json')).toThrow('Не удалось прочитать JSON настроек.');
    expect(() => deserializeSettings('{"periods":[]}')).toThrow(
      'Файл настроек не содержит корректный процент кешбека.',
    );
  });
});
