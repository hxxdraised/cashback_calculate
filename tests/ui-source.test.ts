import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('period form markup', () => {
  it('renders subscription prices as a two-column table', () => {
    const source = readFileSync('src/App.tsx', 'utf8');

    expect(source).toContain('className="price-table"');
    expect(source).toContain('<th>Абонемент</th>');
    expect(source).toContain('<th>Цена</th>');
  });
});
