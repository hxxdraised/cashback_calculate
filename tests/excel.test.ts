import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getSubscriptionNames } from '../src/domain/cashback';
import { parsePurchasesWorkbook } from '../src/domain/excel';

describe('real Excel export', () => {
  it('читает текущую выгрузку из data и извлекает покупки абонементов', () => {
    const workbook = readFileSync('data/all_21.01.26_14.06.26.xlsx');
    const data = new Uint8Array(workbook).buffer;
    const purchases = parsePurchasesWorkbook(data);
    const subscriptionNames = getSubscriptionNames(purchases);

    expect(purchases.length).toBeGreaterThan(300);
    expect(purchases[0]).toMatchObject({
      clientName: 'Гузель Газизова Фаридовна',
      subscriptionName: 'Абонемент 12П скидка пк',
    });
    expect(subscriptionNames).toContain('Абонемент 8П скидка пк');
    expect(subscriptionNames).not.toContain('пробное занятие');
  });
});
