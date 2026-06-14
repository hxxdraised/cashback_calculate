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
});
