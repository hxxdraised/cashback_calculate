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
});
