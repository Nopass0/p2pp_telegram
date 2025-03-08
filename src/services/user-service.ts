import { prisma } from './prisma';
import { VirtualUser, TelegramAccount } from '@/types';
import { randomBytes } from 'crypto';

/**
 * Сервис для работы с виртуальными пользователями
 */
export class UserService {
  
  /**
   * Создаёт нового виртуального пользователя
   * @param name Имя пользователя
   * @returns Созданный пользователь или null в случае ошибки
   */
  static async createUser(name: string): Promise<VirtualUser | null> {
    try {
      const passCode = this.generatePassCode();
      
      const user = await prisma.user.create({
        data: {
          name,
          passCode,
          isActive: true
        },
        include: {
          telegramAccounts: true,
          workSessions: true
        }
      });
      
      return user;
    } catch (error) {
      console.error('Ошибка при создании пользователя:', error);
      return null;
    }
  }
  
  /**
   * Находит пользователя по коду-паролю
   * @param passCode Код-пароль пользователя
   * @returns Найденный пользователь или null если пользователь не найден
   */
  static async findUserByPassCode(passCode: string): Promise<VirtualUser | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { passCode },
        include: {
          telegramAccounts: true,
          workSessions: true
        }
      });
      
      return user;
    } catch (error) {
      console.error('Ошибка при поиске пользователя по паролю:', error);
      return null;
    }
  }
  
  /**
   * Находит пользователя по ID телеграм-аккаунта
   * @param telegramId ID телеграм-аккаунта
   * @returns Найденный пользователь или null если пользователь не найден
   */
  static async findUserByTelegramId(telegramId: string): Promise<VirtualUser | null> {
    try {
      const telegramAccount = await prisma.telegramAccount.findUnique({
        where: { telegramId },
        include: {
          user: {
            include: {
              telegramAccounts: true,
              workSessions: true
            }
          }
        }
      });
      
      return telegramAccount?.user || null;
    } catch (error) {
      console.error('Ошибка при поиске пользователя по ID телеграма:', error);
      return null;
    }
  }
  
  /**
   * Находит пользователя по ID
   * @param id ID пользователя
   * @returns Найденный пользователь или null если пользователь не найден
   */
  static async findUserById(id: number): Promise<VirtualUser | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          telegramAccounts: true,
          workSessions: true
        }
      });
      
      return user;
    } catch (error) {
      console.error('Ошибка при поиске пользователя по ID:', error);
      return null;
    }
  }
  
  /**
   * Получает список всех пользователей
   * @returns Массив всех пользователей
   */
  static async getAllUsers(): Promise<VirtualUser[]> {
    try {
      const users = await prisma.user.findMany({
        include: {
          telegramAccounts: true,
          workSessions: true
        },
        orderBy: {
          name: 'asc'
        }
      });
      
      return users;
    } catch (error) {
      console.error('Ошибка при получении списка пользователей:', error);
      return [];
    }
  }
  
  /**
   * Получает список пользователей с пагинацией
   * @param page Номер страницы (начиная с 1)
   * @param pageSize Размер страницы
   * @returns Объект с пользователями и метаданными пагинации
   */
  static async getUsersWithPagination(page: number = 1, pageSize: number = 5): Promise<{
    users: VirtualUser[],
    totalUsers: number,
    totalPages: number,
    currentPage: number,
    pageSize: number
  }> {
    try {
      const skip = (page - 1) * pageSize;
      
      const [users, totalUsers] = await Promise.all([
        prisma.user.findMany({
          include: {
            telegramAccounts: true,
            workSessions: true
          },
          orderBy: {
            name: 'asc'
          },
          skip,
          take: pageSize
        }),
        prisma.user.count()
      ]);
      
      const totalPages = Math.ceil(totalUsers / pageSize);
      
      return {
        users,
        totalUsers,
        totalPages,
        currentPage: page,
        pageSize
      };
    } catch (error) {
      console.error('Ошибка при получении списка пользователей с пагинацией:', error);
      return {
        users: [],
        totalUsers: 0,
        totalPages: 0,
        currentPage: page,
        pageSize
      };
    }
  }
  
  /**
   * Обновляет данные пользователя
   * @param id ID пользователя
   * @param data Объект с обновляемыми данными
   * @returns Обновленный пользователь или null в случае ошибки
   */
  static async updateUser(id: number, data: { name?: string, passCode?: string, isActive?: boolean }): Promise<VirtualUser | null> {
    try {
      const user = await prisma.user.update({
        where: { id },
        data,
        include: {
          telegramAccounts: true,
          workSessions: true
        }
      });
      
      return user;
    } catch (error) {
      console.error('Ошибка при обновлении пользователя:', error);
      return null;
    }
  }
  
  /**
   * Перегенерирует код-пароль для пользователя
   * @param id ID пользователя
   * @returns Обновленный пользователь с новым кодом-паролем или null в случае ошибки
   */
  static async regeneratePassCode(id: number): Promise<VirtualUser | null> {
    try {
      const newPassCode = this.generatePassCode();
      
      const user = await prisma.user.update({
        where: { id },
        data: { passCode: newPassCode },
        include: {
          telegramAccounts: true,
          workSessions: true
        }
      });
      
      return user;
    } catch (error) {
      console.error('Ошибка при обновлении кода-пароля:', error);
      return null;
    }
  }
  
  /**
   * Добавляет телеграм аккаунт к виртуальному пользователю
   * @param userId ID виртуального пользователя
   * @param telegramId ID телеграм аккаунта
   * @param username Имя пользователя в телеграм
   * @param firstName Имя в телеграм
   * @param lastName Фамилия в телеграм
   * @returns Созданный телеграм аккаунт или null в случае ошибки
   */
  static async addTelegramAccount(
    userId: number, 
    telegramId: string, 
    username?: string, 
    firstName?: string, 
    lastName?: string
  ): Promise<TelegramAccount | null> {
    try {
      // Проверяем, существует ли уже такой аккаунт
      const existingAccount = await prisma.telegramAccount.findUnique({
        where: { telegramId }
      });
      
      if (existingAccount) {
        // Если аккаунт уже привязан к этому пользователю - просто возвращаем его
        if (existingAccount.userId === userId) {
          return existingAccount;
        }
        
        // Если привязан к другому пользователю - пробуем обновить привязку
        return await prisma.telegramAccount.update({
          where: { telegramId },
          data: { userId }
        });
      }
      
      // Создаём новую привязку аккаунта
      const account = await prisma.telegramAccount.create({
        data: {
          telegramId,
          username,
          firstName,
          lastName,
          userId
        }
      });
      
      return account;
    } catch (error) {
      console.error('Ошибка при добавлении телеграм аккаунта:', error);
      return null;
    }
  }
  
  /**
   * Получает список всех телеграм аккаунтов пользователя
   * @param userId ID виртуального пользователя
   * @returns Массив телеграм аккаунтов пользователя
   */
  static async getUserTelegramAccounts(userId: number): Promise<TelegramAccount[]> {
    try {
      const accounts = await prisma.telegramAccount.findMany({
        where: { userId }
      });
      
      return accounts;
    } catch (error) {
      console.error('Ошибка при получении списка телеграм аккаунтов:', error);
      return [];
    }
  }
  
  /**
   * Удаляет пользователя по ID
   * @param id ID пользователя
   * @returns true если пользователь успешно удален, false - в случае ошибки
   */
  static async deleteUser(id: number): Promise<boolean> {
    try {
      // Сначала удаляем все связанные записи
      await prisma.$transaction([
        // Удаляем телеграм аккаунты
        prisma.telegramAccount.deleteMany({
          where: { userId: id }
        }),
        // Удаляем рабочие сессии
        prisma.workSession.deleteMany({
          where: { userId: id }
        }),
        // Удаляем транзакции
        prisma.transaction.deleteMany({
          where: { userId: id }
        }),
        // Удаляем уведомления о отчетах
        prisma.reportNotification.deleteMany({
          where: { userId: id }
        }),
        // Удаляем самого пользователя
        prisma.user.delete({
          where: { id }
        })
      ]);
      
      return true;
    } catch (error) {
      console.error('Ошибка при удалении пользователя:', error);
      return false;
    }
  }
  
  /**
   * Генерирует случайный код-пароль
   * @returns Строка кода-пароля (8 символов)
   */
  private static generatePassCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const codeLength = 8;
    let code = '';
    
    const bytes = randomBytes(codeLength);
    for (let i = 0; i < codeLength; i++) {
      code += chars[bytes[i] % chars.length];
    }
    
    return code;
  }
  
  /**
   * Получает список всех пользователей с их телеграм-аккаунтами
   * @returns Массив пользователей с включенными телеграм-аккаунтами
   */
  static async getUsersWithTelegramAccounts(): Promise<VirtualUser[]> {
    try {
      const users = await prisma.user.findMany({
        include: {
          telegramAccounts: true
        }
      });
      
      return users;
    } catch (error) {
      console.error('Ошибка при получении пользователей с телеграм-аккаунтами:', error);
      return [];
    }
  }
  
  /**
   * Получает статистику пользователя
   * @param userId ID пользователя
   * @returns Объект с данными статистики или null в случае ошибки
   */
  static async getUserStats(userId: number): Promise<any | null> {
    try {
      // Получаем пользователя со всеми связанными данными
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          telegramAccounts: true,
          workSessions: true,
          transactions: true,
          reportNotifications: true
        }
      });
      
      if (!user) {
        return null;
      }
      
      // Общее время работы в минутах
      const totalWorkMinutes = user.workSessions.reduce((total, session) => {
        // Для завершенных сессий берем duration
        if (session.duration) {
          return total + session.duration;
        }
        
        // Для активных сессий рассчитываем время
        if (!session.endTime) {
          const now = new Date();
          const diffMs = now.getTime() - session.startTime.getTime();
          const diffMinutes = Math.floor(diffMs / (1000 * 60));
          return total + diffMinutes;
        }
        
        return total;
      }, 0);
      
      // Общее количество транзакций
      const totalTransactions = user.transactions.length;
      
      // Количество подтвержденных отчетов
      const reportStats = {
        total: user.reportNotifications.length,
        received: user.reportNotifications.filter(r => r.reportReceived).length,
        missed: user.reportNotifications.filter(r => !r.reportReceived).length
      };
      
      // Активная рабочая сессия
      const activeSession = user.workSessions.find(s => !s.endTime);
      
      return {
        user: {
          id: user.id,
          name: user.name,
          passCode: user.passCode,
          isActive: user.isActive,
          createdAt: user.createdAt
        },
        telegramAccounts: user.telegramAccounts,
        workTime: {
          totalMinutes: totalWorkMinutes,
          formattedTime: this.formatMinutesToHHMM(totalWorkMinutes),
          activeSession: activeSession ? {
            id: activeSession.id,
            startTime: activeSession.startTime
          } : null
        },
        transactions: {
          total: totalTransactions
        },
        reports: reportStats
      };
    } catch (error) {
      console.error('Ошибка при получении статистики пользователя:', error);
      return null;
    }
  }
  
  /**
   * Форматирует минуты в строку времени ЧЧ:ММ
   * @param minutes Количество минут
   * @returns Отформатированная строка времени
   */
  private static formatMinutesToHHMM(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
  
  /**
   * Получает детальную статистику пользователя
   */
  static async getUserDetailedStats(userId: number): Promise<any> {
    try {
      // Получаем пользователя с его сессиями
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          workSessions: true,
          transactions: true,
          telegramAccounts: true
        }
      });
      
      if (!user) {
        return null;
      }
      
      // Статистика по сессиям
      const allSessions = user.workSessions || [];
      const activeSessions = allSessions.filter(session => !session.endTime);
      
      // Вычисляем общее время работы (в минутах)
      let totalMinutes = 0;
      
      for (const session of allSessions) {
        if (session.duration) {
          totalMinutes += session.duration;
        } else if (session.startTime && session.endTime) {
          const duration = Math.floor((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60));
          totalMinutes += duration;
        }
      }
      
      // Форматируем время в часы и минуты
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      const totalWorkTime = `${hours}:${minutes.toString().padStart(2, '0')}`;
      
      // Последняя активность
      const lastSession = allSessions.sort((a, b) => {
        const aTime = a.endTime || a.startTime;
        const bTime = b.endTime || b.startTime;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      })[0];
      
      const lastActivity = lastSession 
        ? new Date(lastSession.endTime || lastSession.startTime).toLocaleString('ru-RU')
        : null;
      
      // Статистика по сессиям по дням недели
      const sessionsByDay = [0, 0, 0, 0, 0, 0, 0]; // Пн, Вт, Ср, Чт, Пт, Сб, Вс
      
      for (const session of allSessions) {
        const day = new Date(session.startTime).getDay();
        const adjustedDay = day === 0 ? 6 : day - 1; // Преобразуем в формат Пн=0, Вс=6
        sessionsByDay[adjustedDay]++;
      }
      
      // Статистика по транзакциям
      const transactions = user.transactions || [];
      const totalTransactions = transactions.length;
      
      let totalPurchaseAmount = 0;
      let totalSaleAmount = 0;
      
      for (const tx of transactions) {
        if (tx.type.toUpperCase() === 'BUY') {
          totalPurchaseAmount += parseFloat(tx.totalPrice.toString());
        } else if (tx.type.toUpperCase() === 'SELL') {
          totalSaleAmount += parseFloat(tx.totalPrice.toString());
        }
      }
      
      // Возвращаем объект с детальной статистикой
      return {
        totalSessions: allSessions.length,
        activeSessions: activeSessions.length,
        totalWorkTime,
        lastActivity,
        sessionsByDay,
        totalTransactions,
        totalPurchaseAmount: totalPurchaseAmount.toFixed(2),
        totalSaleAmount: totalSaleAmount.toFixed(2),
        transactionBalance: (totalSaleAmount - totalPurchaseAmount).toFixed(2),
        telegramAccounts: user.telegramAccounts.length
      };
    } catch (error) {
      console.error('Ошибка при получении детальной статистики пользователя:', error);
      return null;
    }
  }
}
