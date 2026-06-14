import type { ClientCashbackExportRow, ClientCashbackSummary } from './types';

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
  downloadBlob(filename, blob);
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function createCashbackDocxBlob(
  rows: ClientCashbackExportRow[],
  periodLabel: string,
  formatAmount: (value: number) => string,
): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun } = await import('docx');
  const activeRows = rows.filter((row) => row.isActive);
  const inactiveRows = rows.filter((row) => !row.isActive);
  const createClientSection = (title: string, sectionRows: ClientCashbackExportRow[]) => {
    const paragraphs = [
      new Paragraph({
        children: [new TextRun({ text: title, bold: true })],
        spacing: { before: 120, after: 120 },
      }),
    ];

    if (sectionRows.length === 0) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: 'Нет клиентов' })],
          spacing: { after: 80 },
        }),
      );
      return paragraphs;
    }

    sectionRows.forEach((row, index) => {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun(`${index + 1}. ${row.clientName} - `),
            new TextRun({
              text: `${formatAmount(row.cashback)} руб`,
              bold: true,
            }),
          ],
          spacing: { after: 80 },
        }),
      );
    });

    return paragraphs;
  };

  const document = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: 'Calibri',
            size: 22,
          },
        },
      },
    },
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: `Информация по выгрузке за период:  ${periodLabel}`,
                bold: true,
              }),
            ],
            spacing: { after: 240 },
          }),
          ...createClientSection('АКТИВНЫЕ', activeRows),
          ...createClientSection('НЕАКТИВНЫЕ', inactiveRows),
        ],
      },
    ],
  });

  return Packer.toBlob(document);
}

function escapeCsvCell(cell: string): string {
  if (!/[;"\r\n]/.test(cell)) {
    return cell;
  }

  return `"${cell.replaceAll('"', '""')}"`;
}
