import { Context } from 'telegraf';
import { message } from 'telegraf/filters';
import type { BotContext } from '@/types';
import { NotificationService } from '@/services/notification-service';
import { UserService } from '@/services/user-service';
import { KeyboardBuilder } from '../components/keyboard';
import { parseCSVBuffer } from '@/services/csv-parser';
import axios from 'axios';
import { TransactionService } from '@/services/transaction-service';

/**
 * Обработчик загрузки отчетов
 */
export class ReportHandler {
  /**
   * Инициализирует обработчики для управления отчетами
   * @param bot Экземпляр бота Telegraf
   */
  static init(bot: any) {
    // Кнопка загрузки отчета
    bot.hears('📊 Загрузить отчет', this.startReportUpload);
    
    // Обработка загрузки файла отчета
    bot.on(message('document'), this.handleReportUpload);
  }
  
  /**
   * Начинает процесс загрузки отчета
   */
  private static async startReportUpload(ctx: BotContext) {
    // Проверка авторизации
    if (!ctx.session.userId) {
      await ctx.reply('Для загрузки отчета необходимо авторизоваться. Используйте команду "🔑 Ввести код".');
      return;
    }
    
    // Устанавливаем состояние "ожидает отчет"
    ctx.session.lastAction = 'waiting_report';
    
    // Получаем последнее уведомление
    const lastNotification = await NotificationService.getLastNotification(ctx.session.userId);
    
    await ctx.reply(
      'Пожалуйста, отправьте файл с отчетом. Поддерживаются форматы CSV, XLS, XLSX.',
      KeyboardBuilder.cancelKeyboard()
    );
    
    // Если есть активное уведомление, отмечаем его как обработанное
    if (lastNotification && !lastNotification.reportReceived) {
      await NotificationService.markReportReceived(lastNotification.id);
    }
  }
  
  /**
   * Обрабатывает загрузку файла отчета
   */
  private static async handleReportUpload(ctx: BotContext, next: () => Promise<void>) {
    // Если не в режиме ожидания отчета, передаем управление дальше
    if (ctx.session.lastAction !== 'waiting_report') {
      return next();
    }
    
    // Проверка авторизации
    if (!ctx.session.userId) {
      await ctx.reply('Для загрузки отчета необходимо авторизоваться. Используйте команду "🔑 Ввести код".');
      ctx.session.lastAction = undefined;
      return;
    }
    
    const document = ctx.message.document;
    
    // Проверяем формат файла
    const validExtensions = ['.csv', '.xls', '.xlsx'];
    const fileName = document.file_name.toLowerCase();
    const isValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
    
    if (!isValidExtension) {
      await ctx.reply(
        'Неподдерживаемый формат файла. Пожалуйста, загрузите отчет в формате CSV, XLS или XLSX.',
        KeyboardBuilder.cancelKeyboard()
      );
      return;
    }
    
    try {
      // Отправляем сообщение о начале обработки
      await ctx.reply('⏳ Загрузка и обработка отчета...');
      
      // Получаем ссылку на файл
      const fileLink = await ctx.telegram.getFileLink(document.file_id);
      
      // Загружаем файл
      const response = await axios({
        method: 'get',
        url: fileLink.href,
        responseType: 'arraybuffer'
      });
      
      // Преобразуем в буфер
      const fileBuffer = Buffer.from(response.data);
      
      // Для CSV файлов используем парсер
      if (fileName.endsWith('.csv')) {
        // Парсим CSV файл
        const parsedData = await parseCSVBuffer(fileBuffer);
        
        // Сохраняем транзакции в базу данных
        const result = await TransactionService.saveTransactions(ctx.session.userId, parsedData.transactions);
        
        // Формируем отчет о сохранении
        const statsText = `
📊 *Анализ транзакций*
          
✅ Импортировано новых транзакций: ${result.added}
⚠️ Пропущено дублирующихся: ${result.duplicates}
          
*Сводка:*
- Общее количество: ${parsedData.summary.totalTransactions}
- Активы: ${Object.keys(parsedData.summary.totalAmount).join(', ')}`;
        
        // Получаем последнее уведомление и отмечаем отчет как полученный
        const lastNotification = await NotificationService.getLastNotification(ctx.session.userId);
        
        if (lastNotification && !lastNotification.reportReceived) {
          await NotificationService.markReportReceived(lastNotification.id);
        }
        
        // Сбрасываем состояние
        ctx.session.lastAction = undefined;
        
        // Отправляем отчет
        await ctx.reply(
          `✅ Файл "${document.file_name}" успешно обработан!\n\n${statsText}`,
          { 
            parse_mode: 'Markdown',
            ...KeyboardBuilder.mainMenu() 
          }
        );
      } else {
        // Для других форматов - просто подтверждение загрузки
        await ctx.reply(
          `✅ Файл "${document.file_name}" принят к обработке. В настоящее время поддерживается только полная обработка CSV файлов.`,
          KeyboardBuilder.mainMenu()
        );
        
        // Получаем последнее уведомление и отмечаем отчет как полученный
        const lastNotification = await NotificationService.getLastNotification(ctx.session.userId);
        
        if (lastNotification && !lastNotification.reportReceived) {
          await NotificationService.markReportReceived(lastNotification.id);
        }
        
        // Сбрасываем состояние
        ctx.session.lastAction = undefined;
      }
    } catch (error) {
      console.error('Ошибка при обработке файла отчета:', error);
      
      // Отправляем сообщение об ошибке
      await ctx.reply(
        `❌ Произошла ошибка при обработке файла: ${error.message || 'Неизвестная ошибка'}.\n\nПожалуйста, убедитесь, что файл имеет правильный формат и данные.`,
        KeyboardBuilder.mainMenu()
      );
      
      // Сбрасываем состояние
      ctx.session.lastAction = undefined;
    }
  }
  
  /**
   * Метод для отправки напоминаний о загрузке отчетов
   * @param bot Экземпляр бота Telegraf
   */
  static async sendReportReminders(bot: any) {
    try {
      // Получаем пользователей, которым нужно отправить напоминание
      const usersForReminder = await NotificationService.getUsersForReminder();
      
      for (const { user, shouldNotify } of usersForReminder) {
        // Если пользователю не нужно отправлять напоминание, пропускаем
        if (!shouldNotify) {
          continue;
        }
        
        // Если у пользователя нет Telegram аккаунтов, пропускаем
        if (!user.telegramAccounts || user.telegramAccounts.length === 0) {
          continue;
        }
        
        // Создаем новое уведомление
        const notification = await NotificationService.createReportNotification(user.id);
        
        if (!notification) {
          continue;
        }
        
        // Отправляем напоминание на все связанные Telegram аккаунты
        for (const account of user.telegramAccounts) {
          try {
            await bot.telegram.sendMessage(
              account.telegramId,
              `⚠️ <b>Напоминание о загрузке отчета</b> ⚠️\n\nПожалуйста, загрузите отчет о транзакциях.\n\nНапоминаем, что если отчет не будет загружен в течение 10 минут, администратор получит уведомление.`,
              {
                parse_mode: 'HTML',
                reply_markup: KeyboardBuilder.mainMenu().reply_markup
              }
            );
          } catch (error) {
            console.error(`Ошибка при отправке напоминания пользователю ${user.id}, аккаунт ${account.telegramId}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Ошибка при отправке напоминаний о загрузке отчетов:', error);
    }
  }
  
  /**
   * Метод для проверки и отправки уведомлений администраторам
   * @param bot Экземпляр бота Telegraf
   */
  static async checkAndNotifyAdmins(bot: any) {
    try {
      // Получаем уведомления, требующие внимания администратора
      const pendingNotifications = await NotificationService.getPendingAdminNotifications();
      
      if (pendingNotifications.length === 0) {
        return;
      }
      
      // Получаем список администраторов
      const admins = await UserService.getAdmins();
      
      if (!admins || admins.length === 0) {
        return;
      }
      
      // Группируем уведомления по пользователям
      const userNotifications = new Map<number, { user: any, count: number }>();
      
      for (const notification of pendingNotifications) {
        const userId = notification.userId;
        
        // Отмечаем, что администратор уведомлен
        await NotificationService.markAdminNotified(notification.id);
        
        // Группируем уведомления
        if (!userNotifications.has(userId)) {
          userNotifications.set(userId, { user: notification.user, count: 0 });
        }
        
        userNotifications.get(userId).count++;
      }
      
      // Отправляем уведомления всем администраторам
      for (const admin of admins) {
        // Пропускаем если у админа нет телеграм аккаунтов
        if (!admin.telegramAccounts || admin.telegramAccounts.length === 0) {
          continue;
        }
        
        // Формируем сообщение
        let message = '⚠️ <b>Оповещение для администратора</b> ⚠️\n\n';
        message += 'Следующие пользователи не загрузили отчеты после напоминаний:\n\n';
        
        userNotifications.forEach(({ user, count }, userId) => {
          message += `- ${user.name}: ${count} незагруженных отчетов\n`;
        });
        
        // Отправляем уведомление на все телеграм аккаунты администратора
        for (const account of admin.telegramAccounts) {
          try {
            await bot.telegram.sendMessage(
              account.telegramId,
              message,
              {
                parse_mode: 'HTML',
                reply_markup: KeyboardBuilder.adminMainMenu().reply_markup
              }
            );
          } catch (error) {
            console.error(`Ошибка при отправке уведомления администратору ${admin.id}, аккаунт ${account.telegramId}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Ошибка при отправке уведомлений администраторам:', error);
    }
  }
}