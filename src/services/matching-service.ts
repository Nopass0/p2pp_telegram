import { PrismaClient } from '@prisma/client';
import dayjs from 'dayjs';

const prisma = new PrismaClient();
const MINUTES_THRESHOLD = 30; // Порог в 30 минут
const COMMISSION = 1.009;

export interface MatchStats {
  grossExpense: number;
  grossIncome: number;
  grossProfit: number;
  profitPercentage: number;
  matchedCount: number;
  profitPerOrder: number;
  expensePerOrder: number;
}

/**
 * Функция для получения информации о пользователе по ID
 */
export async function getUserById(userId: number) {
  try {
    return await prisma.user.findUnique({
      where: { id: userId }
    });
  } catch (error) {
    console.error('Ошибка при получении информации о пользователе:', error);
    return null;
  }
}

/**
 * Функция для расчета разницы во времени в минутах
 */
function getTimeDifferenceInMinutes(dateStr1: string, dateStr2: string): number {
  const date1 = dayjs(dateStr1);
  const date2 = dayjs(dateStr2);
  return Math.abs(date1.diff(date2, 'minute'));
}

/**
 * Функция для расчета метрик для матча
 */
function calculateMatchMetrics(transaction: any, idexTransaction: any): {
  grossExpense: number;
  grossIncome: number;
  grossProfit: number;
  profitPercentage: number;
} {
  const amount = transaction.amount || 0;
  const grossExpense = amount * COMMISSION;
  
  // Парсим поле total для получения суммы
  let totalUsdt = 0;
  try {
    // Проверяем, является ли total строкой JSON
    if (typeof idexTransaction.total === 'string') {
      const totalJson = JSON.parse(idexTransaction.total);
      totalUsdt = parseFloat(totalJson.trader?.[643] || 0);
    } else {
      // Если total уже является объектом
      totalUsdt = parseFloat(idexTransaction.total.trader?.[643] || 0);
    }
  } catch (error) {
    console.error('Ошибка при парсинге JSON поля total:', error);
  }
  
  const grossIncome = totalUsdt;
  const grossProfit = grossIncome - grossExpense;
  const profitPercentage = grossExpense ? (grossProfit / grossExpense) * 100 : 0;
  
  return {
    grossExpense,
    grossIncome,
    grossProfit,
    profitPercentage
  };
}

/**
 * Функция для сопоставления транзакций по заданным критериям
 */
export async function matchTransactions(startDate: string, endDate: string): Promise<MatchStats> {
  console.log(`Начинаем сопоставление транзакций с ${startDate} по ${endDate}`);
  
  const startDateTime = dayjs(startDate).toDate();
  const endDateTime = dayjs(endDate).toDate();
  
  // Получаем IdexTransactions в указанном диапазоне дат
  const idexTransactions = await prisma.idexTransaction.findMany({
    where: {
      approvedAt: {
        not: null,
      },
      // Используем строковое сравнение, так как approvedAt хранится как строка
      // Фильтрацию по диапазону дат выполним в памяти
    },
  });
  
  // Фильтруем IdexTransactions по диапазону дат
  const filteredIdexTransactions = idexTransactions.filter(tx => {
    if (!tx.approvedAt) return false;
    const approvedDate = dayjs(tx.approvedAt);
    return approvedDate.isAfter(startDateTime) && approvedDate.isBefore(endDateTime);
  });
  
  console.log(`Найдено ${filteredIdexTransactions.length} IdexTransactions в указанном диапазоне`);
  
  // Получаем Transactions в указанном диапазоне дат
  const transactions = await prisma.transaction.findMany({
    where: {
      dateTime: {
        gte: startDateTime,
        lte: endDateTime
      }
    },
  });
  
  console.log(`Найдено ${transactions.length} Transactions в указанном диапазоне`);
  
  // Отслеживаем сопоставленные ID для обеспечения соответствия один к одному
  const matchedIdexTransactions = new Set<number>();
  const matchedTransactions = new Set<number>();
  
  // Сохраняем все найденные совпадения
  const matches = [];
  
  // Пытаемся сопоставить каждую IdexTransaction
  for (const idexTx of filteredIdexTransactions) {
    if (matchedIdexTransactions.has(idexTx.id)) continue;
    if (!idexTx.approvedAt) continue; // Пропускаем, если нет даты подтверждения
    
    // Парсим поле amount для получения значения
    let amountValue = 0;
    try {
      // Проверяем, является ли amount строкой JSON
      if (typeof idexTx.amount === 'string') {
        const amountJson = JSON.parse(idexTx.amount);
        amountValue = parseFloat(amountJson.trader?.[643] || 0);
      } else {
        // Если amount уже является объектом
        amountValue = parseFloat(idexTx.amount.trader?.[643] || 0);
      }
    } catch (error) {
      console.error('Ошибка при парсинге JSON поля amount:', error);
      continue;
    }
    
    // Находим потенциальные совпадения
    const potentialMatches = transactions
      .filter(tx => {
        // Пропускаем уже сопоставленные транзакции
        if (matchedTransactions.has(tx.id)) return false;
        
        // Проверяем, совпадает ли totalPrice
        if (Math.abs(tx.totalPrice - amountValue) > 0.01) return false;
        
        // Проверяем, находится ли дата в пределах +/- 30 минут
        const timeDiff = getTimeDifferenceInMinutes(idexTx.approvedAt!, tx.dateTime.toISOString());
        return timeDiff <= MINUTES_THRESHOLD;
      })
      .map(tx => ({
        transaction: tx,
        timeDiff: getTimeDifferenceInMinutes(idexTx.approvedAt!, tx.dateTime.toISOString())
      }))
      .sort((a, b) => a.timeDiff - b.timeDiff); // Сортировка по разнице во времени (ближайшая первая)
    
    // Если у нас есть совпадение
    if (potentialMatches.length > 0) {
      const match = potentialMatches[0];
      const tx = match.transaction;
      
      // Отмечаем обе транзакции как сопоставленные
      matchedIdexTransactions.add(idexTx.id);
      matchedTransactions.add(tx.id);
      
      // Рассчитываем метрики матча
      const metrics = calculateMatchMetrics(tx, idexTx);
      
      // Создаем объект матча для пакетного создания
      matches.push({
        idexTransactionId: idexTx.id,
        transactionId: tx.id,
        timeDifference: Math.round(match.timeDiff * 60), // Конвертируем минуты в секунды
        grossExpense: metrics.grossExpense,
        grossIncome: metrics.grossIncome,
        grossProfit: metrics.grossProfit,
        profitPercentage: metrics.profitPercentage
      });
    }
  }
  
  console.log(`Найдено ${matches.length} совпадений`);
  
  // Создаем все совпадения в базе данных
  if (matches.length > 0) {
    await prisma.match.createMany({
      data: matches,
      skipDuplicates: true
    });
    
    console.log(`Сохранено ${matches.length} совпадений в базе данных`);
  }
  
  // Рассчитываем совокупную статистику
  const matchCount = matches.length;
  const totalGrossExpense = matches.reduce((sum, match) => sum + match.grossExpense, 0);
  const totalGrossIncome = matches.reduce((sum, match) => sum + match.grossIncome, 0);
  const totalGrossProfit = matches.reduce((sum, match) => sum + match.grossProfit, 0);
  const totalProfitPercentage = totalGrossExpense ? (totalGrossProfit / totalGrossExpense) * 100 : 0;
  const profitPerOrder = matchCount ? totalGrossProfit / matchCount : 0;
  const expensePerOrder = matchCount ? totalGrossExpense / matchCount : 0;
  
  return {
    grossExpense: totalGrossExpense,
    grossIncome: totalGrossIncome,
    grossProfit: totalGrossProfit,
    profitPercentage: totalProfitPercentage,
    matchedCount: matchCount,
    profitPerOrder,
    expensePerOrder
  };
}

/**
 * Функция для получения матчей для конкретного пользователя
 */
export async function getUserMatches(userId: number, startDate: string, endDate: string, page = 1, limit = 10): Promise<{
  matches: any[];
  stats: MatchStats;
  totalPages: number;
  currentPage: number;
}> {
  const startDateTime = dayjs(startDate).toDate();
  const endDateTime = dayjs(endDate).toDate();
  
  // Расчет пагинации
  const skip = (page - 1) * limit;
  
  // Получаем матчи для пользователя
  const matches = await prisma.match.findMany({
    where: {
      transaction: {
        userId,
        dateTime: {
          gte: startDateTime,
          lte: endDateTime
        }
      }
    },
    include: {
      idexTransaction: true,
      transaction: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    skip,
    take: limit
  });
  
  // Считаем общее количество матчей для пагинации
  const totalMatches = await prisma.match.count({
    where: {
      transaction: {
        userId,
        dateTime: {
          gte: startDateTime,
          lte: endDateTime
        }
      }
    }
  });
  
  // Рассчитываем общее количество страниц
  const totalPages = Math.ceil(totalMatches / limit) || 1;
  
  // Рассчитываем статистику пользователя
  const allUserMatches = await prisma.match.findMany({
    where: {
      transaction: {
        userId,
        dateTime: {
          gte: startDateTime,
          lte: endDateTime
        }
      }
    }
  });
  
  const stats = calculateTotalStats(allUserMatches);
  
  return {
    matches,
    stats,
    totalPages,
    currentPage: page
  };
}

/**
 * Функция для получения всех матчей
 */
export async function getAllMatches(startDate: string, endDate: string, page = 1, limit = 10): Promise<{
  matches: any[];
  stats: MatchStats;
  totalPages: number;
  currentPage: number;
}> {
  const startDateTime = dayjs(startDate).toDate();
  const endDateTime = dayjs(endDate).toDate();
  
  // Расчет пагинации
  const skip = (page - 1) * limit;
  
  // Получаем матчи
  const matches = await prisma.match.findMany({
    where: {
      OR: [
        {
          transaction: {
            dateTime: {
              gte: startDateTime,
              lte: endDateTime
            }
          }
        },
        {
          idexTransaction: {
            approvedAt: {
              gte: startDateTime.toISOString(),
              lte: endDateTime.toISOString()
            }
          }
        }
      ]
    },
    include: {
      idexTransaction: true,
      transaction: {
        include: {
          user: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    skip,
    take: limit
  });
  
  // Считаем общее количество матчей для пагинации
  const totalMatches = await prisma.match.count({
    where: {
      OR: [
        {
          transaction: {
            dateTime: {
              gte: startDateTime,
              lte: endDateTime
            }
          }
        },
        {
          idexTransaction: {
            approvedAt: {
              gte: startDateTime.toISOString(),
              lte: endDateTime.toISOString()
            }
          }
        }
      ]
    }
  });
  
  // Рассчитываем общее количество страниц
  const totalPages = Math.ceil(totalMatches / limit) || 1;
  
  // Рассчитываем общую статистику
  const allMatches = await prisma.match.findMany({
    where: {
      OR: [
        {
          transaction: {
            dateTime: {
              gte: startDateTime,
              lte: endDateTime
            }
          }
        },
        {
          idexTransaction: {
            approvedAt: {
              gte: startDateTime.toISOString(),
              lte: endDateTime.toISOString()
            }
          }
        }
      ]
    }
  });
  
  const stats = calculateTotalStats(allMatches);
  
  return {
    matches,
    stats,
    totalPages,
    currentPage: page
  };
}

/**
 * Функция для получения всех пользователей со статистикой матчей
 */
export async function getUsersWithMatchStats(startDate: string, endDate: string, page = 1, limit = 10): Promise<{
  users: any[];
  totalStats: MatchStats;
  totalPages: number;
  currentPage: number;
}> {
  const startDateTime = dayjs(startDate).toDate();
  const endDateTime = dayjs(endDate).toDate();
  
  // Получаем всех пользователей с транзакциями в указанном диапазоне дат
  const users = await prisma.user.findMany({
    where: {
      transactions: {
        some: {
          dateTime: {
            gte: startDateTime,
            lte: endDateTime
          },
          matches: {
            some: {}
          }
        }
      }
    },
    include: {
      transactions: {
        where: {
          dateTime: {
            gte: startDateTime,
            lte: endDateTime
          },
          matches: {
            some: {}
          }
        }
      }
    },
    skip: (page - 1) * limit,
    take: limit
  });
  
  // Считаем общее количество пользователей для пагинации
  const totalUsers = await prisma.user.count({
    where: {
      transactions: {
        some: {
          dateTime: {
            gte: startDateTime,
            lte: endDateTime
          },
          matches: {
            some: {}
          }
        }
      }
    }
  });
  
  // Рассчитываем общее количество страниц
  const totalPages = Math.ceil(totalUsers / limit) || 1;
  
  // Рассчитываем статистику пользователей
  const usersWithStats = await Promise.all(users.map(async (user) => {
    const userMatches = await prisma.match.findMany({
      where: {
        transaction: {
          userId: user.id,
          dateTime: {
            gte: startDateTime,
            lte: endDateTime
          }
        }
      }
    });
    
    const stats = calculateTotalStats(userMatches);
    
    return {
      ...user,
      stats,
      matchCount: userMatches.length
    };
  }));
  
  // Рассчитываем общую статистику
  const allMatches = await prisma.match.findMany({
    where: {
      transaction: {
        dateTime: {
          gte: startDateTime,
          lte: endDateTime
        }
      }
    }
  });
  
  const totalStats = calculateTotalStats(allMatches);
  
  return {
    users: usersWithStats,
    totalStats,
    totalPages,
    currentPage: page
  };
}

/**
 * Вспомогательная функция для расчета общей статистики из списка матчей
 */
function calculateTotalStats(matches: any[]): MatchStats {
  const matchCount = matches.length;
  const totalGrossExpense = matches.reduce((sum, match) => sum + (match.grossExpense || 0), 0);
  const totalGrossIncome = matches.reduce((sum, match) => sum + (match.grossIncome || 0), 0);
  const totalGrossProfit = matches.reduce((sum, match) => sum + (match.grossProfit || 0), 0);
  const totalProfitPercentage = totalGrossExpense ? (totalGrossProfit / totalGrossExpense) * 100 : 0;
  const profitPerOrder = matchCount ? totalGrossProfit / matchCount : 0;
  const expensePerOrder = matchCount ? totalGrossExpense / matchCount : 0;
  
  return {
    grossExpense: totalGrossExpense,
    grossIncome: totalGrossIncome,
    grossProfit: totalGrossProfit,
    profitPercentage: totalProfitPercentage,
    matchedCount: matchCount,
    profitPerOrder,
    expensePerOrder
  };
}