import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('period form markup', () => {
  it('renders subscription prices as a two-column table', () => {
    const source = readFileSync('src/App.tsx', 'utf8');

    expect(source).toContain('className="price-table"');
    expect(source).toContain('<th>Абонемент</th>');
    expect(source).toContain('<th>Цена</th>');
  });

  it('keeps periods collapsible and client results numbered', () => {
    const source = readFileSync('src/App.tsx', 'utf8');

    expect(source).toContain('className="period-summary"');
    expect(source).toContain('aria-expanded={isExpanded}');
    expect(source).toContain('className="number-column"');
  });

  it('renders client activity controls and docx export', () => {
    const source = readFileSync('src/App.tsx', 'utf8');

    expect(source).toContain('className="active-column"');
    expect(source).toContain('type="checkbox"');
    expect(source).toContain('exportDocx');
  });

  it('shows a compact warning icon near period settings when validation fails', () => {
    const source = readFileSync('src/App.tsx', 'utf8');

    expect(source).toContain('className="validation-warning-icon"');
    expect(source).toContain('Есть ошибки в настройке периодов');
  });

  it('formats period accordions and places add period action below the list', () => {
    const source = readFileSync('src/App.tsx', 'utf8');
    const styles = readFileSync('src/styles.css', 'utf8');

    expect(source).toContain('formatDateKeyRu(period.startDate)');
    expect(source).toContain('className="period-summary-icon"');
    expect(source).toContain('className="button-with-icon add-period-button"');
    expect(styles).toContain('.add-period-button');
    expect(styles).toContain('width: 100%');
  });

  it('renders sortable report table headers', () => {
    const source = readFileSync('src/App.tsx', 'utf8');
    const styles = readFileSync('src/styles.css', 'utf8');

    expect(source).toContain('type SortKey');
    expect(source).toContain('function SortableHeader');
    expect(source).toContain('toggleSort');
    expect(source).toContain('sortedReportRows.map');
    expect(source).toContain('<ArrowUpDown size={14}');
    expect(source).toContain('<ArrowUp size={14}');
    expect(source).toContain('<ArrowDown size={14}');
    expect(styles).toContain('.sort-button');
  });

  it('renders message template settings and client message modal hooks', () => {
    const source = readFileSync('src/App.tsx', 'utf8');
    const styles = readFileSync('src/styles.css', 'utf8');

    expect(source).toContain('Шаблоны сообщений');
    expect(source).toContain('messageTemplatesCount');
    expect(source).toContain('renderClientMessage');
    expect(source).toContain('setSelectedClient(summary)');
    expect(source).toContain('serializeSettings(settings, exportedClientStatuses, messageTemplates)');
    expect(source).toContain('deserializeMessageTemplates(content)');
    expect(styles).toContain('.settings-item');
    expect(styles).toContain('.modal-panel');
    expect(styles).toContain('.variable-button');
  });
});
