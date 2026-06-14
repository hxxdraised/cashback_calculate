import type {
  CashbackSettings,
  ClientCashbackSummary,
  PricePeriod,
  PurchaseCalculation,
  PurchaseRecord,
} from './types';

export const excludedSubscriptionNames = new Set([
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
]);

export function extractSubscriptionName(paymentBasis: string): string {
  const prefix = 'Покупка абонемента';
  let value = paymentBasis.trim();

  if (value.startsWith(prefix)) {
    value = value.slice(prefix.length).trim();
  }

  const hashIndex = value.lastIndexOf('#');
  if (hashIndex >= 0) {
    value = value.slice(0, hashIndex).trim();
  }

  return value.replace(/\s+/g, ' ').replace(/\.$/, '').trim();
}

export function getEligiblePurchases(purchases: PurchaseRecord[]): PurchaseRecord[] {
  return purchases.filter((purchase) => !excludedSubscriptionNames.has(purchase.subscriptionName));
}

export function getSubscriptionNames(purchases: PurchaseRecord[]): string[] {
  return Array.from(new Set(getEligiblePurchases(purchases).map((purchase) => purchase.subscriptionName))).sort((a, b) =>
    a.localeCompare(b, 'ru'),
  );
}

export function findPeriodForDate(date: Date, periods: PricePeriod[]): PricePeriod | undefined {
  const dateKey = toDateKey(date);

  return periods.find((period) => dateKey >= period.startDate && dateKey <= period.endDate);
}

export function calculatePurchaseDetails(
  purchases: PurchaseRecord[],
  settings: CashbackSettings,
): PurchaseCalculation[] {
  return getEligiblePurchases(purchases).map((purchase) => {
    const period = findPeriodForDate(purchase.date, settings.periods);
    if (!period) {
      throw new Error(`Покупка от ${formatDateRu(purchase.date)} не попадает ни в один период цен.`);
    }

    const price = period.pricesBySubscriptionName[purchase.subscriptionName];
    if (typeof price !== 'number' || Number.isNaN(price)) {
      throw new Error(`В периоде "${period.name}" не указана цена для "${purchase.subscriptionName}".`);
    }

    return {
      purchase,
      period,
      price,
      cashback: (price * settings.cashbackPercent) / 100,
    };
  });
}

export function calculateClientSummaries(
  purchases: PurchaseRecord[],
  settings: CashbackSettings,
): ClientCashbackSummary[] {
  const grouped = new Map<string, { purchasesCount: number; calculatedTotal: number }>();

  for (const detail of calculatePurchaseDetails(purchases, settings)) {
    const current = grouped.get(detail.purchase.clientName) ?? {
      purchasesCount: 0,
      calculatedTotal: 0,
    };

    current.purchasesCount += 1;
    current.calculatedTotal += detail.price;
    grouped.set(detail.purchase.clientName, current);
  }

  return Array.from(grouped.entries())
    .map(([clientName, value]) => ({
      clientName,
      purchasesCount: value.purchasesCount,
      calculatedTotal: value.calculatedTotal,
      cashback: Math.floor((value.calculatedTotal * settings.cashbackPercent) / 100),
    }))
    .sort((left, right) => left.clientName.localeCompare(right.clientName, 'ru'));
}

export function validateSettings(purchases: PurchaseRecord[], settings: CashbackSettings): string[] {
  const errors: string[] = [];
  const eligiblePurchases = getEligiblePurchases(purchases);
  const subscriptionNames = getSubscriptionNames(purchases);

  if (!Number.isFinite(settings.cashbackPercent) || settings.cashbackPercent < 0) {
    errors.push('Процент кешбека должен быть числом не меньше 0.');
  }

  if (settings.periods.length === 0) {
    errors.push('Добавьте хотя бы один период цен.');
    return errors;
  }

  const sortedPeriods = [...settings.periods].sort((left, right) => left.startDate.localeCompare(right.startDate));
  for (const period of sortedPeriods) {
    if (!period.startDate || !period.endDate) {
      errors.push(`В периоде "${period.name}" нужно указать дату начала и окончания.`);
    } else if (period.startDate > period.endDate) {
      errors.push(`В периоде "${period.name}" дата начала позже даты окончания.`);
    }
  }

  for (let index = 1; index < sortedPeriods.length; index += 1) {
    const previous = sortedPeriods[index - 1];
    const current = sortedPeriods[index];

    if (previous.endDate >= current.startDate) {
      errors.push(`Периоды "${previous.name}" и "${current.name}" пересекаются.`);
    }
  }

  for (const range of findUncoveredDateRanges(eligiblePurchases, sortedPeriods)) {
    errors.push(`Не настроен период цен: ${formatDateRu(range.start)} - ${formatDateRu(range.end)}.`);
  }

  for (const period of settings.periods) {
    for (const subscriptionName of subscriptionNames) {
      const price = period.pricesBySubscriptionName[subscriptionName];
      if (typeof price !== 'number' || Number.isNaN(price) || price < 0) {
        errors.push(`В периоде "${period.name}" не указана цена для "${subscriptionName}".`);
      }
    }
  }

  return Array.from(new Set(errors));
}

function findUncoveredDateRanges(
  purchases: PurchaseRecord[],
  sortedPeriods: PricePeriod[],
): Array<{ start: Date; end: Date }> {
  if (purchases.length === 0) {
    return [];
  }

  const sortedPurchaseDates = purchases.map((purchase) => toDateKey(purchase.date)).sort();
  const firstPurchaseDate = sortedPurchaseDates[0];
  const lastPurchaseDate = sortedPurchaseDates[sortedPurchaseDates.length - 1];
  const ranges: Array<{ start: Date; end: Date }> = [];
  let nextUncoveredStart = firstPurchaseDate;

  for (const period of sortedPeriods) {
    if (!period.startDate || !period.endDate || period.startDate > period.endDate) {
      continue;
    }

    if (period.endDate < nextUncoveredStart) {
      continue;
    }

    if (period.startDate > lastPurchaseDate) {
      break;
    }

    if (period.startDate > nextUncoveredStart) {
      ranges.push({
        start: parseDateKey(nextUncoveredStart),
        end: parseDateKey(addDays(period.startDate, -1)),
      });
    }

    if (period.endDate >= nextUncoveredStart) {
      nextUncoveredStart = addDays(period.endDate, 1);
    }

    if (nextUncoveredStart > lastPurchaseDate) {
      return ranges;
    }
  }

  if (nextUncoveredStart <= lastPurchaseDate) {
    ranges.push({
      start: parseDateKey(nextUncoveredStart),
      end: parseDateKey(lastPurchaseDate),
    });
  }

  return ranges;
}

function addDays(dateKey: string, days: number): string {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatDateRu(date: Date): string {
  return new Intl.DateTimeFormat('ru-RU').format(date);
}
