export interface P2PTransaction {
  id: string;
  orderNo: string;
  dateTime: string;
  type: string;
  asset: string;
  amount: number;
  totalPrice: number;
  unitPrice: number;
  counterparty: string;
  status: string;
  [key: string]: string | number; // For any additional columns
}

export interface ParsedCSV {
  transactions: P2PTransaction[];
  summary: {
    totalTransactions: number;
    totalAmount: Record<string, number>;
    totalValue: Record<string, number>;
    averagePrice: Record<string, number>;
  };
}
