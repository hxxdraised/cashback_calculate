import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  CircleAlert,
  Download,
  FileDown,
  FileText,
  FileUp,
  Percent,
  Plus,
  ReceiptText,
  Settings,
  Trash2,
  Users,
  UserCheck,
  UserX,
  Wallet,
} from 'lucide-react';
import dataUrl from '../data/all_21.01.26_30.06.26.xlsx?url';
import {
  calculateClientSummaries,
  formatDateRu,
  getEligiblePurchases,
  getSubscriptionNames,
  validateSettings,
} from './domain/cashback';
import { createCashbackDocxBlob, downloadBlob, downloadTextFile, summariesToCsv } from './domain/export';
import { loadPurchasesFromUrl } from './domain/excel';
import {
  createInitialSettings,
  deserializeClientStatuses,
  deserializeSettings,
  normalizeSettingsForSubscriptions,
  serializeSettings,
} from './domain/settings';
import {
  loadStoredClientStatuses,
  loadStoredSettings,
  saveStoredClientStatuses,
  saveStoredSettings,
} from './domain/storage';
import type { CashbackSettings, ClientStatusMap, PricePeriod, PurchaseRecord } from './domain/types';

const numberFormat = new Intl.NumberFormat('ru-RU');
const rubleFormat = new Intl.NumberFormat('ru-RU');

type SortKey = 'isActive' | 'clientName' | 'purchasesCount' | 'calculatedTotal' | 'cashback';
type SortDirection = 'asc' | 'desc';

export default function App() {
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [settings, setSettings] = useState<CashbackSettings | null>(null);
  const [clientStatuses, setClientStatuses] = useState<ClientStatusMap>(() => {
    try {
      return loadStoredClientStatuses();
    } catch {
      return {};
    }
  });
  const [expandedPeriodIds, setExpandedPeriodIds] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({
    key: 'clientName',
    direction: 'asc',
  });
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
        setExpandedPeriodIds(new Set(nextSettings.periods.map((period) => period.id)));
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

  useEffect(() => {
    saveStoredClientStatuses(clientStatuses);
  }, [clientStatuses]);

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
  const reportRows = useMemo(
    () =>
      summaries.map((summary) => ({
        ...summary,
        isActive: clientStatuses[summary.clientName] ?? true,
      })),
    [clientStatuses, summaries],
  );
  const sortedReportRows = useMemo(() => {
    const directionMultiplier = sortConfig.direction === 'asc' ? 1 : -1;

    return [...reportRows].sort((left, right) => {
      let result = 0;

      if (sortConfig.key === 'clientName') {
        result = left.clientName.localeCompare(right.clientName, 'ru');
      } else if (sortConfig.key === 'isActive') {
        result = Number(left.isActive) - Number(right.isActive);
      } else {
        result = left[sortConfig.key] - right[sortConfig.key];
      }

      if (result === 0) {
        return left.clientName.localeCompare(right.clientName, 'ru');
      }

      return result * directionMultiplier;
    });
  }, [reportRows, sortConfig]);
  const activeClientsCount = reportRows.filter((row) => row.isActive).length;
  const inactiveClientsCount = reportRows.length - activeClientsCount;

  const dateRange = useMemo(() => {
    if (purchases.length === 0) {
      return 'нет данных';
    }

    return `${formatDateRu(purchases[0].date)} - ${formatDateRu(purchases[purchases.length - 1].date)}`;
  }, [purchases]);
  const docxDateRange = dateRange.replace(' - ', '-');

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
    const periodId = crypto.randomUUID();

    updateSettings((current) => ({
      ...current,
      periods: [
        ...current.periods,
        {
          id: periodId,
          name: `Период ${current.periods.length + 1}`,
          startDate: current.periods.at(-1)?.endDate ?? '',
          endDate: current.periods.at(-1)?.endDate ?? '',
          pricesBySubscriptionName: Object.fromEntries(subscriptionNames.map((name) => [name, null])),
        },
      ],
    }));
    setExpandedPeriodIds((current) => new Set(current).add(periodId));
  }

  function removePeriod(periodId: string) {
    updateSettings((current) => ({
      ...current,
      periods: current.periods.filter((period) => period.id !== periodId),
    }));
    setExpandedPeriodIds((current) => {
      const next = new Set(current);
      next.delete(periodId);
      return next;
    });
  }

  function togglePeriod(periodId: string) {
    setExpandedPeriodIds((current) => {
      const next = new Set(current);

      if (next.has(periodId)) {
        next.delete(periodId);
      } else {
        next.add(periodId);
      }

      return next;
    });
  }

  function exportSettings() {
    if (!settings) {
      return;
    }

    const exportedClientStatuses =
      reportRows.length > 0
        ? Object.fromEntries(reportRows.map((row) => [row.clientName, row.isActive]))
        : clientStatuses;

    downloadTextFile(
      'cashback-settings.json',
      serializeSettings(settings, exportedClientStatuses),
      'application/json;charset=utf-8',
    );
  }

  function exportCsv() {
    downloadTextFile('cashback-summary.csv', summariesToCsv(summaries), 'text/csv;charset=utf-8');
  }

  async function exportDocx() {
    const blob = await createCashbackDocxBlob(reportRows, docxDateRange, (value) => rubleFormat.format(value));
    downloadBlob('cashback-clients.docx', blob);
  }

  function updateClientStatus(clientName: string, isActive: boolean) {
    setClientStatuses((current) => ({
      ...current,
      [clientName]: isActive,
    }));
  }

  function toggleSort(key: SortKey) {
    setSortConfig((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  }

  function getSortLabel(key: SortKey, label: string): string {
    if (sortConfig.key !== key) {
      return `${label}: включить сортировку`;
    }

    return `${label}: сортировка ${sortConfig.direction === 'asc' ? 'по возрастанию' : 'по убыванию'}`;
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
        const importedClientStatuses = deserializeClientStatuses(content);

        setSettings(imported);
        if (importedClientStatuses) {
          setClientStatuses(importedClientStatuses);
        }
        setExpandedPeriodIds(new Set(imported.periods.map((period) => period.id)));
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
          <button type="button" className="button-with-icon secondary-button" onClick={exportSettings}>
            <FileDown size={17} aria-hidden="true" />
            Экспорт JSON
          </button>
          <button type="button" className="button-with-icon" onClick={() => importInputRef.current?.click()}>
            <FileUp size={17} aria-hidden="true" />
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
          <Metric icon={<ReceiptText size={22} aria-hidden="true" />} label="Покупок в Excel" value={String(purchases.length)} />
          <Metric icon={<BadgeCheck size={22} aria-hidden="true" />} label="Учитывается" value={String(eligiblePurchases.length)} />
          <Metric icon={<Wallet size={22} aria-hidden="true" />} label="Типов абонементов" value={String(subscriptionNames.length)} />
          <Metric icon={<CalendarDays size={22} aria-hidden="true" />} label="Период выгрузки" value={dateRange} />
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
              <h2 id="settings-title">
                <Settings size={20} aria-hidden="true" />
                Периоды цен
                {validationErrors.length > 0 ? (
                  <CircleAlert
                    className="validation-warning-icon"
                    size={18}
                    aria-label="Есть ошибки в настройке периодов"
                  />
                ) : null}
              </h2>
              <p className="section-copy">Заполните цены для каждого периода, чтобы расчет стал доступен.</p>
            </div>
          </div>

          <label className="cashback-input">
            <span>
              <Percent size={18} aria-hidden="true" />
              Процент кешбека
            </span>
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
            {settings.periods.map((period) => {
              const isExpanded = expandedPeriodIds.has(period.id);

              return (
                <article className={`period-block ${isExpanded ? 'period-block--open' : ''}`} key={period.id}>
                  <button
                    type="button"
                    className="period-summary"
                    aria-expanded={isExpanded}
                    onClick={() => togglePeriod(period.id)}
                  >
                    <CalendarDays className="period-summary-icon" size={19} aria-hidden="true" />
                    <span className="period-summary-main">
                      <strong>{period.name || 'Период без названия'}</strong>
                      <span>
                        {formatDateKeyRu(period.startDate) || 'дата начала'} -{' '}
                        {formatDateKeyRu(period.endDate) || 'дата окончания'}
                      </span>
                    </span>
                    <ChevronDown className="period-summary-chevron" size={20} aria-hidden="true" />
                  </button>

                  {isExpanded ? (
                    <div className="period-details">
                      <div className="period-controls">
                        <label className="period-name-field">
                          <span>Название</span>
                          <input
                            aria-label="Название периода"
                            className="period-name"
                            value={period.name}
                            onChange={(event) =>
                              updatePeriod(period.id, (item) => ({ ...item, name: event.target.value }))
                            }
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
                          className="ghost-button period-remove button-with-icon"
                          disabled={settings.periods.length === 1}
                          onClick={() => removePeriod(period.id)}
                        >
                          <Trash2 size={16} aria-hidden="true" />
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
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          <button type="button" className="button-with-icon add-period-button" onClick={addPeriod}>
            <Plus size={17} aria-hidden="true" />
            Добавить период
          </button>
        </section>

        <section className="results-panel" aria-labelledby="results-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Отчет</p>
              <h2 id="results-title">
                <Users size={20} aria-hidden="true" />
                Итог по клиентам
              </h2>
              <p className="section-copy">Отметьте клиентов с активным абонементом и экспортируйте нужный формат.</p>
            </div>
            <div className="report-actions">
              <button type="button" className="button-with-icon secondary-button" disabled={summaries.length === 0} onClick={exportDocx}>
                <FileText size={17} aria-hidden="true" />
                DOCX
              </button>
              <button type="button" className="button-with-icon" disabled={summaries.length === 0} onClick={exportCsv}>
                <Download size={17} aria-hidden="true" />
                CSV
              </button>
            </div>
          </div>

          <div className="report-counters" aria-label="Счетчики статусов клиентов">
            <div className="status-counter status-counter--active">
              <UserCheck size={18} aria-hidden="true" />
              <span>Активные</span>
              <strong>{activeClientsCount}</strong>
            </div>
            <div className="status-counter status-counter--inactive">
              <UserX size={18} aria-hidden="true" />
              <span>Неактивные</span>
              <strong>{inactiveClientsCount}</strong>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="number-column">№</th>
                  <th className="active-column" title="Активный абонемент" aria-label="Активный абонемент">
                    <SortableHeader
                      active={sortConfig.key === 'isActive'}
                      direction={sortConfig.direction}
                      label={getSortLabel('isActive', 'Активный абонемент')}
                      onClick={() => toggleSort('isActive')}
                    >
                      <BadgeCheck size={17} aria-hidden="true" />
                    </SortableHeader>
                  </th>
                  <th>
                    <SortableHeader
                      active={sortConfig.key === 'clientName'}
                      direction={sortConfig.direction}
                      label={getSortLabel('clientName', 'Клиент')}
                      onClick={() => toggleSort('clientName')}
                    >
                      Клиент
                    </SortableHeader>
                  </th>
                  <th>
                    <SortableHeader
                      active={sortConfig.key === 'purchasesCount'}
                      direction={sortConfig.direction}
                      label={getSortLabel('purchasesCount', 'Покупок')}
                      onClick={() => toggleSort('purchasesCount')}
                    >
                      Покупок
                    </SortableHeader>
                  </th>
                  <th>
                    <SortableHeader
                      active={sortConfig.key === 'calculatedTotal'}
                      direction={sortConfig.direction}
                      label={getSortLabel('calculatedTotal', 'Потрачено')}
                      onClick={() => toggleSort('calculatedTotal')}
                    >
                      Потрачено
                    </SortableHeader>
                  </th>
                  <th>
                    <SortableHeader
                      active={sortConfig.key === 'cashback'}
                      direction={sortConfig.direction}
                      label={getSortLabel('cashback', 'Кешбек')}
                      onClick={() => toggleSort('cashback')}
                    >
                      Кешбек
                    </SortableHeader>
                  </th>
                </tr>
              </thead>
              <tbody>
                {summaries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-cell">
                      Заполните цены и исправьте ошибки валидации, чтобы увидеть расчет.
                    </td>
                  </tr>
                ) : (
                  sortedReportRows.map((summary, index) => (
                    <tr key={summary.clientName}>
                      <td className="number-column">{index + 1}</td>
                      <td className="active-column">
                        <label className="status-checkbox" title={summary.isActive ? 'Активен' : 'Неактивен'}>
                          <input
                            type="checkbox"
                            checked={summary.isActive}
                            onChange={(event) => updateClientStatus(summary.clientName, event.target.checked)}
                          />
                          <span className="visually-hidden">
                            {summary.isActive ? 'Активен' : 'Неактивен'}: {summary.clientName}
                          </span>
                        </label>
                      </td>
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

function formatDateKeyRu(dateKey: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return '';
  }

  const [year, month, day] = dateKey.split('-');
  return `${day}.${month}.${year}`;
}

function SortableHeader({
  active,
  children,
  direction,
  label,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  direction: SortDirection;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`sort-button ${active ? 'sort-button--active' : ''}`}
      aria-label={label}
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      onClick={onClick}
    >
      <span>{children}</span>
      {!active ? <ArrowUpDown size={14} aria-hidden="true" /> : null}
      {active && direction === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> : null}
      {active && direction === 'desc' ? <ArrowDown size={14} aria-hidden="true" /> : null}
    </button>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      <span className="metric-icon">{icon}</span>
      <div>
        <span className="metric-label">{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function Notice({ tone, messages }: { tone: 'danger' | 'warning'; messages: string[] }) {
  return (
    <section className={`notice notice--${tone}`} role="status">
      <strong>
        <CircleAlert size={18} aria-hidden="true" />
        {tone === 'danger' ? 'Ошибка' : 'Нужно заполнить'}
      </strong>
      <ul>
        {messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </section>
  );
}
