import type {
  ClientCashbackExportRow,
  ConditionalMessageTemplate,
  MessageConditionField,
  MessageConditionOperator,
  MessageTemplatesSettings,
} from './types';

export const messageTemplateVariables = [
  { key: 'clientName', label: 'Клиент' },
  { key: 'purchasesCount', label: 'Покупок' },
  { key: 'calculatedTotal', label: 'Потрачено' },
  { key: 'cashback', label: 'Кешбек' },
  { key: 'status', label: 'Статус' },
] as const;

export const messageConditionFields: Array<{ value: MessageConditionField; label: string }> = [
  { value: 'purchasesCount', label: 'Покупок' },
  { value: 'calculatedTotal', label: 'Потрачено' },
  { value: 'cashback', label: 'Кешбек' },
];

export const messageConditionOperators: Array<{ value: MessageConditionOperator; label: string }> = [
  { value: 'gt', label: 'больше' },
  { value: 'lt', label: 'меньше' },
  { value: 'eq', label: 'равняется' },
];

export const defaultMessageTemplates: MessageTemplatesSettings = {
  baseTemplate:
    'Здравствуйте, {{clientName}}! Ваш кешбек по абонементам: {{cashback}} руб. Всего покупок: {{purchasesCount}}, потрачено: {{calculatedTotal}} руб.',
  conditionalTemplates: [],
};

export function normalizeMessageTemplates(value: unknown): MessageTemplatesSettings {
  if (!isRecord(value)) {
    return defaultMessageTemplates;
  }

  return {
    baseTemplate: typeof value.baseTemplate === 'string' ? value.baseTemplate : defaultMessageTemplates.baseTemplate,
    conditionalTemplates: Array.isArray(value.conditionalTemplates)
      ? value.conditionalTemplates
          .map(parseConditionalTemplate)
          .filter((template): template is ConditionalMessageTemplate => Boolean(template))
      : [],
  };
}

export function renderClientMessage(row: ClientCashbackExportRow, settings: MessageTemplatesSettings): string {
  const matchedTemplate = settings.conditionalTemplates.find((template) => isConditionMatched(row, template));
  const templateText = matchedTemplate?.text.trim() ? matchedTemplate.text : settings.baseTemplate;

  return renderTemplate(templateText, row);
}

function renderTemplate(template: string, row: ClientCashbackExportRow): string {
  const values: Record<string, string> = {
    clientName: row.clientName,
    purchasesCount: String(row.purchasesCount),
    calculatedTotal: String(row.calculatedTotal),
    cashback: String(row.cashback),
    status: row.isActive ? 'активен' : 'неактивен',
  };

  const numericValues: Record<string, number> = {
    purchasesCount: row.purchasesCount,
    calculatedTotal: row.calculatedTotal,
    cashback: row.cashback,
  };

  return template.replace(/\{\{([^{}]+)\}\}/g, (match, rawExpression: string) => {
    const expression = rawExpression.trim();

    if (expression in values) {
      return values[expression];
    }

    const calculatedValue = calculateTemplateExpression(expression, numericValues);
    return calculatedValue === null ? match : formatTemplateNumber(calculatedValue);
  });
}

function calculateTemplateExpression(expression: string, variables: Record<string, number>): number | null {
  const tokens = tokenizeExpression(expression);

  if (!tokens) {
    return null;
  }

  const expressionTokens = tokens;
  let cursor = 0;

  function peek() {
    return expressionTokens[cursor];
  }

  function consume() {
    const token = expressionTokens[cursor];
    cursor += 1;
    return token;
  }

  function parseExpression(): number | null {
    let value = parseTerm();

    while (value !== null && (peek() === '+' || peek() === '-')) {
      const operator = consume();
      const right = parseTerm();

      if (right === null) {
        return null;
      }

      value = operator === '+' ? value + right : value - right;
    }

    return value;
  }

  function parseTerm(): number | null {
    let value = parseFactor();

    while (value !== null && (peek() === '*' || peek() === '/')) {
      const operator = consume();
      const right = parseFactor();

      if (right === null || (operator === '/' && right === 0)) {
        return null;
      }

      value = operator === '*' ? value * right : value / right;
    }

    return value;
  }

  function parseFactor(): number | null {
    const token = consume();

    if (!token) {
      return null;
    }

    if (token === '-') {
      const value = parseFactor();
      return value === null ? null : -value;
    }

    if (token === '(') {
      const value = parseExpression();

      if (consume() !== ')') {
        return null;
      }

      return value;
    }

    if (/^\d+(?:\.\d+)?$/.test(token)) {
      return Number(token);
    }

    return variables[token] ?? null;
  }

  const result = parseExpression();

  if (result === null || cursor !== expressionTokens.length || !Number.isFinite(result)) {
    return null;
  }

  return result;
}

function tokenizeExpression(expression: string): string[] | null {
  const tokens: string[] = [];
  let cursor = 0;

  while (cursor < expression.length) {
    const rest = expression.slice(cursor);
    const match = rest.match(/^\s*(\d+(?:\.\d+)?|[a-zA-Z]\w*|[()+\-*/])/);

    if (!match) {
      return null;
    }

    tokens.push(match[1]);
    cursor += match[0].length;
  }

  return tokens;
}

function formatTemplateNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function isConditionMatched(row: ClientCashbackExportRow, template: ConditionalMessageTemplate): boolean {
  const currentValue = row[template.field];

  if (template.operator === 'gt') {
    return currentValue > template.value;
  }

  if (template.operator === 'lt') {
    return currentValue < template.value;
  }

  return currentValue === template.value;
}

function parseConditionalTemplate(value: unknown): ConditionalMessageTemplate | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== 'string' ||
    !isConditionField(value.field) ||
    !isConditionOperator(value.operator) ||
    typeof value.value !== 'number' ||
    !Number.isFinite(value.value) ||
    typeof value.text !== 'string'
  ) {
    return null;
  }

  return {
    id: value.id,
    field: value.field,
    operator: value.operator,
    value: value.value,
    text: value.text,
  };
}

function isConditionField(value: unknown): value is MessageConditionField {
  return value === 'purchasesCount' || value === 'calculatedTotal' || value === 'cashback';
}

function isConditionOperator(value: unknown): value is MessageConditionOperator {
  return value === 'gt' || value === 'lt' || value === 'eq';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
