import { prisma } from './prisma';
import { BybitTransaction } from '@/types';

/**
 * Сервис для работы с транзакциями Bybit
 */
export class BybitTransactionService {
  /**
   * Сохраняет транзакции Bybit пользователя из XLS-файла
   * @param userId ID виртуального пользователя
   * @param transactions Массив транзакций из XLS
   * @returns Объект с количеством новых и дублирующихся транзакций
   */
  static async saveTransactions(
    userId: number, 
    transactions: BybitTransaction[]
  ): Promise<{ added: number, duplicates: number }> {
    let added = 0;
    let duplicates = 0;
    
    try {
      // Обрабатываем каждую транзакцию
      for (const tx of transactions) {
        // Проверяем, существует ли уже такая транзакция у пользователя по номеру ордера
        const existingTransaction = await prisma.bybitTransaction.findFirst({
          where: {
            userId,
            orderNo: tx.orderNo
          }
        });
        
        // Если транзакция уже существует, пропускаем её
        if (existingTransaction) {
          duplicates++;
          continue;
        }
        
        // Нормализуем дату и время
        let dateTime;
        try {
          // Пробуем распарсить дату
          dateTime = new Date(tx.dateTime);
          
          // Проверяем валидность даты
          if (isNaN(dateTime.getTime())) {
            // Если не удалось распарсить, используем текущую дату
            dateTime = new Date();
          }
        } catch (e) {
          // В случае ошибки используем текущую дату
          dateTime = new Date();
        }
        
        // Создаём новую транзакцию Bybit
        await prisma.bybitTransaction.create({
          data: {
            orderNo: tx.orderNo,
            dateTime: new Date(dateTime.getTime() + (3 * 60 * 60 * 1000)), // Переводим на московское время (UTC+3)
            type: tx.type,
            asset: tx.asset,
            amount: tx.amount,
            totalPrice: tx.totalPrice,
            unitPrice: tx.unitPrice,
            counterparty: tx.counterparty || null,
            status: tx.status,
            originalData: tx.originalData || null, // Сохраняем оригинальные данные как JSON
            userId
          }
        });
        
        added++;
      }
      
      return { added, duplicates };
    } catch (error) {
      console.error('Ошибка при сохранении транзакций Bybit:', error);
      return { added, duplicates };
    }
  }
  
  /**
   * Получает список транзакций Bybit пользователя с пагинацией
   * @param userId ID виртуального пользователя
   * @param page Номер страницы (начиная с 1)
   * @param pageSize Размер страницы
   * @returns Объект с транзакциями и информацией о пагинации
   */
  static async getUserTransactions(
    userId: number, 
    page: number = 1, 
    pageSize: number = 10
  ): Promise<{ transactions: any[], total: number, page: number, totalPages: number }> {
    try {
      // Считаем общее количество транзакций
      const total = await prisma.bybitTransaction.count({
        where: { userId }
      });
      
      // Вычисляем общее количество страниц
      const totalPages = Math.ceil(total / pageSize);
      
      // Нормализуем номер страницы
      const normalizedPage = Math.max(1, Math.min(page, totalPages));
      
      // Получаем транзакции для текущей страницы
      const transactions = await prisma.bybitTransaction.findMany({
        where: { userId },
        orderBy: { dateTime: 'desc' },
        skip: (normalizedPage - 1) * pageSize,
        take: pageSize
      });
      
      return {
        transactions,
        total,
        page: normalizedPage,
        totalPages
      };
    } catch (error) {
      console.error('Ошибка при получении транзакций Bybit пользователя:', error);
      return {
        transactions: [],
        total: 0,
        page: 1,
        totalPages: 0
      };
    }
  }
  
  /**
   * Получает статистику по транзакциям Bybit за указанный период
   * @param userId ID пользователя
   * @param startDate Начало периода
   * @param endDate Конец периода
   * @returns Объект со статистикой
   */
  static async getTransactionStats(
    userId: number,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalTransactions: number;
    totalBuy: number;
    totalSell: number;
    assets: Array<{
      asset: string;
      totalAmount: number;
      totalValue: number;
      avgPrice: number;
    }>;
  }> {
    try {
      // Получаем все транзакции за период
      const transactions = await prisma.bybitTransaction.findMany({
        where: {
          userId,
          dateTime: {
            gte: startDate,
            lte: endDate
          }
        }
      });
      
      // Статистика по всем транзакциям
      let totalBuy = 0;
      let totalSell = 0;
      
      // Статистика по активам
      const assetStats: Record<string, {
        totalAmount: number;
        totalValue: number;
        count: number;
      }> = {};
      
      // Обрабатываем каждую транзакцию
      for (const tx of transactions) {
        // Считаем сделки по типу
        if (tx.type.toLowerCase() === 'buy') {
          totalBuy++;
        } else if (tx.type.toLowerCase() === 'sell') {
          totalSell++;
        }
        
        // Инициализируем статистику для актива, если её ещё нет
        if (!assetStats[tx.asset]) {
          assetStats[tx.asset] = {
            totalAmount: 0,
            totalValue: 0,
            count: 0
          };
        }
        
        // Учитываем объём и стоимость в зависимости от типа транзакции
        if (tx.type.toLowerCase() === 'buy') {
          assetStats[tx.asset].totalAmount += tx.amount;
        } else if (tx.type.toLowerCase() === 'sell') {
          assetStats[tx.asset].totalAmount -= tx.amount;
        }
        
        assetStats[tx.asset].totalValue += tx.totalPrice;
        assetStats[tx.asset].count++;
      }
      
      // Преобразуем статистику в удобный формат
      const assets = Object.entries(assetStats).map(([asset, stats]) => ({
        asset,
        totalAmount: stats.totalAmount,
        totalValue: stats.totalValue,
        avgPrice: stats.count > 0 ? stats.totalValue / stats.count : 0
      }));
      
      return {
        totalTransactions: transactions.length,
        totalBuy,
        totalSell,
        assets
      };
    } catch (error) {
      console.error('Ошибка при получении статистики транзакций Bybit:', error);
      return {
        totalTransactions: 0,
        totalBuy: 0,
        totalSell: 0,
        assets: []
      };
    }
  }
}
