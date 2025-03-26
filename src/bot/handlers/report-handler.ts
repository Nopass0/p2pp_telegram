import { Context } from 'telegraf';
import { message } from 'telegraf/filters';
import type { BotContext } from '@/types';
import { NotificationService } from '@/services/notification-service';
import { UserService } from '@/services/user-service';
import { KeyboardBuilder } from '../components/keyboard';
import { parseCSVBuffer } from '@/services/csv-parser';
import axios from 'axios';
import { TransactionService } from '@/services/transaction-service';
import { BybitParser } from '@/services/bybit-parser';
import { BybitTransactionService } from '@/services/bybit-transaction-service';

/**
 * Обработчик загрузки отчетов
 */
export class ReportHandler {
  /**
   * Инициализирует обработчики для управления отчетами
   * @param bot Экземпляр бота Telegraf
   */
  static init(bot: any) {
    // Обработка выбора типа отчета
    bot.hears('💸 Telegram кошелек', this.startTelegramReportUpload);
    bot.hears('📊 Bybit', this.startBybitReportUpload);
    bot.hears('❌ Отмена', this.cancelReportUpload);
    
    // Обработка загрузки файла отчета
    bot.on(message('document'), this.handleReportUpload);
  }
  
  /**
   * Отменяет процесс загрузки отчета
   */
  private static async cancelReportUpload(ctx: BotContext) {
    // Сбрасываем состояние
    ctx.session.lastAction = undefined;
    
    await ctx.reply(
      '❌ Загрузка отчета отменена.',
      ctx.session?.isAdmin ? KeyboardBuilder.adminMainMenu() : KeyboardBuilder.mainMenu()
    );
  }
  
  /**
   * Начинает процесс загрузки отчета для кошелька Telegram
   */
  private static async startTelegramReportUpload(ctx: BotContext) {
    // Проверка авторизации
    if (!ctx.session.userId) {
      await ctx.reply('Для загрузки отчета необходимо авторизоваться. Используйте команду "🔑 Ввести код".');
      return;
    }
    
    // Устанавливаем состояние "ожидает отчет Telegram"
    ctx.session.lastAction = 'waiting_telegram_report';
    
    // Получаем последнее уведомление
    const lastNotification = await NotificationService.getLastNotification(ctx.session.userId);
    
    await ctx.reply(
      'Пожалуйста, отправьте CSV-файл из бота @wallet или другой P2P-платформы для анализа транзакций.\n\n' +
      'Поддерживаются следующие форматы:\n' +
      '- CSV файл (полная обработка)\n' +
      '- Excel файлы (.xls, .xlsx) (базовая обработка)',
      KeyboardBuilder.cancelKeyboard()
    );
    
    // Если есть активное уведомление, отмечаем его как обработанное
    if (lastNotification && !lastNotification.reportReceived) {
      await NotificationService.markReportReceived(lastNotification.id);
    }
  }
  
  /**
   * Начинает процесс загрузки отчета для Bybit
   */
  private static async startBybitReportUpload(ctx: BotContext) {
    // Проверка авторизации
    if (!ctx.session.userId) {
      await ctx.reply('Для загрузки отчета необходимо авторизоваться. Используйте команду "🔑 Ввести код".');
      return;
    }
    
    // Устанавливаем состояние "ожидает отчет Bybit"
    ctx.session.lastAction = 'waiting_bybit_report';
    
    // Получаем последнее уведомление
    const lastNotification = await NotificationService.getLastNotification(ctx.session.userId);
    
    await ctx.reply(
      'Пожалуйста, отправьте XLS-файл с отчетом транзакций Bybit.\n\n' +
      'Поддерживаются файлы формата .xls',
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
    if (
      ctx.session.lastAction !== 'waiting_telegram_report' && 
      ctx.session.lastAction !== 'waiting_bybit_report'
    ) {
      return next();
    }
    
    // Проверка авторизации
    if (!ctx.session.userId) {
      await ctx.reply('Для загрузки отчета необходимо авторизоваться. Используйте команду "🔑 Ввести код".');
      ctx.session.lastAction = undefined;
      return;
    }
    
    const document = ctx.message.document;
    
    // Проверяем формат файла в зависимости от типа отчета
    const fileName = document.file_name.toLowerCase();
    let isValidExtension = false;
    
    if (ctx.session.lastAction === 'waiting_telegram_report') {
      // Для Telegram кошелька разрешены CSV, XLS, XLSX
      isValidExtension = ['.csv', '.xls', '.xlsx'].some(ext => fileName.endsWith(ext));
      
      if (!isValidExtension) {
        await ctx.reply(
          'Неподдерживаемый формат файла. Пожалуйста, загрузите отчет в формате CSV, XLS или XLSX.',
          KeyboardBuilder.cancelKeyboard()
        );
        return;
      }
    } else if (ctx.session.lastAction === 'waiting_bybit_report') {
      // Для Bybit разрешены только XLS
      isValidExtension = fileName.endsWith('.xls');
      
      if (!isValidExtension) {
        await ctx.reply(
          'Неподдерживаемый формат файла. Пожалуйста, загрузите отчет в формате XLS.',
          KeyboardBuilder.cancelKeyboard()
        );
        return;
      }
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
      
      // Обрабатываем файл в зависимости от типа отчета
      if (ctx.session.lastAction === 'waiting_telegram_report') {
        await ReportHandler.processTelegramReport(ctx, document, fileBuffer);
      } else if (ctx.session.lastAction === 'waiting_bybit_report') {
        await ReportHandler.processBybitReport(ctx, document, fileBuffer);
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
   * Обрабатывает отчет кошелька Telegram
   */
  private static async processTelegramReport(ctx: BotContext, document: any, fileBuffer: Buffer): Promise<void> {
    // Для CSV файлов используем парсер
    if (document.file_name.toLowerCase().endsWith('.csv')) {
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
        `✅ Файл "${document.file_name}" принят к обработке. В настоящее время полная обработка доступна только для CSV файлов.`,
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
  }
  
  /**
   * Обрабатывает отчет Bybit
   */
  private static async processBybitReport(ctx: BotContext, document: any, fileBuffer: Buffer): Promise<void> {
    try {
      // Парсим XLS файл
      const parsedData = await BybitParser.parseXLSBuffer(fileBuffer);
      
      // Сохраняем транзакции в базу данных
      const result = await BybitTransactionService.saveTransactions(ctx.session.userId, parsedData.transactions);
      
      // Формируем отчет о сохранении
      const statsText = `
📊 *Анализ транзакций Bybit*
      
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
    } catch (error) {
      console.error('Ошибка при обработке файла Bybit:', error);
      
      // Отправляем сообщение об ошибке
      await ctx.reply(
        `❌ Произошла ошибка при обработке файла Bybit: ${error.message || 'Неизвестная ошибка'}.\n\nПожалуйста, убедитесь, что файл имеет правильный формат и данные.`,
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
              `⏰ *Напоминание*\n\nПожалуйста, загрузите отчет о транзакциях, используя кнопку "📊 Загрузить отчет".`,
              {
                parse_mode: 'Markdown',
                ...KeyboardBuilder.mainMenu()
              }
            );
          } catch (error) {
            console.error(`Ошибка при отправке напоминания пользователю ${account.telegramId}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Ошибка при отправке напоминаний:', error);
    }
  }
}