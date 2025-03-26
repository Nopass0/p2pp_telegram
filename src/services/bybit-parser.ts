import * as xlsx from 'xlsx';
import { BybitTransaction, ParsedBybitXLS } from '@/types';

/**
 * Парсер для XLS файлов с транзакциями Bybit
 */
export class BybitParser {
  /**
   * Парсит XLS буфер с транзакциями Bybit
   * @param buffer Буфер с содержимым XLS файла
   * @returns Объект с транзакциями и сводной информацией
   */
  static async parseXLSBuffer(buffer: Buffer): Promise<ParsedBybitXLS> {
    try {
      // Загружаем XLS из буфера
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      
      // Предполагаем, что данные находятся на первом листе
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Преобразуем лист в массив объектов
      const rawData = xlsx.utils.sheet_to_json(worksheet);
      
      // Преобразуем данные в формат транзакций Bybit
      const transactions: BybitTransaction[] = rawData.map((row: any) => {
        // Преобразуем в понятный формат транзакции
        // Структура может быть адаптирована в зависимости от фактического формата Bybit XLS
        const transaction: BybitTransaction = {
          orderNo: row['Номер ордера'] || row['Order No.'] || '',
          dateTime: new Date(row['Время транзакции'] || row['Transaction Time'] || new Date()),
          type: this.mapTransactionType(row['Тип конвертации'] || row['Convert Type'] || ''),
          asset: row['Криптовалюта'] || row['Cryptocurrency'] || '',
          amount: this.parseNumber(row['Количество монет'] || row['Coin Amount'] || 0),
          totalPrice: this.parseNumber(row['Сумма фиата'] || row['Fiat Amount'] || 0),
          unitPrice: this.parseNumber(row['Цена'] || row['Price'] || 0),
          counterparty: row['Контрагент'] || row['Counterparty'] || '',
          status: this.mapTransactionStatus(row['Статус'] || row['Status'] || ''),
          originalData: { ...row } // Сохраняем оригинальные данные
        };
        
        return transaction;
      });

      // Вычисляем сводную информацию
      const summary = this.calculateSummary(transactions);
      
      return {
        transactions,
        summary
      };
    } catch (error) {
      console.error('Ошибка при парсинге XLS файла Bybit:', error);
      throw new Error(`Ошибка при обработке XLS файла Bybit: ${error.message}`);
    }
  }

  /**
   * Преобразует строковое значение в число
   * @param value Значение для преобразования
   * @returns Число или 0, если преобразование невозможно
   */
  private static parseNumber(value: any): number {
    if (typeof value === 'number') return value;
    
    if (typeof value === 'string') {
      // Убираем все нецифровые символы, кроме точки и минуса
      const cleanValue = value.replace(/[^\d.-]/g, '');
      const parsed = parseFloat(cleanValue);
      return isNaN(parsed) ? 0 : parsed;
    }
    
    return 0;
  }

  /**
   * Преобразует тип транзакции Bybit в стандартный формат
   * @param type Тип транзакции из Bybit
   * @returns Стандартизированный тип транзакции
   */
  private static mapTransactionType(type: string): string {
    // Преобразуем типы транзакций Bybit в наш формат
    const typeMap: Record<string, string> = {
      'BUY': 'buy',
      'SELL': 'sell',
      'Покупка': 'buy',
      'Продажа': 'sell'
    };
    
    return typeMap[type] || type;
  }

  /**
   * Преобразует статус транзакции Bybit в стандартный формат
   * @param status Статус транзакции из Bybit
   * @returns Стандартизированный статус транзакции
   */
  private static mapTransactionStatus(status: string): string {
    // Преобразуем статусы Bybit в наш формат
    const statusMap: Record<string, string> = {
      'Completed': 'completed',
      'Cancelled': 'cancelled',
      'Processing': 'processing',
      'Завершен': 'completed',
      'Отменен': 'cancelled',
      'В обработке': 'processing'
    };
    
    return statusMap[status] || status;
  }

  /**
   * Вычисляет сводную информацию по транзакциям
   * @param transactions Массив транзакций
   * @returns Объект со сводной информацией
   */
  private static calculateSummary(transactions: BybitTransaction[]): ParsedBybitXLS['summary'] {
    const totalAmount: Record<string, number> = {};
    const totalValue: Record<string, number> = {};
    const count: Record<string, number> = {};
    
    // Обрабатываем каждую транзакцию
    for (const tx of transactions) {
      const asset = tx.asset;
      
      // Инициализируем счетчики, если необходимо
      if (!totalAmount[asset]) {
        totalAmount[asset] = 0;
        totalValue[asset] = 0;
        count[asset] = 0;
      }
      
      // Учитываем транзакцию в зависимости от типа
      if (tx.type.toLowerCase() === 'buy') {
        totalAmount[asset] += tx.amount;
      } else if (tx.type.toLowerCase() === 'sell') {
        totalAmount[asset] -= tx.amount;
      }
      
      totalValue[asset] += tx.totalPrice;
      count[asset]++;
    }
    
    // Вычисляем средние цены
    const averagePrice: Record<string, number> = {};
    for (const asset in totalValue) {
      averagePrice[asset] = count[asset] > 0 ? totalValue[asset] / count[asset] : 0;
    }
    
    return {
      totalTransactions: transactions.length,
      totalAmount,
      totalValue,
      averagePrice
    };
  }
}
