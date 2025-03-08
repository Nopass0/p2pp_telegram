import { parse } from 'csv-parse/sync';
import { P2PTransaction, ParsedCSV } from '@/types';

/**
 * Парсер CSV-файлов для P2P транзакций
 */
export class CSVParser {
  /**
   * Парсит CSV-файл с транзакциями
   * @param content Содержимое CSV-файла в виде строки
   * @returns Объект с транзакциями и сводкой
   */
  static parseTransactionsCSV(content: string): ParsedCSV {
    try {
      // Определяем заголовки и разделитель
      const delimiter = this.detectDelimiter(content);
      
      // Парсим CSV в объекты
      const records = parse(content, {
        columns: true,
        delimiter,
        skip_empty_lines: true,
        trim: true,
        cast: (value, context) => {
          // Преобразуем числовые значения
          if (context.header) return value;
          
          if (
            context.column === 'amount' ||
            context.column === 'totalPrice' ||
            context.column === 'unitPrice'
          ) {
            // Удаляем запятые и пробелы, заменяем запятые на точки
            const cleanValue = value.replace(/\s/g, '').replace(',', '.');
            // Преобразуем в число
            const numValue = parseFloat(cleanValue);
            return isNaN(numValue) ? 0 : numValue;
          }
          
          return value;
        }
      });
      
      // Нормализуем заголовки и структуру
      const transactions = this.normalizeTransactions(records);
      
      // Если транзакций нет, возвращаем пустой результат
      if (transactions.length === 0) {
        return {
          transactions: [],
          summary: {
            totalTransactions: 0,
            totalAmount: {},
            totalValue: {},
            averagePrice: {}
          }
        };
      }
      
      // Генерируем сводку по транзакциям
      const summary = this.generateSummary(transactions);
      
      return {
        transactions,
        summary
      };
    } catch (error) {
      console.error('Ошибка при парсинге CSV:', error);
      throw new Error('Ошибка при парсинге CSV-файла. Проверьте формат файла.');
    }
  }
  
  /**
   * Определяет разделитель в CSV-файле
   * @param content Содержимое CSV-файла
   * @returns Разделитель (запятая, точка с запятой или табуляция)
   */
  private static detectDelimiter(content: string): string {
    const firstLine = content.split('\n')[0];
    
    // Считаем количество разных разделителей в первой строке
    const commas = (firstLine.match(/,/g) || []).length;
    const semicolons = (firstLine.match(/;/g) || []).length;
    const tabs = (firstLine.match(/\t/g) || []).length;
    
    // Выбираем наиболее вероятный разделитель
    if (semicolons > commas && semicolons > tabs) {
      return ';';
    } else if (tabs > commas && tabs > semicolons) {
      return '\t';
    } else {
      return ','; // По умолчанию используем запятую
    }
  }
  
  /**
   * Нормализует транзакции из разных форматов CSV
   * @param records Записи из CSV
   * @returns Нормализованный массив транзакций
   */
  private static normalizeTransactions(records: any[]): P2PTransaction[] {
    return records.map(record => {
      // Создаем базовую транзакцию
      const tx: P2PTransaction = {
        id: '',
        orderNo: '',
        dateTime: '',
        type: '',
        asset: '',
        amount: 0,
        totalPrice: 0,
        unitPrice: 0,
        counterparty: '',
        status: ''
      };
      
      // Маппим поля из разных форматов
      const fields = Object.keys(record);
      
      // Обрабатываем ID и номер заказа
      tx.id = record.ID || record.Id || record.id || '';
      tx.orderNo = record.OrderNo || record['Order No'] || record['Order Number'] || record['№ ордера'] || record.orderNo || '';
      
      // Обрабатываем дату и время
      tx.dateTime = record.DateTime || record['Date Time'] || record.Date || record['Дата и время'] || record.dateTime || '';
      
      // Обрабатываем тип транзакции
      tx.type = record.Type || record.type || record.Operation || record.operation || record.Тип || '';
      
      // Обрабатываем актив/валюту
      tx.asset = record.Asset || record.asset || record.Currency || record.currency || record.Актив || '';
      
      // Обрабатываем количество
      tx.amount = parseFloat(record.Amount || record.amount || record.Quantity || record.quantity || record.Количество || 0);
      
      // Обрабатываем общую стоимость
      tx.totalPrice = parseFloat(record.TotalPrice || record['Total Price'] || record.Total || record['Общая стоимость'] || record.totalPrice || 0);
      
      // Обрабатываем цену за единицу
      tx.unitPrice = parseFloat(record.UnitPrice || record['Unit Price'] || record.Price || record['Цена за единицу'] || record.unitPrice || 0);
      
      // Обрабатываем контрагента
      tx.counterparty = record.Counterparty || record.counterparty || record.Partner || record.partner || record.Контрагент || '';
      
      // Обрабатываем статус
      tx.status = record.Status || record.status || record.State || record.state || record.Статус || '';
      
      // Если есть другие поля, добавляем их тоже
      fields.forEach(field => {
        if (!(field in tx)) {
          tx[field] = record[field];
        }
      });
      
      return tx;
    }).filter(tx => 
      // Фильтруем некорректные транзакции
      tx.dateTime && 
      tx.type && 
      tx.asset && 
      (tx.amount > 0 || tx.totalPrice > 0)
    );
  }
  
  /**
   * Генерирует сводку по транзакциям
   * @param transactions Массив транзакций
   * @returns Объект со сводной информацией
   */
  private static generateSummary(transactions: P2PTransaction[]): ParsedCSV['summary'] {
    const totalAmount: Record<string, number> = {};
    const totalValue: Record<string, number> = {};
    const counts: Record<string, number> = {};
    
    // Собираем данные по каждой транзакции
    transactions.forEach(tx => {
      if (!totalAmount[tx.asset]) {
        totalAmount[tx.asset] = 0;
        totalValue[tx.asset] = 0;
        counts[tx.asset] = 0;
      }
      
      // Определяем покупка это или продажа
      const isBuy = tx.type.toLowerCase().includes('buy') || 
                   tx.type.toLowerCase().includes('купить') || 
                   tx.type.toLowerCase().includes('покуп');
      
      // Для покупок добавляем, для продаж вычитаем
      totalAmount[tx.asset] += isBuy ? tx.amount : -tx.amount;
      totalValue[tx.asset] += tx.totalPrice;
      counts[tx.asset]++;
    });
    
    // Вычисляем средние цены
    const averagePrice: Record<string, number> = {};
    Object.keys(totalValue).forEach(asset => {
      averagePrice[asset] = counts[asset] > 0 ? totalValue[asset] / counts[asset] : 0;
    });
    
    return {
      totalTransactions: transactions.length,
      totalAmount,
      totalValue,
      averagePrice
    };
  }
}
