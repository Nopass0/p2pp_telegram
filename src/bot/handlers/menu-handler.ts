import { Context } from 'telegraf';
import { BotContext } from '@/types';
import { KeyboardBuilder } from '../components/keyboard';
import { AuthHandler } from './auth-handler';
import { WorkSessionHandler } from './work-session-handler';
import { AdminService } from '@/services/admin-service';
import { UserService } from '@/services/user-service';
import { WorkSessionService } from '@/services/work-session-service';
import { TransactionService } from '@/services/transaction-service';
import { NotificationService } from '@/services/notification-service';

/**
 * Обработчик основных пунктов меню
 */
export class MenuHandler {
  /**
   * Инициализирует обработчики для пунктов меню
   * @param bot Экземпляр бота Telegraf
   */
  static init(bot: any) {
    // Главное меню пользователя
    bot.hears('🔑 Ввести код', AuthHandler.startAuthProcess);
    bot.hears('📊 Загрузить отчет', this.handleUploadReport);
    bot.hears('⏰ Начать работу', WorkSessionHandler.startWorkSession);
    bot.hears('⏹️ Закончить работу', WorkSessionHandler.endWorkSession);
    bot.hears('ℹ️ Информация о текущей сессии', WorkSessionHandler.getSessionInfo);
    bot.hears('📋 Моя статистика', this.handleMyStats);
    bot.hears('❓ Помощь', this.handleHelp);

    // Меню администратора
    bot.hears('👥 Управление пользователями', this.handleUserManagement);
    bot.hears('📊 Статистика', this.handleAdminStats);
    bot.hears('⚙️ Настройки', this.handleSettings);
    bot.hears('⚠️ Уведомления', this.handleNotifications);
    bot.hears('🔙 Обычный режим', this.switchToUserMode);

    // Меню управления пользователями
    bot.hears('➕ Добавить пользователя', this.handleAddUser);
    bot.hears('👁️ Список пользователей', this.handleUserList);
    bot.hears('🔙 Назад к админ-панели', this.switchToAdminMode);
  }

  /**
   * Обработчик загрузки отчета
   */
  static async handleUploadReport(ctx: BotContext) {
    // Инициализируем сессию, если она не существует
    if (!ctx.session) {
      ctx.session = {};
    }

    // Проверяем авторизацию
    if (!ctx.session.userId) {
      await ctx.reply(
        'Для доступа к функциям бота, пожалуйста, авторизуйтесь.',
        KeyboardBuilder.mainMenu()
      );
      return;
    }

    // Определяем, есть ли активная рабочая сессия
    const activeSession = await WorkSessionService.getActiveSession(ctx.session.userId);
    
    if (!activeSession) {
      await ctx.reply(
        '⚠️ Для загрузки отчета необходимо начать рабочую сессию. Используйте кнопку "⏰ Начать работу".',
        KeyboardBuilder.mainMenu()
      );
      return;
    }

    // Устанавливаем состояние сессии для ожидания файла
    ctx.session.lastAction = 'waiting_report';
    
    await ctx.reply(
      'Пожалуйста, перешлите CSV-файл из бота @wallet или другой P2P-платформы для анализа транзакций.\n\n' +
      'Поддерживаются следующие форматы:\n' +
      '- CSV файл (полная обработка)\n' +
      '- Excel файлы (.xls, .xlsx) (базовая обработка)',
      KeyboardBuilder.cancelKeyboard()
    );
  }

  /**
   * Обработчик запроса статистики пользователя
   */
  static async handleMyStats(ctx: BotContext) {
    // Инициализируем сессию, если она не существует
    if (!ctx.session) {
      ctx.session = {};
    }

    // Проверяем авторизацию
    if (!ctx.session.userId) {
      await ctx.reply(
        'Для доступа к функциям бота, пожалуйста, авторизуйтесь.',
        KeyboardBuilder.mainMenu()
      );
      return;
    }

    try {
      // Получаем текущего пользователя
      const userId = ctx.session.userId;
      const user = await UserService.findUserById(userId);
      
      if (!user) {
        throw new Error('Пользователь не найден');
      }
      
      // Получаем даты для статистики (последние 7 дней)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      
      // Получаем статистику рабочих сессий
      const sessionStats = await WorkSessionService.getWorkSessionStats(userId, startDate, endDate);
      
      // Получаем активную сессию, если она есть
      const activeSession = await WorkSessionService.getActiveSession(userId);
      
      // Получаем статистику транзакций
      const transactionStats = await TransactionService.getTransactionStats(userId, startDate, endDate);
      
      // Формируем сообщение
      let message = `📊 *Статистика пользователя ${user.name}*\n\n`;
      
      // Добавляем информацию о рабочих сессиях
      message += `*Рабочие сессии (за 7 дней):*\n`;
      message += `• Всего сессий: ${sessionStats.totalSessions}\n`;
      message += `• Общая продолжительность: ${formatDuration(sessionStats.totalDuration)}\n`;
      message += `• Средняя продолжительность: ${formatDuration(sessionStats.averageDuration)}\n\n`;
      
      // Добавляем информацию об активной сессии, если она есть
      if (activeSession) {
        const sessionDuration = Date.now() - new Date(activeSession.startTime).getTime();
        message += `*Текущая активная сессия:*\n`;
        message += `• Начало: ${new Date(activeSession.startTime).toLocaleString('ru-RU')}\n`;
        message += `• Продолжительность: ${formatDuration(sessionDuration)}\n\n`;
      }
      
      // Добавляем информацию о транзакциях
      message += `*Транзакции (за 7 дней):*\n`;
      message += `• Всего транзакций: ${transactionStats.totalTransactions}\n`;
      message += `• Покупки: ${transactionStats.totalBuy}\n`;
      message += `• Продажи: ${transactionStats.totalSell}\n\n`;
      
      // Добавляем детальную информацию по активам
      if (transactionStats.assets.length > 0) {
        message += `*Активы:*\n`;
        for (const asset of transactionStats.assets) {
          message += `• ${asset.asset}: ${asset.totalAmount.toFixed(8)} (средняя цена: ${asset.avgPrice.toFixed(2)})\n`;
        }
        message += '\n';
      }
      
      // Отправляем сообщение
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...KeyboardBuilder.mainMenu()
      });
    } catch (error) {
      console.error('Ошибка при получении статистики пользователя:', error);
      await ctx.reply(
        'Произошла ошибка при получении статистики. Пожалуйста, попробуйте позже.',
        KeyboardBuilder.mainMenu()
      );
    }
  }

  /**
   * Обработчик запроса помощи
   */
  static async handleHelp(ctx: BotContext) {
    await ctx.reply(
      'P2P Transaction Analyzer Bot Help 📋\n\n' +
      'Этот бот анализирует CSV файлы, содержащие данные транзакций P2P рынка.\n\n' +
      'Команды:\n' +
      '/start - Запустить бота и получить меню\n' +
      '/help - Показать это сообщение помощи\n\n' +
      'Как использовать:\n' +
      '1. Перешлите CSV файл из бота @wallet\n' +
      '2. Бот автоматически проанализирует данные транзакций\n\n' +
      'Примечание: Будут обработаны только CSV файлы, пересланные из бота @wallet.',
      ctx.session?.isAdmin ? KeyboardBuilder.adminMainMenu() : KeyboardBuilder.mainMenu()
    );
  }

  /**
   * Обработчик меню управления пользователями
   */
  static async handleUserManagement(ctx: BotContext) {
    // Инициализируем сессию, если она не существует
    if (!ctx.session) {
      ctx.session = {};
    }

    // Проверяем права администратора
    if (!ctx.session.isAdmin) {
      await ctx.reply(
        'У вас нет доступа к этой функции. Необходимы права администратора.',
        KeyboardBuilder.mainMenu()
      );
      return;
    }

    await ctx.reply(
      '👥 Управление пользователями\n\n' +
      'Выберите действие из меню:',
      KeyboardBuilder.adminUserManagementMenu()
    );
  }

  /**
   * Обработчик меню статистики администратора
   */
  static async handleAdminStats(ctx: BotContext) {
    // Инициализируем сессию, если она не существует
    if (!ctx.session) {
      ctx.session = {};
    }

    // Проверяем права администратора
    if (!ctx.session.isAdmin) {
      await ctx.reply(
        'У вас нет доступа к этой функции. Необходимы права администратора.',
        KeyboardBuilder.mainMenu()
      );
      return;
    }

    await ctx.reply(
      '📊 Статистика транзакций\n\n' +
      'Выберите период:',
      KeyboardBuilder.adminStatsMenu()
    );
  }

  /**
   * Обработчик меню настроек
   */
  static async handleSettings(ctx: BotContext) {
    // Инициализируем сессию, если она не существует
    if (!ctx.session) {
      ctx.session = {};
    }

    // Проверяем права администратора
    if (!ctx.session.isAdmin) {
      await ctx.reply(
        'У вас нет доступа к этой функции. Необходимы права администратора.',
        KeyboardBuilder.mainMenu()
      );
      return;
    }

    try {
      // Получаем текущие настройки системы
      const settings = await AdminService.getSystemSettings();
      
      if (!settings) {
        await ctx.reply(
          'Не удалось получить настройки системы. Пожалуйста, попробуйте позже.',
          KeyboardBuilder.adminMainMenu()
        );
        return;
      }
      
      // Формируем сообщение с текущими настройками
      const settingsMessage = `
⚙️ *Настройки системы*

*Интервал напоминаний:* ${settings.reportReminderInterval} минут
*Время ожидания отчета:* ${settings.reportWaitTime} минут

Для изменения настроек используйте команды:
/setReminderInterval [минуты] - изменить интервал напоминаний
/setWaitTime [минуты] - изменить время ожидания отчета
      `;
      
      await ctx.reply(
        settingsMessage, 
        { 
          ...KeyboardBuilder.adminMainMenu(),
          parse_mode: 'Markdown' 
        }
      );
      
      // Сохраняем информацию о том, что мы в режиме настроек
      ctx.session.settingsMode = true;
    } catch (error) {
      console.error('Ошибка при получении настроек:', error);
      await ctx.reply(
        'Произошла ошибка при получении настроек. Пожалуйста, попробуйте позже.',
        KeyboardBuilder.adminMainMenu()
      );
    }
  }

  /**
   * Обработчик меню уведомлений
   */
  static async handleNotifications(ctx: BotContext) {
    // Инициализируем сессию, если она не существует
    if (!ctx.session) {
      ctx.session = {};
    }

    // Проверяем права администратора
    if (!ctx.session.isAdmin) {
      await ctx.reply(
        'У вас нет доступа к этой функции. Необходимы права администратора.',
        KeyboardBuilder.mainMenu()
      );
      return;
    }

    try {
      // Получаем список доступных уведомлений
      const notificationTypes = [
        { id: 'session_start', name: 'Начало рабочей сессии' },
        { id: 'session_end', name: 'Окончание рабочей сессии' },
        { id: 'new_transaction', name: 'Новая транзакция' },
        { id: 'report_reminder', name: 'Напоминание об отчете' }
      ];
      
      // Получаем текущие настройки уведомлений
      const settings = await NotificationService.getNotificationSettings();
      
      // Формируем сообщение с настройками уведомлений
      let notificationMessage = '⚠️ *Управление уведомлениями*\n\n';
      
      // Добавляем информацию о каждом типе уведомлений
      for (const type of notificationTypes) {
        const isEnabled = settings[type.id]?.enabled || false;
        const statusText = isEnabled ? '✅ Включено' : '❌ Выключено';
        
        notificationMessage += `*${type.name}*: ${statusText}\n`;
        notificationMessage += `Переключить: /toggle_notification_${type.id}\n\n`;
      }
      
      // Добавляем информацию о получателях уведомлений
      notificationMessage += '*Получатели уведомлений:*\n';
      
      // Получаем список администраторов
      const admins = await AdminService.getAllAdmins();
      
      if (admins.length > 0) {
        for (const admin of admins) {
          const name = admin.firstName || admin.username || admin.telegramId;
          notificationMessage += `- ${name}\n`;
        }
      } else {
        notificationMessage += 'Не найдено администраторов для получения уведомлений\n';
      }
      
      await ctx.reply(
        notificationMessage,
        { 
          ...KeyboardBuilder.adminMainMenu(),
          parse_mode: 'Markdown' 
        }
      );
    } catch (error) {
      console.error('Ошибка при получении настроек уведомлений:', error);
      await ctx.reply(
        'Произошла ошибка при получении настроек уведомлений. Пожалуйста, попробуйте позже.',
        KeyboardBuilder.adminMainMenu()
      );
    }
  }

  /**
   * Обработчик добавления нового пользователя
   */
  static async handleAddUser(ctx: BotContext) {
    // Инициализируем сессию, если она не существует
    if (!ctx.session) {
      ctx.session = {};
    }

    // Проверяем права администратора
    if (!ctx.session.isAdmin) {
      await ctx.reply(
        'У вас нет доступа к этой функции. Необходимы права администратора.',
        KeyboardBuilder.mainMenu()
      );
      return;
    }

    // Запрашиваем имя пользователя
    await ctx.reply(
      '➕ *Добавление нового пользователя*\n\n' +
      'Пожалуйста, введите имя нового пользователя:',
      { 
        ...KeyboardBuilder.adminUserManagementMenu(),
        parse_mode: 'Markdown' 
      }
    );
    
    // Устанавливаем режим ожидания имени пользователя
    ctx.session.waitingForUserName = true;
  }

  /**
   * Обработчик списка пользователей
   */
  static async handleUserList(ctx: BotContext) {
    // Инициализируем сессию, если она не существует
    if (!ctx.session) {
      ctx.session = {};
    }

    // Проверяем права администратора
    if (!ctx.session.isAdmin) {
      await ctx.reply(
        'У вас нет доступа к этой функции. Необходимы права администратора.',
        KeyboardBuilder.mainMenu()
      );
      return;
    }

    try {
      // Получаем список всех пользователей
      const users = await UserService.getAllUsers();
      
      if (users.length === 0) {
        await ctx.reply(
          '👁️ *Список пользователей*\n\n' +
          'Пользователи не найдены. Добавьте пользователей через меню "Добавить пользователя".',
          { 
            ...KeyboardBuilder.adminUserManagementMenu(),
            parse_mode: 'Markdown' 
          }
        );
        return;
      }
      
      // Формируем сообщение со списком пользователей
      let userListMessage = '👁️ *Список пользователей*\n\n';
      
      for (const user of users) {
        // Получаем количество активных телеграм-аккаунтов
        const telegramAccounts = user.telegramAccounts || [];
        const activeAccounts = telegramAccounts.filter(account => account.userId === user.id);
        
        // Получаем информацию о последней сессии
        const lastSession = user.workSessions && user.workSessions.length > 0 
          ? user.workSessions[0] 
          : null;
        
        // Формируем информацию о пользователе
        userListMessage += `*ID:* ${user.id} | *Имя:* ${user.name}\n`;
        userListMessage += `*Код доступа:* ${user.passCode}\n`;
        userListMessage += `*Статус:* ${user.isActive ? '✅ Активен' : '❌ Неактивен'}\n`;
        userListMessage += `*Привязанные аккаунты:* ${activeAccounts.length}\n`;
        
        if (lastSession) {
          const sessionDate = new Date(lastSession.startTime).toLocaleDateString('ru-RU');
          userListMessage += `*Последняя сессия:* ${sessionDate}\n`;
        }
        
        userListMessage += '\n';
      }
      
      // Добавляем инструкции по управлению пользователями
      userListMessage += '*Управление пользователями:*\n';
      userListMessage += '/user_info [ID] - просмотреть детальную информацию\n';
      userListMessage += '/regenerate_code [ID] - сгенерировать новый код доступа\n';
      userListMessage += '/toggle_active [ID] - переключить статус активности\n';
      
      await ctx.reply(
        userListMessage,
        { 
          ...KeyboardBuilder.adminUserManagementMenu(),
          parse_mode: 'Markdown' 
        }
      );
    } catch (error) {
      console.error('Ошибка при получении списка пользователей:', error);
      await ctx.reply(
        'Произошла ошибка при получении списка пользователей. Пожалуйста, попробуйте позже.',
        KeyboardBuilder.adminUserManagementMenu()
      );
    }
  }

  /**
   * Переключение в режим обычного пользователя
   */
  static async switchToUserMode(ctx: BotContext) {
    // Инициализируем сессию, если она не существует
    if (!ctx.session) {
      ctx.session = {};
    }

    await ctx.reply(
      'Вы переключились в режим обычного пользователя.',
      KeyboardBuilder.mainMenu()
    );
  }

  /**
   * Обработчик переключения в режим администратора
   */
  static async switchToAdminMode(ctx: BotContext) {
    // Инициализируем сессию, если она не существует
    if (!ctx.session) {
      ctx.session = {};
    }

    // Проверяем права администратора
    if (!ctx.session.isAdmin) {
      await ctx.reply(
        'У вас нет доступа к этой функции. Необходимы права администратора.',
        KeyboardBuilder.mainMenu()
      );
      return;
    }

    await ctx.reply(
      'Вы вернулись в панель администратора.',
      KeyboardBuilder.adminMainMenu()
    );
  }
}

function formatDuration(duration: number) {
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = duration % 60;
  
  return `${hours} ч ${minutes} мин ${seconds} сек`;
}
