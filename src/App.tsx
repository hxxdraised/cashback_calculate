import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import dataUrl from '../data/all_21.01.26_30.06.26.xlsx?url';
import {
  calculateClientSummaries,
  formatDateRu,
  getEligiblePurchases,
  getSubscriptionNames,
  validateSettings,
} from './domain/cashback';
import { downloadTextFile, summariesToCsv } from './domain/export';
import { loadPurchasesFromUrl } from './domain/excel';
import {
  createInitialSettings,
  deserializeSettings,
  normalizeSettingsForSubscriptions,
  serializeSettings,
} from './domain/settings';
import { loadStoredSettings, saveStoredSettings } from './domain/storage';
import type { CashbackSettings, PricePeriod, PurchaseRecord } from './domain/types';

const numberFormat = new Intl.NumberFormat('ru-RU');

export default function App() {
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [settings, setSettings] = useState<CashbackSettings | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('Загружаем выгрузку из data...');
  const [importError, setImportError] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    loadPurchasesFromUrl(dataUrl)
      .then((loadedPurchases) => {
        if (!active) {
          return;
        }

        const subscriptionNames = getSubscriptionNames(loadedPurchases);
        let nextSettings: CashbackSettings;

        try {
          const stored = loadStoredSettings();
          nextSettings = stored
            ? normalizeSettingsForSubscriptions(stored, subscriptionNames)
            : createInitialSettings(loadedPurchases);
        } catch {
          nextSettings = createInitialSettings(loadedPurchases);
        }

        setPurchases(loadedPurchases);
        setSettings(nextSettings);
        setLoadingMessage('');
      })
      .catch((error: unknown) => {
        if (!active) {
          return;
        }

        setLoadingMessage(error instanceof Error ? error.message : 'Не удалось загрузить выгрузку.');
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (settings) {
      saveStoredSettings(settings);
    }
  }, [settings]);

  const subscriptionNames = useMemo(() => getSubscriptionNames(purchases), [purchases]);
  const eligiblePurchases = useMemo(() => getEligiblePurchases(purchases), [purchases]);
  const validationErrors = useMemo(
    () => (settings ? validateSettings(purchases, settings) : []),
    [purchases, settings],
  );
  const summaries = useMemo(() => {
    if (!settings || validationErrors.length > 0) {
      return [];
    }

    return calculateClientSummaries(purchases, settings);
  }, [purchases, settings, validationErrors]);

  const dateRange = useMemo(() => {
    if (purchases.length === 0) {
      return 'нет данных';
    }

    return `${formatDateRu(purchases[0].date)} - ${formatDateRu(purchases[purchases.length - 1].date)}`;
  }, [purchases]);

  if (loadingMessage) {
    return (
      <main className="app app--centered">
        <section className="status-panel">
          <span className="loader" aria-hidden="true" />
          <p>{loadingMessage}</p>
        </section>
      </main>
    );
  }

  if (!settings) {
    return null;
  }

  function updateSettings(updater: (current: CashbackSettings) => CashbackSettings) {
    setSettings((current) => (current ? updater(current) : current));
  }

  function updatePeriod(periodId: string, updater: (period: PricePeriod) => PricePeriod) {
    updateSettings((current) => ({
      ...current,
      periods: current.periods.map((period) => (period.id === periodId ? updater(period) : period)),
    }));
  }

  function addPeriod() {
    updateSettings((current) => ({
      ...current,
      periods: [
        ...current.periods,
        {
          id: crypto.randomUUID(),
          name: `Период ${current.periods.length + 1}`,
          startDate: current.periods.at(-1)?.endDate ?? '',
          endDate: current.periods.at(-1)?.endDate ?? '',
          pricesBySubscriptionName: Object.fromEntries(subscriptionNames.map((name) => [name, null])),
        },
      ],
    }));
  }

  function removePeriod(periodId: string) {
    updateSettings((current) => ({
      ...current,
      periods: current.periods.filter((period) => period.id !== periodId),
    }));
  }

  function exportSettings() {
    if (!settings) {
      return;
    }

    downloadTextFile('cashback-settings.json', serializeSettings(settings), 'application/json;charset=utf-8');
  }

  function exportCsv() {
    downloadTextFile('cashback-summary.csv', summariesToCsv(summaries), 'text/csv;charset=utf-8');
  }

  function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    file
      .text()
      .then((content) => {
        const imported = normalizeSettingsForSubscriptions(deserializeSettings(content), subscriptionNames);
        setSettings(imported);
        setImportError('');
      })
      .catch((error: unknown) => {
        setImportError(error instanceof Error ? error.message : 'Не удалось импортировать настройки.');
      })
      .finally(() => {
        event.target.value = '';
      });
  }

  return (
    <main className="app">
      <header className="page-header">
        <div className="header-content">
          <p className="eyebrow">Локальный расчет</p>
          <h1>Кешбек по абонементам</h1>
          <p className="header-copy">
            Выгрузка из папки data, расчетные цены из периодов, итог по ФИО клиента.
          </p>
        </div>
        <div className="header-actions">
          <button type="button" onClick={exportSettings}>
            Экспорт JSON
          </button>
          <button type="button" onClick={() => importInputRef.current?.click()}>
            Импорт JSON
          </button>
          <input
            ref={importInputRef}
            className="visually-hidden"
            type="file"
            accept="application/json,.json"
            onChange={handleImport}
          />
        </div>
      </header>

      <section className="overview-band" aria-label="Сводка выгрузки">
        <div className="metrics">
          <Metric label="Покупок в Excel" value={String(purchases.length)} />
          <Metric label="Учитывается" value={String(eligiblePurchases.length)} />
          <Metric label="Типов абонементов" value={String(subscriptionNames.length)} />
          <Metric label="Период выгрузки" value={dateRange} />
        </div>
      </section>

      <div className="notice-stack">
        {importError ? <Notice tone="danger" messages={[importError]} /> : null}
        {validationErrors.length > 0 ? <Notice tone="warning" messages={validationErrors} /> : null}
      </div>

      <section className="workspace">
        <section className="settings-panel" aria-labelledby="settings-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Настройки</p>
              <h2 id="settings-title">Периоды цен</h2>
              <p className="section-copy">Заполните цены для каждого периода, чтобы расчет стал доступен.</p>
            </div>
            <button type="button" onClick={addPeriod}>
              Добавить период
            </button>
          </div>

          <label className="cashback-input">
            <span>Процент кешбека</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={settings.cashbackPercent}
              onChange={(event) =>
                updateSettings((current) => ({
                  ...current,
                  cashbackPercent: Number(event.target.value),
                }))
              }
            />
          </label>

          <div className="period-list">
            {settings.periods.map((period) => (
              <article className="period-block" key={period.id}>
                <div className="period-block-title">
                  <strong>{period.name || 'Период без названия'}</strong>
                  <span>
                    {period.startDate || 'дата начала'} - {period.endDate || 'дата окончания'}
                  </span>
                </div>
                <div className="period-controls">
                  <label className="period-name-field">
                    <span>Название</span>
                    <input
                      aria-label="Название периода"
                      className="period-name"
                      value={period.name}
                      onChange={(event) => updatePeriod(period.id, (item) => ({ ...item, name: event.target.value }))}
                    />
                  </label>
                  <label>
                    <span>С</span>
                    <input
                      type="date"
                      value={period.startDate}
                      onChange={(event) =>
                        updatePeriod(period.id, (item) => ({ ...item, startDate: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    <span>По</span>
                    <input
                      type="date"
                      value={period.endDate}
                      onChange={(event) =>
                        updatePeriod(period.id, (item) => ({ ...item, endDate: event.target.value }))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="ghost-button period-remove"
                    disabled={settings.periods.length === 1}
                    onClick={() => removePeriod(period.id)}
                  >
                    Удалить
                  </button>
                </div>
                <div className="price-table-wrap">
                  <table className="price-table">
                    <thead>
                      <tr>
                        <th>Абонемент</th>
                        <th>Цена</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subscriptionNames.map((name) => (
                        <tr key={name}>
                          <td>{name}</td>
                          <td>
                            <input
                              aria-label={`Цена: ${name}`}
                              className="price-input"
                              type="number"
                              min="0"
                              step="1"
                              value={period.pricesBySubscriptionName[name] ?? ''}
                              onChange={(event) =>
                                updatePeriod(period.id, (item) => ({
                                  ...item,
                                  pricesBySubscriptionName: {
                                    ...item.pricesBySubscriptionName,
                                    [name]: event.target.value === '' ? null : Number(event.target.value),
                                  },
                                }))
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="results-panel" aria-labelledby="results-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Отчет</p>
              <h2 id="results-title">Итог по клиентам</h2>
              <p className="section-copy">CSV экспортирует текущую сводку после успешной валидации.</p>
            </div>
            <button type="button" disabled={summaries.length === 0} onClick={exportCsv}>
              Экспорт CSV
            </button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Клиент</th>
                  <th>Покупок</th>
                  <th>Расчетная сумма</th>
                  <th>Кешбек</th>
                </tr>
              </thead>
              <tbody>
                {summaries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="empty-cell">
                      Заполните цены и исправьте ошибки валидации, чтобы увидеть расчет.
                    </td>
                  </tr>
                ) : (
                  summaries.map((summary) => (
                    <tr key={summary.clientName}>
                      <td>{summary.clientName}</td>
                      <td>{summary.purchasesCount}</td>
                      <td>{numberFormat.format(summary.calculatedTotal)} ₽</td>
                      <td className="cashback-cell">{numberFormat.format(summary.cashback)} ₽</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Notice({ tone, messages }: { tone: 'danger' | 'warning'; messages: string[] }) {
  return (
    <section className={`notice notice--${tone}`} role="status">
      <strong>{tone === 'danger' ? 'Ошибка' : 'Нужно заполнить'}</strong>
      <ul>
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </section>
  );
}
