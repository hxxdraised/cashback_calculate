import * as XLSX from 'xlsx';
import { extractSubscriptionName } from './cashback';
import type { PurchaseRecord } from './types';

type RawRow = Record<string, unknown>;

export async function loadPurchasesFromUrl(url: string): Promise<PurchaseRecord[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Не удалось загрузить Excel-файл из папки data.');
  }

  const data = await response.arrayBuffer();
  return parsePurchasesWorkbook(data);
}

export function parsePurchasesWorkbook(data: ArrayBuffer): PurchaseRecord[] {
  const workbook = XLSX.read(data, { type: 'array', cellDates: false });
  const sheetName = workbook.SheetNames.includes('export') ? 'export' : workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  ensureWorksheetRange(worksheet);
  const rows = XLSX.utils.sheet_to_json<RawRow>(worksheet, { defval: '' });

  return rows
    .map(parseRow)
    .filter((record): record is PurchaseRecord => record !== null)
    .sort((left, right) => left.date.getTime() - right.date.getTime());
}

function parseRow(row: RawRow): PurchaseRecord | null {
  const clientName = stringCell(row['Клиент']);
  const paymentBasis = stringCell(row['Основание платежа']);
  const rawDate = stringCell(row['Дата']);

  if (!clientName || !paymentBasis || !rawDate) {
    return null;
  }

  const date = parseRussianDateTime(rawDate);
  if (!date) {
    return null;
  }

  return {
    branch: stringCell(row['Филиал']),
    clientName,
    date,
    subscriptionName: extractSubscriptionName(paymentBasis),
    paymentBasis,
  };
}

function ensureWorksheetRange(worksheet: XLSX.WorkSheet): void {
  if (worksheet['!ref']) {
    return;
  }

  const cells = Object.keys(worksheet).filter((key) => !key.startsWith('!'));
  if (cells.length === 0) {
    return;
  }

  const decodedCells = cells.map((cell) => XLSX.utils.decode_cell(cell));
  const maxRow = Math.max(...decodedCells.map((cell) => cell.r));
  const maxColumn = Math.max(...decodedCells.map((cell) => cell.c));
  worksheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxColumn } });
}

function stringCell(value: unknown): string {
  return String(value ?? '').trim();
}

function parseRussianDateTime(value: string): Date | null {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?$/);
  if (!match) {
    return null;
  }

  const [, day, month, year, hour = '00', minute = '00'] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
}
