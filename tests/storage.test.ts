import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadStoredClientStatuses,
  loadStoredMessageTemplates,
  saveStoredClientStatuses,
  saveStoredMessageTemplates,
} from '../src/domain/storage';

describe('client status storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('stores and loads manual client active statuses', () => {
    saveStoredClientStatuses({
      'Анна Иванова': true,
      'Юлия Колесникова': false,
    });

    expect(loadStoredClientStatuses()).toEqual({
      'Анна Иванова': true,
      'Юлия Колесникова': false,
    });
  });

  it('ignores invalid status values', () => {
    localStorage.setItem(
      'cashback-calculate-client-statuses',
      JSON.stringify({
        'Анна Иванова': true,
        'Ошибка': 'yes',
      }),
    );

    expect(loadStoredClientStatuses()).toEqual({
      'Анна Иванова': true,
    });
  });

  it('stores and loads message templates', () => {
    const templates = {
      baseTemplate: 'Здравствуйте, {{clientName}}',
      conditionalTemplates: [
        {
          id: 'cashback',
          field: 'cashback' as const,
          operator: 'gt' as const,
          value: 300,
          text: 'Кешбек {{cashback}}',
        },
      ],
    };

    saveStoredMessageTemplates(templates);

    expect(loadStoredMessageTemplates()).toEqual(templates);
  });
});
