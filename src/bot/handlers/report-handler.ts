import { Telegraf } from 'telegraf';
import type { BotContext } from '@/types';
import { NotificationService } from '@/services/notification-service';
import { UserService } from '@/services/user-service';
import { KeyboardBuilder } from '../components/keyboard';

/**
 * Обработчик для управления отчетами пользователей
 */
export class ReportHandler {
  /**
   * Инициализирует обработчики для работы с отчетами
   * @param bot Экземпляр бота Telegraf
   */
  static init(bot: Telegraf<BotContext>) {
    // Кнопка "Загрузить отчет"
    bot.hears('📊 Загрузить отчет', async (ctx) => {
      try {
        // Проверяем авторизацию пользователя
        if (!ctx.session?.userId) {
          return ctx.reply('Для загрузки отчета необходимо авторизоваться. Введите ваш код-пароль.');
        }

        const userId = ctx.session.userId;

        // Получаем пользователя
        const user = await UserService.findUserById(userId);
        if (!user) {
          return ctx.reply('Ошибка: пользователь не найден.');
        }

        // Получаем список неотмеченных уведомлений
        const pendingNotifications = await NotificationService.getPendingNotificationsForUser(userId);
        
        if (pendingNotifications.length === 0) {
          return ctx.reply(
            '📝 У вас нет ожидающих отчетов. ' +
            'Загрузите CSV файл с транзакциями, когда получите напоминание.',
            KeyboardBuilder.mainMenu()
          );
        }

        // Запрашиваем загрузку отчета
        await ctx.reply(
          '📊 *Загрузка отчета*\n\n' +
          'Для загрузки отчета о P2P транзакциях, пожалуйста, перешлите CSV файл из бота @wallet.\n\n' +
          'Отчет должен содержать информацию о ваших транзакциях в формате CSV.',
          {
            parse_mode: 'Markdown',
            ...KeyboardBuilder.mainMenu()
          }
        );
      } catch (error) {
        console.error('Ошибка при запросе загрузки отчета:', error);
        await ctx.reply(
          '❌ Произошла ошибка при запросе загрузки отчета. Пожалуйста, попробуйте еще раз.',
          KeyboardBuilder.mainMenu()
        );
      }
    });

    // Обработка загрузки документа как отчета
    bot.on('document', async (ctx, next) => {
      try {
        // Если пользователь не авторизован, передаем управление дальше
        if (!ctx.session?.userId) {
          return next();
        }

        const userId = ctx.session.userId;
        
        // Проверяем наличие неотмеченных уведомлений
        const pendingNotifications = await NotificationService.getPendingNotificationsForUser(userId);
        
        // Если документ был отправлен в ответ на запрос отчета
        if (pendingNotifications.length > 0) {
          const document = ctx.message.document;
          
          // Проверяем формат файла
          if (document && document.file_name && document.file_name.toLowerCase().endsWith('.csv')) {
            await ctx.reply('⏳ Обработка отчета...');
            
            // Здесь можно добавить код для обработки CSV файла
            // В данном случае просто отмечаем все ожидающие уведомления как обработанные
            for (const notification of pendingNotifications) {
              await NotificationService.markReportReceived(notification.id);
            }
            
            await ctx.reply(
              '✅ Отчет успешно загружен и обработан!\n\n' +
              `Количество отмеченных уведомлений: ${pendingNotifications.length}\n\n` +
              'Спасибо за своевременное предоставление отчета.',
              KeyboardBuilder.mainMenu()
            );
            
            return;
          }
        }
        
        // Если это не отчет или нет ожидающих уведомлений, передаем управление дальше
        return next();
      } catch (error) {
        console.error('Ошибка при обработке отчета:', error);
        await ctx.reply(
          '❌ Произошла ошибка при обработке отчета. Пожалуйста, попробуйте еще раз.',
          KeyboardBuilder.mainMenu()
        );
      }
    });
    
    // Команда для просмотра истории отчетов
    bot.command('reports', async (ctx) => {
      try {
        // Проверяем авторизацию пользователя
        if (!ctx.session?.userId) {
          return ctx.reply('Для просмотра истории отчетов необходимо авторизоваться. Введите ваш код-пароль.');
        }

        const userId = ctx.session.userId;
        
        // Получаем историю отчетов пользователя
        const result = await NotificationService.getUserNotificationHistory(userId, 1, 10);
        
        if (result.notifications.length === 0) {
          return ctx.reply(
            '📋 *История отчетов*\n\n' +
            'У вас еще нет истории отчетов.',
            {
              parse_mode: 'Markdown',
              ...KeyboardBuilder.mainMenu()
            }
          );
        }
        
        // Формируем сообщение с историей отчетов
        let message = '📋 *История отчетов*\n\n';
        
        for (const notification of result.notifications) {
          const notificationTime = new Date(notification.notificationTime).toLocaleString('ru-RU');
          
          const status = notification.reportReceived 
            ? `✅ Получен (${notification.reportTime ? new Date(notification.reportTime).toLocaleString('ru-RU') : 'время не указано'})` 
            : '❌ Не получен';
          
          message += `• ${notificationTime}: ${status}\n`;
        }
        
        if (result.totalPages > 1) {
          message += `\n_Показаны последние ${result.notifications.length} из ${result.total} отчетов_`;
        }
        
        await ctx.reply(message, {
          parse_mode: 'Markdown',
          ...KeyboardBuilder.mainMenu()
        });
      } catch (error) {
        console.error('Ошибка при получении истории отчетов:', error);
        await ctx.reply(
          '❌ Произошла ошибка при получении истории отчетов. Пожалуйста, попробуйте еще раз.',
          KeyboardBuilder.mainMenu()
        );
      }
    });
    
    // Команда для просмотра статистики отчетов
    bot.command('reportstats', async (ctx) => {
      try {
        // Проверяем авторизацию пользователя
        if (!ctx.session?.userId) {
          return ctx.reply('Для просмотра статистики отчетов необходимо авторизоваться. Введите ваш код-пароль.');
        }

        const userId = ctx.session.userId;
        
        // Получаем статистику отчетов пользователя
        const stats = await NotificationService.getUserReportStats(userId);
        
        // Формируем сообщение со статистикой
        let message = '📊 *Статистика отчетов*\n\n';
        message += `Всего запросов отчетов: ${stats.total}\n`;
        message += `Предоставлено отчетов: ${stats.received} (${stats.receivedPercentage.toFixed(2)}%)\n`;
        message += `Пропущено отчетов: ${stats.missed} (${stats.missedPercentage.toFixed(2)}%)\n`;
        
        if (stats.averageResponseTime !== null) {
          message += `Среднее время ответа: ${stats.averageResponseTime} минут\n`;
        }
        
        await ctx.reply(message, {
          parse_mode: 'Markdown',
          ...KeyboardBuilder.mainMenu()
        });
      } catch (error) {
        console.error('Ошибка при получении статистики отчетов:', error);
        await ctx.reply(
          '❌ Произошла ошибка при получении статистики отчетов. Пожалуйста, попробуйте еще раз.',
          KeyboardBuilder.mainMenu()
        );
      }
    });
  }
}