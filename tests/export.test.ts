import { describe, expect, it } from 'vitest';
import { createCashbackDocxBlob } from '../src/domain/export';

describe('docx export', () => {
  it('creates a docx blob with active and inactive client sections', async () => {
    const blob = await createCashbackDocxBlob(
      [
        {
          clientName: 'Юлия Колесникова',
          purchasesCount: 1,
          calculatedTotal: 16000,
          cashback: 480,
          isActive: true,
        },
        {
          clientName: 'Анна Иванова',
          purchasesCount: 1,
          calculatedTotal: 10000,
          cashback: 300,
          isActive: false,
        },
      ],
      '21.01.2026-05.06.2026',
      (value) => String(value),
    );

    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(blob.size).toBeGreaterThan(0);
  });
});
