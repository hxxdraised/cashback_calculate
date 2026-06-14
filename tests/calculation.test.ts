import { describe, expect, it } from 'vitest';
import {
  calculateClientSummaries,
  excludedSubscriptionNames,
  extractSubscriptionName,
  validateSettings,
} from '../src/domain/cashback';
import type { CashbackSettings, PurchaseRecord } from '../src/domain/types';

const purchases: PurchaseRecord[] = [
  {
    branch: 'Казань Ягодная Слобода',
    clientName: 'Ирина Клиентова',
    date: new Date('2026-01-22T10:00:00'),
    subscriptionName: 'Абонемент 12П скидка пк',
    paymentBasis: 'Покупка абонемента  Абонемент 12П скидка пк  #6527.',
  },
  {
    branch: 'Казань Ягодная Слобода',
    clientName: 'Ирина Клиентова',
    date: new Date('2026-02-02T10:00:00'),
    subscriptionName: 'Абонемент 8П без скидки',
    paymentBasis: 'Покупка абонемента  Абонемент 8П без скидки  #6600.',
  },
  {
    branch: 'Казань Ягодная Слобода',
    clientName: 'Ирина Клиентова',
    date: new Date('2026-02-03T10:00:00'),
    subscriptionName: 'пробное занятие',
    paymentBasis: 'Покупка абонемента  пробное занятие  #6601.',
  },
  {
    branch: 'Казань Ягодная Слобода',
    clientName: 'Алина Новая',
    date: new Date('2026-03-04T10:00:00'),
    subscriptionName: 'Абонемент 4П скидка пк',
    paymentBasis: 'Покупка абонемента  Абонемент 4П скидка пк  #6602.',
  },
  {
    branch: 'Казань Ягодная Слобода',
    clientName: 'Алина Новая',
    date: new Date('2026-03-05T10:00:00'),
    subscriptionName: 'персональное занятие йога пилатес',
    paymentBasis: 'Покупка абонемента  персональное занятие йога пилатес  #6603.',
  },
  {
    branch: 'Казань Ягодная Слобода',
    clientName: 'Ирина Клиентова',
    date: new Date('2026-03-06T10:00:00'),
    subscriptionName: 'персональное занятие прочее',
    paymentBasis: 'Покупка абонемента  персональное занятие прочее  #6604.',
  },
];

const settings: CashbackSettings = {
  cashbackPercent: 3,
  periods: [
    {
      id: 'winter',
      name: 'Зима',
      startDate: '2026-01-01',
      endDate: '2026-02-28',
      pricesBySubscriptionName: {
        'Абонемент 12П скидка пк': 6800,
        'Абонемент 8П без скидки': 5600,
        'Абонемент 4П скидка пк': 3000,
      },
    },
    {
      id: 'spring',
      name: 'Весна',
      startDate: '2026-03-01',
      endDate: '2026-06-30',
      pricesBySubscriptionName: {
        'Абонемент 12П скидка пк': 7000,
        'Абонемент 8П без скидки': 5900,
        'Абонемент 4П скидка пк': 3300,
      },
    },
  ],
};

describe('cashback domain', () => {
  it('извлекает точное название абонемента из основания платежа', () => {
    expect(extractSubscriptionName('Покупка абонемента  Абонемент 12П скидка пк  #6527.')).toBe(
      'Абонемент 12П скидка пк',
    );
  });

  it('хранит полный список исключенных типов покупок', () => {
    expect(excludedSubscriptionNames).toEqual(
      new Set([
        'Пробное 3 занятия',
        'разовое посещение',
        'пробное персональное йога/пилатес',
        'бартер 51 занятие',
        'бесплатное занятие',
        'занятие втроём со скидкой',
        'парное занятие',
        'пробное занятие',
        '2 занятия выигрыш',
        'персональное занятие йога пилатес',
        'персональное занятие прочее',
      ]),
    );
  });

  it('считает сводку по ФИО, игнорирует исключенные покупки и округляет кешбек вниз', () => {
    const summaries = calculateClientSummaries(purchases, settings);

    expect(summaries).toEqual([
      {
        clientName: 'Алина Новая',
        purchasesCount: 1,
        calculatedTotal: 3300,
        cashback: 99,
      },
      {
        clientName: 'Ирина Клиентова',
        purchasesCount: 2,
        calculatedTotal: 12400,
        cashback: 372,
      },
    ]);
  });

  it('валидирует покрытие всех покупок периодами и заполнение цен', () => {
    expect(validateSettings(purchases, settings)).toEqual([]);

    const brokenSettings: CashbackSettings = {
      cashbackPercent: 3,
      periods: [
        {
          id: 'short',
          name: 'Короткий период',
          startDate: '2026-01-01',
          endDate: '2026-01-31',
          pricesBySubscriptionName: {
            'Абонемент 12П скидка пк': 6800,
          },
        },
      ],
    };

    expect(validateSettings(purchases, brokenSettings)).toEqual(expect.arrayContaining([
      'Не настроен период цен: 01.02.2026 - 04.03.2026.',
      'В периоде "Короткий период" не указана цена для "Абонемент 8П без скидки".',
      'В периоде "Короткий период" не указана цена для "Абонемент 4П скидка пк".',
    ]));
    expect(validateSettings(purchases, brokenSettings)).toHaveLength(3);
  });
});
