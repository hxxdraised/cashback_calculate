import { beforeEach, describe, expect, it } from 'vitest';
import { loadStoredClientStatuses, saveStoredClientStatuses } from '../src/domain/storage';

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
});
