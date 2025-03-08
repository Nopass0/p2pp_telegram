import { prisma } from './prisma';
import { TransactionDB, P2PTransaction } from '@/types';

/**
 * Сервис для работы с P2P транзакциями
 */
export class TransactionService {
  
  /**
   * Сохраняет транзакции пользователя из CSV-файла
   * @param userId ID виртуального пользователя
   * @param transactions Массив транзакций из CSV
   * @returns Объект с количеством новых и дублирующихся транзакций
   */
  static async saveTransactions(
    userId: number, 
    transactions: P2PTransaction[]
  ): Promise<{ added: number, duplicates: number }> {
    let added = 0;
    let duplicates = 0;
    
    try {
      // Обрабатываем каждую транзакцию
      for (const tx of transactions) {
        // Создаем уникальный внешний ID, если его нет
        const externalId = tx.id || tx.orderNo || `${tx.dateTime}-${tx.type}-${tx.amount}-${tx.asset}`;
        
        // Проверяем, существует ли уже такая транзакция у пользователя
        const existingTransaction = await prisma.transaction.findFirst({
          where: {
            userId,
            externalId: externalId.toString()
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
        
        // Создаём новую транзакцию
        await prisma.transaction.create({
          data: {
            externalId: externalId.toString(),
            orderNo: tx.orderNo || null,
            dateTime,
            type: tx.type,
            asset: tx.asset,
            amount: tx.amount,
            totalPrice: tx.totalPrice,
            unitPrice: tx.unitPrice,
            counterparty: tx.counterparty || null,
            status: tx.status,
            originalData: tx as any, // Сохраняем оригинальные данные как JSON
            userId
          }
        });
        
        added++;
      }
      
      return { added, duplicates };
    } catch (error) {
      console.error('Ошибка при сохранении транзакций:', error);
      return { added, duplicates };
    }
  }
  
  /**
   * Получает список транзакций пользователя с пагинацией
   * @param userId ID виртуального пользователя
   * @param page Номер страницы (начиная с 1)
   * @param pageSize Размер страницы
   * @returns Объект с транзакциями и информацией о пагинации
   */
  static async getUserTransactions(
    userId: number, 
    page: number = 1, 
    pageSize: number = 10
  ): Promise<{ transactions: TransactionDB[], total: number, page: number, totalPages: number }> {
    try {
      // Считаем общее количество транзакций
      const total = await prisma.transaction.count({
        where: { userId }
      });
      
      // Вычисляем общее количество страниц
      const totalPages = Math.ceil(total / pageSize);
      
      // Нормализуем номер страницы
      const normalizedPage = Math.max(1, Math.min(page, totalPages));
      
      // Получаем транзакции для текущей страницы
      const transactions = await prisma.transaction.findMany({
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
      console.error('Ошибка при получении транзакций пользователя:', error);
      return {
        transactions: [],
        total: 0,
        page: 1,
        totalPages: 0
      };
    }
  }
  
  /**
   * Поиск транзакций по критериям
   * @param options Параметры поиска
   * @returns Объект с найденными транзакциями и информацией о пагинации
   */
  static async searchTransactions({
    userId,
    startDate,
    endDate,
    type,
    asset,
    status,
    minAmount,
    maxAmount,
    orderNo,
    counterparty,
    page = 1,
    pageSize = 10
  }: {
    userId?: number;
    startDate?: Date;
    endDate?: Date;
    type?: string;
    asset?: string;
    status?: string;
    minAmount?: number;
    maxAmount?: number;
    orderNo?: string;
    counterparty?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ transactions: TransactionDB[], total: number, page: number, totalPages: number }> {
    try {
      // Строим условия поиска
      const where: any = {};
      
      // Фильтр по пользователю
      if (userId) {
        where.userId = userId;
      }
      
      // Фильтр по диапазону дат
      if (startDate || endDate) {
        where.dateTime = {};
        if (startDate) {
          where.dateTime.gte = startDate;
        }
        if (endDate) {
          where.dateTime.lte = endDate;
        }
      }
      
      // Другие фильтры
      if (type) {
        where.type = { contains: type, mode: 'insensitive' };
      }
      if (asset) {
        where.asset = { contains: asset, mode: 'insensitive' };
      }
      if (status) {
        where.status = { contains: status, mode: 'insensitive' };
      }
      if (minAmount !== undefined) {
        where.amount = { ...(where.amount || {}), gte: minAmount };
      }
      if (maxAmount !== undefined) {
        where.amount = { ...(where.amount || {}), lte: maxAmount };
      }
      if (orderNo) {
        where.orderNo = { contains: orderNo, mode: 'insensitive' };
      }
      if (counterparty) {
        where.counterparty = { contains: counterparty, mode: 'insensitive' };
      }
      
      // Считаем общее количество подходящих транзакций
      const total = await prisma.transaction.count({ where });
      
      // Вычисляем общее количество страниц
      const totalPages = Math.ceil(total / pageSize);
      
      // Нормализуем номер страницы
      const normalizedPage = Math.max(1, Math.min(page, totalPages || 1));
      
      // Получаем транзакции для текущей страницы
      const transactions = await prisma.transaction.findMany({
        where,
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
      console.error('Ошибка при поиске транзакций:', error);
      return {
        transactions: [],
        total: 0,
        page: 1,
        totalPages: 0
      };
    }
  }
  
  /**
   * Получает статистику транзакций пользователя за указанный период
   * @param userId ID виртуального пользователя
   * @param startDate Начальная дата периода
   * @param endDate Конечная дата периода
   * @returns Объект со статистикой транзакций
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
      avgPrice: number;
      buyAmount: number;
      sellAmount: number;
    }>;
  }> {
    try {
      // Получаем все транзакции пользователя за указанный период
      const transactions = await prisma.transaction.findMany({
        where: {
          userId,
          dateTime: {
            gte: startDate,
            lte: endDate
          }
        }
      });

      // Если транзакций нет, возвращаем нулевую статистику
      if (transactions.length === 0) {
        return {
          totalTransactions: 0,
          totalBuy: 0,
          totalSell: 0,
          assets: []
        };
      }

      // Подсчитываем количество транзакций по типу
      const totalBuy = transactions.filter(tx => tx.type.toLowerCase() === 'buy').length;
      const totalSell = transactions.filter(tx => tx.type.toLowerCase() === 'sell').length;

      // Группируем транзакции по активам
      const assetMap = new Map<string, {
        totalAmount: number;
        totalPrice: number;
        buyAmount: number;
        sellAmount: number;
        transactions: number;
      }>();

      // Обрабатываем каждую транзакцию
      for (const tx of transactions) {
        const asset = tx.asset;
        const isPositiveAmount = tx.type.toLowerCase() === 'buy';
        const amount = parseFloat(tx.amount.toString());
        const price = parseFloat(tx.unitPrice?.toString() || '0');
        
        // Если актив еще не встречался, инициализируем его статистику
        if (!assetMap.has(asset)) {
          assetMap.set(asset, {
            totalAmount: 0,
            totalPrice: 0,
            buyAmount: 0,
            sellAmount: 0,
            transactions: 0
          });
        }

        const assetStats = assetMap.get(asset);
        
        // Обновляем статистику актива
        if (isPositiveAmount) {
          assetStats.buyAmount += amount;
          assetStats.totalAmount += amount;
        } else {
          assetStats.sellAmount += amount;
          assetStats.totalAmount -= amount;
        }
        
        // Добавляем цену для расчета средней
        assetStats.totalPrice += price;
        assetStats.transactions += 1;
      }

      // Формируем итоговую статистику по активам
      const assets = Array.from(assetMap.entries()).map(([asset, stats]) => ({
        asset,
        totalAmount: stats.totalAmount,
        avgPrice: stats.totalPrice / stats.transactions,
        buyAmount: stats.buyAmount,
        sellAmount: stats.sellAmount
      }));

      return {
        totalTransactions: transactions.length,
        totalBuy,
        totalSell,
        assets
      };
    } catch (error) {
      console.error('Ошибка при получении статистики транзакций:', error);
      return {
        totalTransactions: 0,
        totalBuy: 0,
        totalSell: 0,
        assets: []
      };
    }
  }
  
  /**
   * Получает транзакции за указанный временной период
   * @param period Период ("day", "24h", "hour", "2days", "3days", "week", "month")
   * @param userId ID виртуального пользователя (опционально)
   * @returns Объект с транзакциями и статистикой
   */
  static async getTransactionsByPeriod(
    period: 'day' | '24h' | 'hour' | '2days' | '3days' | 'week' | 'month',
    userId?: number
  ): Promise<{
    transactions: TransactionDB[];
    stats: {
      totalTransactions: number;
      totalBuy: number;
      totalSell: number;
      assets: { 
        asset: string; 
        totalAmount: number; 
        buyAmount: number; 
        sellAmount: number; 
        avgPrice: number; 
      }[];
    };
  }> {
    try {
      const now = new Date();
      let startDate = new Date();
      
      // Вычисляем стартовую дату в зависимости от периода
      switch (period) {
        case 'day':
          startDate.setHours(0, 0, 0, 0); // Начало текущего дня
          break;
        case '24h':
          startDate.setHours(now.getHours() - 24); // 24 часа назад
          break;
        case 'hour':
          startDate.setHours(now.getHours() - 1); // 1 час назад
          break;
        case '2days':
          startDate.setDate(now.getDate() - 2);
          startDate.setHours(0, 0, 0, 0);
          break;
        case '3days':
          startDate.setDate(now.getDate() - 3);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(now.getMonth() - 1);
          break;
      }
      
      // Получаем транзакции и статистику за период
      const where: any = {
        dateTime: { gte: startDate }
      };
      
      if (userId) {
        where.userId = userId;
      }
      
      const transactions = await prisma.transaction.findMany({
        where,
        orderBy: { dateTime: 'desc' }
      });
      
      // Получаем статистику
      const stats = await this.getTransactionStats(userId, startDate);
      
      return { transactions, stats };
    } catch (error) {
      console.error('Ошибка при получении транзакций за период:', error);
      return {
        transactions: [],
        stats: {
          totalTransactions: 0,
          totalBuy: 0,
          totalSell: 0,
          assets: []
        }
      };
    }
  }
}
