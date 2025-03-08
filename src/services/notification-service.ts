import { prisma } from './prisma';
import { ReportNotification } from '@/types';
import { AdminService } from './admin-service';
import { UserService } from './user-service';

/**
 * Сервис для работы с уведомлениями о загрузке отчетов
 */
export class NotificationService {
  
  /**
   * Создает уведомление о необходимости загрузки отчета
   * @param userId ID виртуального пользователя
   * @returns Созданное уведомление или null в случае ошибки
   */
  static async createReportNotification(userId: number): Promise<ReportNotification | null> {
    try {
      // Создаем новое уведомление
      const notification = await prisma.reportNotification.create({
        data: {
          userId,
          notificationTime: new Date(),
          reportReceived: false,
          adminNotified: false
        }
      });
      
      // Обновляем время последнего уведомления у пользователя
      await prisma.user.update({
        where: { id: userId },
        data: { lastNotification: new Date() }
      });
      
      return notification;
    } catch (error) {
      console.error('Ошибка при создании уведомления о загрузке отчета:', error);
      return null;
    }
  }
  
  /**
   * Отмечает уведомление как обработанное (отчет получен)
   * @param notificationId ID уведомления
   * @returns Обновленное уведомление или null в случае ошибки
   */
  static async markReportReceived(notificationId: number): Promise<ReportNotification | null> {
    try {
      return await prisma.reportNotification.update({
        where: { id: notificationId },
        data: {
          reportReceived: true,
          reportTime: new Date()
        }
      });
    } catch (error) {
      console.error('Ошибка при отметке уведомления как обработанного:', error);
      return null;
    }
  }
  
  /**
   * Отмечает уведомление как требующее внимания админа (отчет не получен вовремя)
   * @param notificationId ID уведомления
   * @returns Обновленное уведомление или null в случае ошибки
   */
  static async markAdminNotified(notificationId: number): Promise<ReportNotification | null> {
    try {
      return await prisma.reportNotification.update({
        where: { id: notificationId },
        data: {
          adminNotified: true,
          adminNotifyTime: new Date()
        }
      });
    } catch (error) {
      console.error('Ошибка при отметке уведомления для админа:', error);
      return null;
    }
  }
  
  /**
   * Получает последнее уведомление для пользователя
   * @param userId ID виртуального пользователя
   * @returns Последнее уведомление или null если уведомлений нет
   */
  static async getLastNotification(userId: number): Promise<ReportNotification | null> {
    try {
      return await prisma.reportNotification.findFirst({
        where: { userId },
        orderBy: { notificationTime: 'desc' }
      });
    } catch (error) {
      console.error('Ошибка при получении последнего уведомления:', error);
      return null;
    }
  }
  
  /**
   * Получает все необработанные уведомления, для которых нужно уведомить админа
   * @returns Массив необработанных уведомлений
   */
  static async getPendingAdminNotifications(): Promise<ReportNotification[]> {
    try {
      // Получаем настройки времени ожидания
      const settings = await AdminService.getSystemSettings();
      if (!settings) {
        return [];
      }
      
      // Вычисляем время, после которого нужно уведомить админа
      const currentTime = new Date();
      const thresholdTime = new Date(currentTime.getTime() - settings.reportWaitTime * 60 * 1000);
      
      // Находим все уведомления, которые требуют внимания админа
      const notifications = await prisma.reportNotification.findMany({
        where: {
          reportReceived: false,
          adminNotified: false,
          notificationTime: { lt: thresholdTime }
        },
        include: {
          user: true
        }
      });
      
      return notifications;
    } catch (error) {
      console.error('Ошибка при получении уведомлений для админа:', error);
      return [];
    }
  }
  
  /**
   * Получает список пользователей, которым нужно отправить напоминание
   * @returns Массив пользователей
   */
  static async getUsersForReminder(): Promise<{ user: any, shouldNotify: boolean }[]> {
    try {
      // Получаем настройки интервала напоминаний
      const settings = await AdminService.getSystemSettings();
      if (!settings) {
        return [];
      }
      
      // Получаем всех активных пользователей
      const users = await prisma.user.findMany({
        where: { isActive: true },
        include: {
          telegramAccounts: true,
          workSessions: {
            where: { endTime: null },
            take: 1
          }
        }
      });
      
      // Фильтруем пользователей, которым нужно отправить напоминание
      const usersForReminder = await Promise.all(users.map(async (user) => {
        // Проверяем, активна ли рабочая сессия у пользователя
        const isWorking = user.workSessions.length > 0;
        
        // Если пользователь не работает, не нужно отправлять напоминание
        if (!isWorking) {
          return { user, shouldNotify: false };
        }
        
        // Получаем последнее уведомление
        const lastNotification = await this.getLastNotification(user.id);
        
        // Вычисляем, нужно ли отправить новое уведомление
        let shouldNotify = false;
        
        // Если уведомлений еще не было, или прошло достаточно времени
        if (!lastNotification) {
          shouldNotify = true;
        } else {
          const currentTime = new Date();
          const lastNotificationTime = new Date(lastNotification.notificationTime);
          const diffMinutes = (currentTime.getTime() - lastNotificationTime.getTime()) / (60 * 1000);
          
          // Если прошло больше минут, чем указано в настройках
          shouldNotify = diffMinutes >= settings.reportReminderInterval;
        }
        
        return { user, shouldNotify };
      }));
      
      return usersForReminder;
    } catch (error) {
      console.error('Ошибка при получении пользователей для напоминаний:', error);
      return [];
    }
  }
  
  /**
   * Получает историю уведомлений пользователя
   * @param userId ID виртуального пользователя
   * @param page Номер страницы (начиная с 1)
   * @param pageSize Размер страницы
   * @returns Объект с уведомлениями и информацией о пагинации
   */
  static async getUserNotificationHistory(
    userId: number, 
    page: number = 1, 
    pageSize: number = 10
  ): Promise<{ notifications: ReportNotification[], total: number, page: number, totalPages: number }> {
    try {
      // Считаем общее количество уведомлений
      const total = await prisma.reportNotification.count({
        where: { userId }
      });
      
      // Вычисляем общее количество страниц
      const totalPages = Math.ceil(total / pageSize);
      
      // Нормализуем номер страницы
      const normalizedPage = Math.max(1, Math.min(page, totalPages || 1));
      
      // Получаем уведомления для текущей страницы
      const notifications = await prisma.reportNotification.findMany({
        where: { userId },
        orderBy: { notificationTime: 'desc' },
        skip: (normalizedPage - 1) * pageSize,
        take: pageSize
      });
      
      return {
        notifications,
        total,
        page: normalizedPage,
        totalPages
      };
    } catch (error) {
      console.error('Ошибка при получении истории уведомлений:', error);
      return {
        notifications: [],
        total: 0,
        page: 1,
        totalPages: 0
      };
    }
  }
  
  /**
   * Получает настройки уведомлений системы
   * @returns Объект с настройками уведомлений
   */
  static async getNotificationSettings(): Promise<Record<string, {enabled: boolean, recipients?: string[]}>> {
    try {
      // Временное решение без использования базы данных
      // Дефолтные настройки для всех типов уведомлений
      const defaultSettings = {
        session_start: { enabled: true },
        session_end: { enabled: true },
        new_transaction: { enabled: true },
        report_reminder: { enabled: true }
      };
      
      // В будущем можно добавить хранение настроек в БД
      // const notificationSettings = await prisma.notificationSettings.findFirst();
      
      return defaultSettings;
    } catch (error) {
      console.error('Ошибка при получении настроек уведомлений:', error);
      // В случае ошибки возвращаем дефолтные настройки
      return {
        session_start: { enabled: true },
        session_end: { enabled: true },
        new_transaction: { enabled: true },
        report_reminder: { enabled: true }
      };
    }
  }
  
  /**
   * Обновляет настройки уведомлений системы
   * @param notificationType Тип уведомления
   * @param enabled Статус включения/выключения
   * @returns Обновленные настройки уведомлений
   */
  static async updateNotificationSetting(
    notificationType: string,
    enabled: boolean
  ): Promise<Record<string, {enabled: boolean, recipients?: string[]}> | null> {
    try {
      // Получаем текущие настройки
      const currentSettings = await this.getNotificationSettings();
      
      // Обновляем конкретную настройку
      if (currentSettings[notificationType]) {
        currentSettings[notificationType].enabled = enabled;
      } else {
        currentSettings[notificationType] = { enabled };
      }
      
      // Получаем запись настроек или создаем новую
      const notificationSettingsRecord = await prisma.notificationSettings.findFirst();
      
      if (notificationSettingsRecord) {
        // Обновляем существующую запись
        await prisma.notificationSettings.update({
          where: { id: notificationSettingsRecord.id },
          data: {
            settings: currentSettings as any
          }
        });
      } else {
        // Создаем новую запись
        await prisma.notificationSettings.create({
          data: {
            settings: currentSettings as any
          }
        });
      }
      
      return currentSettings;
    } catch (error) {
      console.error('Ошибка при обновлении настроек уведомлений:', error);
      return null;
    }
  }
}
