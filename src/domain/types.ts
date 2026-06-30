export type PriceValue = number | null;

export interface PurchaseRecord {
  branch: string;
  clientName: string;
  date: Date;
  subscriptionName: string;
  paymentBasis: string;
}

export interface PricePeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  pricesBySubscriptionName: Record<string, PriceValue>;
}

export interface CashbackSettings {
  cashbackPercent: number;
  periods: PricePeriod[];
}

export interface ClientCashbackSummary {
  clientName: string;
  purchasesCount: number;
  calculatedTotal: number;
  cashback: number;
}

export type ClientStatusMap = Record<string, boolean>;

export interface ClientCashbackExportRow extends ClientCashbackSummary {
  isActive: boolean;
}

export type MessageConditionField = 'purchasesCount' | 'calculatedTotal' | 'cashback';
export type MessageConditionOperator = 'gt' | 'lt' | 'eq';

export interface ConditionalMessageTemplate {
  id: string;
  field: MessageConditionField;
  operator: MessageConditionOperator;
  value: number;
  text: string;
}

export interface MessageTemplatesSettings {
  baseTemplate: string;
  conditionalTemplates: ConditionalMessageTemplate[];
}

export interface PurchaseCalculation {
  purchase: PurchaseRecord;
  period: PricePeriod;
  price: number;
  cashback: number;
}
