import { Telegraf } from 'telegraf';
import { BotContext } from '@/types';
import { NotificationService } from './notification-service';
import { AdminService } from './admin-service';
import { UserService } from './user-service';
import { WorkSessionService } from './work-session-service';
import { KeyboardBuilder } from '../bot/components/keyboard';

/**
 * Сервис планировщика задач для бота
 */
export class SchedulerService {
  private static bot: Telegraf<BotContext>;
  private static notificationInterval: NodeJS.Timeout;
  private static sessionCheckInterval: NodeJS.Timeout;

  /**
   * Инициализирует планировщик и запускает задачи
   * @param bot Экземпляр бота Telegraf
   */
  static init(bot: Telegraf<BotContext>) {
    this.bot = bot;

    // Запускаем планировщики задач
    this.startNotificationScheduler();
    this.startSessionCheckScheduler();

    console.log('Планировщик задач запущен');
  }

  /**
   * Останавливает все задачи планировщика
   */
  static stop() {
    if (this.notificationInterval) {
      clearInterval(this.notificationInterval);
    }
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
    }
    console.log('Планировщик задач остановлен');
  }

  /**
   * Запускает планировщик уведомлений
   */
  private static startNotificationScheduler() {
    // Запускаем проверку каждую минуту
    this.notificationInterval = setInterval(async () => {
      try {
        await this.checkAndSendNotifications();
        await this.checkAndNotifyAdmins();
      } catch (error) {
        console.error('Ошибка в планировщике уведомлений:', error);
      }
    }, 60 * 1000); // Проверка каждую минуту
  }

  /**
   * Запускает планировщик проверки сессий
   */
  private static startSessionCheckScheduler() {
    // Запускаем проверку каждый час
    this.sessionCheckInterval = setInterval(async () => {
      try {
        await this.checkAndCloseInactiveSessions();
      } catch (error) {
        console.error('Ошибка в планировщике проверки сессий:', error);
      }
    }, 60 * 60 * 1000); // Проверка каждый час
  }

  /**
   * Проверяет и отправляет уведомления пользователям
   */
  private static async checkAndSendNotifications() {
    // Получаем пользователей, которым нужно отправить напоминание
    const usersForReminder = await NotificationService.getUsersForReminder();

    for (const { user, shouldNotify, lastNotification } of usersForReminder) {
      if (shouldNotify && user.telegramAccounts.length > 0) {
        // Создаем уведомление в базе данных
        const notification = await NotificationService.createReportNotification(user.id);

        if (notification) {
          // Получаем настройки
          const settings = await AdminService.getSystemSettings();
          
          // Отправляем уведомление всем привязанным телеграм аккаунтам
          for (const telegramAccount of user.telegramAccounts) {
            try {
              await this.bot.telegram.sendMessage(
                telegramAccount.telegramId,
                `⏰ *Напоминание о загрузке отчета*\n\n` +
                `Уважаемый ${user.name}, пожалуйста, не забудьте загрузить отчет о P2P транзакциях.\n\n` +
                `Если отчет не будет загружен в течение ${settings?.reportWaitTime || 10} минут, ` +
                `администраторы системы будут уведомлены.`,
                { 
                  parse_mode: 'Markdown',
                  reply_markup: KeyboardBuilder.mainMenu().reply_markup
                }
              );
              
              console.log(`Уведомление отправлено пользователю ${user.name} (${telegramAccount.telegramId})`);
              
              // Запускаем проверку для этого уведомления через настроенное время ожидания
              this.scheduleAdminNotificationCheck(notification.id, settings?.reportWaitTime || 10);
            } catch (error) {
              console.error(`Ошибка при отправке уведомления пользователю ${telegramAccount.telegramId}:`, error);
            }
          }
        }
      }
    }
  }

  /**
   * Запланировать проверку уведомления администраторов
   * @param notificationId ID уведомления
   * @param waitTimeMinutes Время ожидания в минутах
   */
  private static scheduleAdminNotificationCheck(notificationId: number, waitTimeMinutes: number) {
    setTimeout(async () => {
      try {
        // Проверяем текущее состояние уведомления
        const notification = await NotificationService.getNotificationById(notificationId);
        
        // Если уведомление существует и отчет не получен и администраторы еще не уведомлены
        if (notification && !notification.reportReceived && !notification.adminNotified) {
          // Отмечаем, что администраторы должны быть уведомлены
          await NotificationService.markAdminNotified(notificationId);
          
          // Получаем пользователя
          const user = await UserService.findUserById(notification.userId);
          
          if (user) {
            // Уведомляем всех администраторов
            await this.notifyAdminsAboutMissedReport(user, notification);
          }
        }
      } catch (error) {
        console.error('Ошибка при проверке уведомления администраторов:', error);
      }
    }, waitTimeMinutes * 60 * 1000); // Переводим минуты в миллисекунды
  }

  /**
   * Уведомить администраторов о пропущенном отчете
   * @param user Пользователь, который не предоставил отчет
   * @param notification Уведомление
   */
  private static async notifyAdminsAboutMissedReport(user: any, notification: any) {
    try {
      // Получаем всех администраторов
      const admins = await AdminService.getAllAdmins();
      
      if (admins.length === 0) {
        console.log('Нет администраторов для уведомления');
        return;
      }
      
      // Формируем сообщение об отсутствии отчета
      const message = `⚠️ *Внимание, администратор!*\n\n` +
        `Пользователь *${user.name}* (ID: ${user.id}) не предоставил отчет по запросу.\n\n` +
        `Время запроса: ${new Date(notification.notificationTime).toLocaleString('ru-RU')}\n\n` +
        `Пожалуйста, свяжитесь с пользователем для выяснения причин.`;
      
      // Отправляем сообщение всем администраторам
      for (const admin of admins) {
        try {
          await this.bot.telegram.sendMessage(
            admin.telegramId,
            message,
            { 
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: `👁️ Просмотреть пользователя`, callback_data: `user_${user.id}` }]
                ]
              }
            }
          );
          
          console.log(`Уведомление администратору ${admin.telegramId} отправлено`);
        } catch (error) {
          console.error(`Ошибка при отправке уведомления администратору ${admin.telegramId}:`, error);
        }
      }
    } catch (error) {
      console.error('Ошибка при уведомлении администраторов о пропущенном отчете:', error);
    }
  }

  /**
   * Проверяет и уведомляет администраторов о непредоставленных отчетах
   */
  private static async checkAndNotifyAdmins() {
    // Получаем уведомления, требующие внимания администраторов
    const pendingNotifications = await NotificationService.getPendingAdminNotifications();

    if (pendingNotifications.length > 0) {
      // Получаем список администраторов
      const admins = await AdminService.getAllAdmins();

      // Группируем уведомления по пользователям для более компактного отображения
      const userNotifications = new Map<number, typeof pendingNotifications>();
      
      for (const notification of pendingNotifications) {
        if (!userNotifications.has(notification.userId)) {
          userNotifications.set(notification.userId, []);
        }
        userNotifications.get(notification.userId)!.push(notification);
        
        // Отмечаем уведомление как обработанное для админа
        await NotificationService.markAdminNotified(notification.id);
      }

      // Отправляем уведомления всем администраторам
      for (const admin of admins) {
        try {
          // Формируем сообщение с информацией о пользователях, не предоставивших отчеты
          let message = `⚠️ *Внимание, администратор!*\n\n` +
            `Следующие пользователи не предоставили отчеты в указанное время:\n\n`;

          const userButtons = [];
          
          for (const [userId, notifications] of userNotifications.entries()) {
            const user = await UserService.findUserById(userId);
            if (user) {
              const notificationTimes = notifications
                .map(n => new Date(n.notificationTime).toLocaleString('ru-RU'))
                .join(', ');
              
              message += `*${user.name}* (ID: ${userId})\n` +
                `Время уведомлений: ${notificationTimes}\n\n`;
              
              // Добавляем кнопку для просмотра пользователя
              userButtons.push([{ text: `👁️ ${user.name}`, callback_data: `user_${userId}` }]);
            }
          }

          await this.bot.telegram.sendMessage(
            admin.telegramId,
            message,
            { 
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: userButtons
              }
            }
          );
          
          console.log(`Уведомление администратору отправлено: ${admin.telegramId}`);
        } catch (error) {
          console.error(`Ошибка при отправке уведомления администратору ${admin.telegramId}:`, error);
        }
      }
    }
  }

  /**
   * Проверяет и закрывает неактивные сессии
   */
  private static async checkAndCloseInactiveSessions() {
    // Находим все активные сессии с начатые более 24 часов назад
    const activeSessions = await WorkSessionService.getOldActiveSessions(24);

    for (const session of activeSessions) {
      try {
        // Автоматически завершаем сессию
        await WorkSessionService.completeSession(session.id);
        
        // Находим пользователя и его телеграм аккаунты
        const user = await UserService.findUserById(session.userId);
        
        if (user && user.telegramAccounts.length > 0) {
          // Уведомляем пользователя о закрытии сессии
          for (const telegramAccount of user.telegramAccounts) {
            try {
              await this.bot.telegram.sendMessage(
                telegramAccount.telegramId,
                `ℹ️ *Уведомление о рабочей сессии*\n\n` +
                `Ваша рабочая сессия была автоматически завершена системой, ` +
                `поскольку прошло более 24 часов с момента начала сессии.`,
                { 
                  parse_mode: 'Markdown',
                  reply_markup: KeyboardBuilder.mainMenu().reply_markup
                }
              );
            } catch (telegramError) {
              console.error(`Ошибка при отправке уведомления пользователю ${telegramAccount.telegramId}:`, telegramError);
            }
          }
        }
        
        console.log(`Рабочая сессия ID:${session.id} автоматически завершена`);
      } catch (error) {
        console.error(`Ошибка при автоматическом завершении сессии ID:${session.id}:`, error);
      }
    }
  }
}