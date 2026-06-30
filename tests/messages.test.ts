import { describe, expect, it } from 'vitest';
import { normalizeMessageTemplates, renderClientMessage } from '../src/domain/messages';
import type { ClientCashbackExportRow, MessageTemplatesSettings } from '../src/domain/types';

const client: ClientCashbackExportRow = {
  clientName: 'Юлия Колесникова',
  purchasesCount: 2,
  calculatedTotal: 16000,
  cashback: 480,
  isActive: true,
};

describe('message templates', () => {
  it('renders base template with client variables', () => {
    const settings: MessageTemplatesSettings = {
      baseTemplate: '{{clientName}} - {{cashback}} руб, статус: {{status}}',
      conditionalTemplates: [],
    };

    expect(renderClientMessage(client, settings)).toBe('Юлия Колесникова - 480 руб, статус: активен');
  });

  it('uses the first matching conditional template', () => {
    const settings: MessageTemplatesSettings = {
      baseTemplate: 'base',
      conditionalTemplates: [
        {
          id: 'one',
          field: 'cashback',
          operator: 'gt',
          value: 300,
          text: 'Бонус {{cashback}}',
        },
      ],
    };

    expect(renderClientMessage(client, settings)).toBe('Бонус 480');
  });

  it('calculates arithmetic expressions with numeric client variables', () => {
    const settings: MessageTemplatesSettings = {
      baseTemplate: '6800-{{cashback}}={{6800-cashback}}; со скидкой {{(calculatedTotal/2)-cashback}}',
      conditionalTemplates: [],
    };

    expect(renderClientMessage(client, settings)).toBe('6800-480=6320; со скидкой 7520');
  });

  it('leaves unknown or unsafe expressions unchanged', () => {
    const settings: MessageTemplatesSettings = {
      baseTemplate: '{{clientName-cashback}} {{6800/0}}',
      conditionalTemplates: [],
    };

    expect(renderClientMessage(client, settings)).toBe('{{clientName-cashback}} {{6800/0}}');
  });

  it('normalizes invalid template settings', () => {
    expect(
      normalizeMessageTemplates({
        baseTemplate: 'Привет',
        conditionalTemplates: [{ id: 'bad', field: 'unknown', operator: 'gt', value: 1, text: 'bad' }],
      }),
    ).toEqual({
      baseTemplate: 'Привет',
      conditionalTemplates: [],
    });
  });
});
