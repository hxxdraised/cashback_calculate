import type { ClientCashbackSummary } from './types';

export function summariesToCsv(summaries: ClientCashbackSummary[]): string {
  const header = ['Клиент', 'Покупок', 'Расчетная сумма', 'Кешбек'];
  const rows = summaries.map((summary) => [
    summary.clientName,
    String(summary.purchasesCount),
    String(summary.calculatedTotal),
    String(summary.cashback),
  ]);

  return [header, ...rows].map((row) => row.map(escapeCsvCell).join(';')).join('\r\n');
}

export function downloadTextFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCsvCell(cell: string): string {
  if (!/[;"\r\n]/.test(cell)) {
    return cell;
  }

  return `"${cell.replaceAll('"', '""')}"`;
}
