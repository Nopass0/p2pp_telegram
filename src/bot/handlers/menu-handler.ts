import { Context } from 'telegraf';
import type { BotContext } from '@/types';
import { KeyboardBuilder } from '../components/keyboard';
import { AuthHandler } from './auth-handler';
import { WorkSessionHandler } from './work-session-handler';
import { AdminService } from '@/services/admin-service';
import { UserService } from '@/services/user-service';
import { WorkSessionService } from '@/services/work-session-service';
import { TransactionService } from '@/services/transaction-service';
import { IDEXService } from '@/services/idex-service';
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
    bot.hears('📱 IDEX', this.handleIdex);
    // bot.hears('Bybit')
    bot.hears('⚙️ Настройки', this.handleSettings);
    bot.hears('⚠️ Уведомления', this.handleNotifications);
    bot.hears('🔙 Обычный режим', this.switchToUserMode);

    // Меню управления пользователями
    bot.hears('➕ Добавить пользователя', this.handleAddUser);
    bot.hears('👁️ Список пользователей', this.handleUserList);
    bot.hears('🔙 Назад к админ-панели', this.switchToAdminMode);

    // Меню IDEX
    bot.hears('📱 IDEX Кабинеты', this.handleIdexCabinets);
    bot.hears('➕ Добавить IDEX кабинет', this.handleAddIdexCabinet);
    bot.hears('❌ Удалить IDEX кабинет', this.handleDeleteIdexCabinet);
    bot.hears('🔄 Синхронизировать все кабинеты', this.handleSyncAllIdexCabinets);

    // Inline-кнопки для IDEX
    bot.action(/^idex_page_(\d+)$/, async (ctx: BotContext) => {
      if (!ctx.match) return;
      const page = parseInt(ctx.match[1]);
      await this.showIdexCabinets(ctx, page);
    });

    bot.action('back_to_admin', async (ctx: BotContext) => {
      await ctx.deleteMessage();
      await this.switchToAdminMode(ctx);
    });

    bot.action('back_to_idex_cabinets', async (ctx: BotContext) => {
      await ctx.deleteMessage();
      await this.showIdexCabinets(ctx, 1);
    });

    bot.action(/^back_to_idex_cabinet_(\d+)$/, async (ctx: BotContext) => {
      if (!ctx.match) return;
      const cabinetId = parseInt(ctx.match[1]);
      await ctx.deleteMessage();
      await this.showIdexCabinetActions(ctx, cabinetId);
    });

    bot.action(/^view_idex_cabinet_(\d+)$/, async (ctx: BotContext) => {
      if (!ctx.match) return;
      const cabinetId = parseInt(ctx.match[1]);
      await this.showIdexCabinetActions(ctx, cabinetId);
    });

    bot.action(/^sync_idex_cabinet_(\d+)$/, async (ctx: BotContext) => {
      if (!ctx.match) return;
      const cabinetId = parseInt(ctx.match[1]);
      await this.handleSyncIdexCabinet(ctx, cabinetId);
    });

    bot.action('sync_all_idex_cabinets', async (ctx: BotContext) => {
      await this.handleSyncAllIdexCabinetsInline(ctx);
    });

    bot.action(/^delete_idex_cabinet_(\d+)$/, async (ctx: BotContext) => {
      if (!ctx.match) return;
      const cabinetId = parseInt(ctx.match[1]);
      await this.handleDeleteIdexCabinet(ctx, cabinetId);
    });

    bot.action(/^view_idex_transactions_(\d+)_(\d+)$/, async (ctx: BotContext) => {
      if (!ctx.match) return;
      const cabinetId = parseInt(ctx.match[1]);
      const page = parseInt(ctx.match[2]);
      await this.showIdexCabinetTransactions(ctx, cabinetId, page);
    });

    bot.action(/^idex_time_filter_(\d+)$/, async (ctx: BotContext) => {
      if (!ctx.match) return;
      const cabinetId = parseInt(ctx.match[1]);
      await this.handleIdexTimeFilter(ctx);
    });

    bot.action(/^custom_date_range_(\d+)$/, async (ctx: BotContext) => {
      if (!ctx.match) return;
      const cabinetId = parseInt(ctx.match[1]);
      await this.handleCustomDateRangeRequest(ctx);
    });

    bot.action(/^view_idex_cabinet_details_(\d+)$/, async (ctx: BotContext) => {
      if (!ctx.match) return;
      const cabinetId = parseInt(ctx.match[1]);
      await this.handleViewIdexCabinetDetails(ctx);
    });

    bot.action(/^view_idex_transactions_(\d+)_(\d+)_(\w+)$/, async (ctx: BotContext) => {
      if (!ctx.match) return;
      const cabinetId = parseInt(ctx.match[1]);
      const page = parseInt(ctx.match[2]);
      const timeFilter = ctx.match[3];
      await this.handleViewIdexTransactions(ctx, cabinetId, page, timeFilter);
    });

    bot.action(/^back_to_idex_cabinet_from_transactions_(\d+)$/, async (ctx: BotContext) => {
      if (!ctx.match) return;
      const cabinetId = parseInt(ctx.match[1]);
      await this.handleBackToIdexCabinet(ctx, cabinetId);
    });

    bot.action(/^view_idex_transactions_(\d+)_(\d+)_(.+)$/, async (ctx: BotContext) => {
      if (!ctx.match) return;
      const cabinetId = parseInt(ctx.match[1]);
      const page = parseInt(ctx.match[2]);
      const timeFilter = ctx.match[3];
      await this.showIdexCabinetTransactions(ctx, cabinetId, page, timeFilter);
    });

    bot.action(/^idex_time_filter_(\d+)$/, async (ctx: BotContext) => {
      if (!ctx.match) return;
      const cabinetId = parseInt(ctx.match[1]);
      await this.handleIdexTimeFilter(ctx);
    });
  }

  /**
   * Обработчик IDEX
   */
  static async handleIdex(ctx: BotContext) {
    try {
      // Проверяем, что пользователь является администратором
      if (!ctx.session?.isAdmin) {
        await ctx.reply('У вас нет доступа к этому разделу. Требуются права администратора.');
        return;
      }

      // Отправляем сообщение и клавиатуру меню IDEX
      await ctx.reply('📱 *Управление IDEX кабинетами*\n\nВыберите действие:', {
        parse_mode: 'Markdown',
        ...KeyboardBuilder.idexMenu()
      });
    } catch (error) {
      console.error('Ошибка при обработке меню IDEX:', error);
      await ctx.reply('Произошла ошибка при открытии меню IDEX. Пожалуйста, попробуйте позже.');
    }
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

    // Предлагаем выбрать тип отчета
    ctx.session.lastAction = 'waiting_report_type';
    
    await ctx.reply(
      'Выберите тип отчета, который вы хотите загрузить:',
      KeyboardBuilder.reportTypeKeyboard()
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

  /**
   * Обработчик IDEX кабинетов
   */
  static async handleIdexCabinets(ctx: BotContext) {
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

    // Получаем список IDEX кабинетов с пагинацией (первая страница)
    await MenuHandler.showIdexCabinets(ctx, 1);
  }

  /**
   * Показывает список IDEX кабинетов с пагинацией
   * @param ctx Контекст бота
   * @param page Номер страницы
   */
  static async showIdexCabinets(ctx: BotContext, page: number) {
    try {
      // Получаем список кабинетов с пагинацией
      const result = await IDEXService.getAllCabinets(page);
      
      // Формируем сообщение со списком кабинетов
      let message = '📱 *IDEX Кабинеты*\n\n';
      
      if (result.cabinets.length > 0) {
        result.cabinets.forEach((cabinet, index) => {
          message += `*${index + 1}.* ID: ${cabinet.id}\n`;
          message += `   IDEX ID: ${cabinet.idexId}\n`;
          message += `   Логин: ${cabinet.login}\n`;
          message += `   Транзакций: ${cabinet._count.transactions}\n`;
          message += `   Добавлен: ${new Date(cabinet.createdAt).toLocaleDateString('ru-RU')}\n\n`;
        });
      } else {
        message += 'Кабинеты не найдены. Добавьте новый кабинет, используя кнопку "➕ Добавить кабинет".\n\n';
      }
      
      message += `Страница ${result.currentPage} из ${result.totalPages}\n`;
      message += `Всего кабинетов: ${result.totalCount}`;
      
      // Создаем инлайн клавиатуру для пагинации и действий с кабинетами
      const keyboard = KeyboardBuilder.idexCabinetKeyboard(result.currentPage, result.totalPages, result.cabinets);
      
      await ctx.reply(message, { 
        parse_mode: 'Markdown',
        ...keyboard
      });
    } catch (error) {
      console.error('Ошибка при получении списка IDEX кабинетов:', error);
      await ctx.reply(
        'Произошла ошибка при получении списка IDEX кабинетов. Пожалуйста, попробуйте позже.',
        KeyboardBuilder.adminMainMenu()
      );
    }
  }

  /**
   * Обработчик добавления нового IDEX кабинета
   */
  static async handleAddIdexCabinet(ctx: BotContext) {
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

    // Очищаем предыдущие данные ввода, если они были
    ctx.session.idexCabinetData = {};
    
    // Устанавливаем состояние сессии для ожидания IDEX ID
    ctx.session.idexCabinetStep = 'waiting_idex_id';
    
    await ctx.reply(
      '📱 *Добавление нового IDEX кабинета*\n\n' +
      'Пожалуйста, введите ID кабинета IDEX (только цифры):',
      { 
        parse_mode: 'Markdown',
        ...KeyboardBuilder.cancelKeyboard()
      }
    );
  }

  /**
   * Обработчик ввода ID кабинета IDEX
   */
  static async handleIdexCabinetId(ctx: BotContext, text: string) {
    // Проверяем, что введены только цифры
    if (!/^\d+$/.test(text)) {
      await ctx.reply(
        'Пожалуйста, введите только цифры для ID кабинета IDEX:',
        KeyboardBuilder.cancelKeyboard()
      );
      return;
    }
    
    // Сохраняем ID в сессии
    ctx.session.idexCabinetData = {
      ...ctx.session.idexCabinetData,
      idexId: parseInt(text, 10)
    };
    
    // Устанавливаем следующий шаг - ввод логина
    ctx.session.idexCabinetStep = 'waiting_login';
    
    await ctx.reply(
      'Пожалуйста, введите логин для кабинета IDEX:',
      KeyboardBuilder.cancelKeyboard()
    );
  }

  /**
   * Обработчик ввода логина кабинета IDEX
   */
  static async handleIdexCabinetLogin(ctx: BotContext, text: string) {
    // Сохраняем логин в сессии
    ctx.session.idexCabinetData = {
      ...ctx.session.idexCabinetData,
      login: text
    };
    
    // Устанавливаем следующий шаг - ввод пароля
    ctx.session.idexCabinetStep = 'waiting_password';
    
    await ctx.reply(
      'Пожалуйста, введите пароль для кабинета IDEX:',
      KeyboardBuilder.cancelKeyboard()
    );
  }

  /**
   * Обработчик ввода пароля кабинета IDEX
   */
  static async handleIdexCabinetPassword(ctx: BotContext, text: string) {
    try {
      // Сохраняем пароль в данных кабинета
      ctx.session.idexCabinetData = {
        ...ctx.session.idexCabinetData,
        password: text
      };
      
      // Проверяем наличие всех необходимых данных
      if (ctx.session.idexCabinetData.idexId === undefined || !ctx.session.idexCabinetData.login || !ctx.session.idexCabinetData.password) {
        await ctx.reply(
          '❌ Ошибка: не все данные для создания кабинета были указаны. Пожалуйста, начните процесс добавления заново.',
          KeyboardBuilder.adminMainMenu()
        );
        return;
      }
      
      // Создаем новый кабинет в БД
      const { idexId, login, password } = ctx.session.idexCabinetData;
      
      await IDEXService.createCabinet(idexId, login, password);
      
      // Очищаем данные формы
      delete ctx.session.idexCabinetData;
      delete ctx.session.idexCabinetStep;
      
      await ctx.reply(
        '✅ IDEX кабинет успешно добавлен!',
        KeyboardBuilder.adminMainMenu()
      );
      
      // Показываем обновленный список кабинетов
      await MenuHandler.showIdexCabinets(ctx, 1);
    } catch (error) {
      console.error('Ошибка при создании IDEX кабинета:', error);
      await ctx.reply(
        'Произошла ошибка при создании IDEX кабинета. Пожалуйста, попробуйте позже.',
        KeyboardBuilder.adminMainMenu()
      );
    }
  }

  /**
   * Обработчик удаления IDEX кабинета
   */
  static async handleDeleteIdexCabinet(ctx: BotContext, cabinetId: number) {
    try {
      // Проверяем существование кабинета
      const cabinet = await IDEXService.getCabinetById(cabinetId);
      
      if (!cabinet) {
        await ctx.reply(
          'Кабинет не найден. Возможно, он уже был удален.',
          KeyboardBuilder.adminMainMenu()
        );
        return;
      }
      
      // Запрашиваем подтверждение удаления
      await ctx.reply(
        `❓ Вы действительно хотите удалить IDEX кабинет ID ${cabinetId}?`,
        KeyboardBuilder.confirmationKeyboard('delete_idex', cabinetId)
      );
    } catch (error) {
      console.error('Ошибка при запросе удаления IDEX кабинета:', error);
      await ctx.reply(
        'Произошла ошибка при запросе удаления IDEX кабинета. Пожалуйста, попробуйте позже.',
        KeyboardBuilder.adminMainMenu()
      );
    }
  }

  /**
   * Обработчик подтверждения удаления IDEX кабинета
   */
  static async handleConfirmDeleteIdexCabinet(ctx: BotContext, cabinetId: number) {
    try {
      // Удаляем кабинет
      await IDEXService.deleteCabinet(cabinetId);
      
      await ctx.reply(
        '✅ IDEX кабинет успешно удален!',
        KeyboardBuilder.adminMainMenu()
      );
      
      // Показываем обновленный список кабинетов
      await MenuHandler.showIdexCabinets(ctx, 1);
    } catch (error) {
      console.error('Ошибка при удалении IDEX кабинета:', error);
      await ctx.reply(
        'Произошла ошибка при удалении IDEX кабинета. Пожалуйста, попробуйте позже.',
        KeyboardBuilder.adminMainMenu()
      );
    }
  }

  /**
   * Обработчик синхронизации всех IDEX кабинетов
   */
  static async handleSyncAllIdexCabinets(ctx: BotContext) {
    try {
      // Проверяем, что пользователь является администратором
      if (!ctx.session?.isAdmin) {
        await ctx.reply('У вас нет доступа к этому разделу. Требуются права администратора.');
        return;
      }

      // Отправляем сообщение о начале синхронизации
      const message = await ctx.reply('🔄 Начата синхронизация всех IDEX кабинетов. Этот процесс может занять некоторое время...');
      
      // Запускаем синхронизацию
      await IDEXService.syncAllCabinetsTransactions();
      
      // Отправляем сообщение о завершении синхронизации
      await ctx.reply('✅ Синхронизация всех IDEX кабинетов успешно завершена!', 
        KeyboardBuilder.idexMenu()
      );
    } catch (error) {
      console.error('Ошибка при синхронизации IDEX кабинетов:', error);
      await ctx.reply('❌ Произошла ошибка при синхронизации IDEX кабинетов. Пожалуйста, попробуйте позже.', 
        KeyboardBuilder.idexMenu()
      );
    }
  }

  /**
   * Обработчик синхронизации всех IDEX кабинетов через inline-кнопку
   */
  static async handleSyncAllIdexCabinetsInline(ctx: BotContext) {
    try {
      // Проверяем, что пользователь является администратором
      if (!ctx.session?.isAdmin) {
        await ctx.reply('У вас нет доступа к этому разделу. Требуются права администратора.');
        return;
      }

      // Отправляем сообщение о начале синхронизации
      await ctx.editMessageText('🔄 Начата синхронизация всех IDEX кабинетов. Этот процесс может занять некоторое время...');
      
      // Запускаем синхронизацию
      await IDEXService.syncAllCabinetsTransactions();
      
      // Отправляем сообщение о завершении синхронизации
      await ctx.editMessageText('✅ Синхронизация всех IDEX кабинетов успешно завершена!', {
        ...KeyboardBuilder.idexCabinetKeyboard(1, 1)
      });
      
      // Показываем обновленный список кабинетов
      await this.showIdexCabinets(ctx, 1);
    } catch (error) {
      console.error('Ошибка при синхронизации IDEX кабинетов:', error);
      await ctx.reply('❌ Произошла ошибка при синхронизации IDEX кабинетов. Пожалуйста, попробуйте позже.', 
        KeyboardBuilder.idexMenu()
      );
    }
  }

  /**
   * Обработчик синхронизации конкретного IDEX кабинета
   */
  static async handleSyncIdexCabinet(ctx: BotContext, cabinetId: number) {
    try {
      // Проверяем, что пользователь является администратором
      if (!ctx.session?.isAdmin) {
        await ctx.reply('У вас нет доступа к этому разделу. Требуются права администратора.');
        return;
      }

      // Отправляем сообщение о начале синхронизации
      await ctx.editMessageText('🔄 Начата синхронизация кабинета IDEX. Этот процесс может занять некоторое время...');
      
      // Запускаем синхронизацию
      await IDEXService.syncCabinetTransactionsById(cabinetId);
      
      // Отправляем сообщение о завершении синхронизации и показываем информацию о кабинете
      await this.showIdexCabinetActions(ctx, cabinetId);
    } catch (error) {
      console.error('Ошибка при синхронизации IDEX кабинета:', error);
      await ctx.reply('❌ Произошла ошибка при синхронизации IDEX кабинета. Пожалуйста, попробуйте позже.',
        KeyboardBuilder.idexMenu()
      );
    }
  }

  /**
   * Показывает информацию о кабинете IDEX и действия с ним
   */
  static async showIdexCabinetActions(ctx: BotContext, cabinetId: number) {
    try {
      // Получаем информацию о кабинете
      const cabinet = await IDEXService.getCabinetById(cabinetId);
      
      if (!cabinet) {
        await ctx.reply(
          'Кабинет не найден. Возможно, он уже был удален.',
          KeyboardBuilder.adminMainMenu()
        );
        return;
      }
      
      // Получаем статистику транзакций
      const { totalCount } = await IDEXService.getCabinetTransactions(cabinetId, 1, 1);
      
      // Формируем сообщение
      const message = `
📱 *IDEX Кабинет #${cabinet.id}*

*ID в системе IDEX:* ${cabinet.idexId}
*Логин:* \`${cabinet.login}\`
*Транзакций в базе:* ${totalCount}

_Выберите действие:_
      `;
      
      // Если сообщение отправлено через inline-кнопку, редактируем его
      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...KeyboardBuilder.idexCabinetActionsKeyboard(cabinetId)
        });
      } else {
        // Иначе отправляем новое сообщение
        await ctx.reply(message, {
          parse_mode: 'Markdown',
          ...KeyboardBuilder.idexCabinetActionsKeyboard(cabinetId)
        });
      }
    } catch (error) {
      console.error('Ошибка при показе информации о кабинете IDEX:', error);
      await ctx.reply(
        'Произошла ошибка при получении информации о кабинете IDEX. Пожалуйста, попробуйте позже.',
        KeyboardBuilder.idexMenu()
      );
    }
  }

  /**
   * Обработчик синхронизации конкретного IDEX кабинета
   */
  static async handleSyncIdexCabinet(ctx: BotContext, cabinetId: number) {
    try {
      // Проверяем, что пользователь является администратором
      if (!ctx.session?.isAdmin) {
        await ctx.reply('У вас нет доступа к этому разделу. Требуются права администратора.');
        return;
      }

      // Отправляем сообщение о начале синхронизации
      await ctx.editMessageText('🔄 Начата синхронизация кабинета IDEX. Этот процесс может занять некоторое время...');
      
      // Запускаем синхронизацию
      await IDEXService.syncCabinetTransactionsById(cabinetId);
      
      // Отправляем сообщение о завершении синхронизации и показываем информацию о кабинете
      await this.showIdexCabinetActions(ctx, cabinetId);
    } catch (error) {
      console.error('Ошибка при синхронизации IDEX кабинета:', error);
      await ctx.reply('❌ Произошла ошибка при синхронизации IDEX кабинета. Пожалуйста, попробуйте позже.',
        KeyboardBuilder.idexMenu()
      );
    }
  }

  /**
   * Показывает транзакции IDEX кабинета с пагинацией
   * @param ctx Контекст бота
   * @param cabinetId ID кабинета
   * @param page Номер страницы
   * @param timeFilter Фильтр по времени
   */
  static async showIdexCabinetTransactions(
    ctx: BotContext, 
    cabinetId: number, 
    page: number = 1, 
    timeFilter: string = 'all'
  ): Promise<void> {
    try {
      // Получаем информацию о кабинете
      const cabinet = await IDEXService.getCabinetById(cabinetId);
      
      if (!cabinet) {
        await ctx.reply(
          'Кабинет не найден. Возможно, он уже был удален.',
          KeyboardBuilder.idexMenu()
        );
        return;
      }
      
      // Получаем транзакции с пагинацией
      const perPage = 5;
      const { transactions, totalCount, totalPages, currentPage } = await IDEXService.getCabinetTransactions(
        cabinetId, 
        page, 
        perPage,
        timeFilter !== 'all' ? { preset: timeFilter as "last12h" | "last24h" | "today" | "yesterday" | "thisWeek" | "last2days" | "thisMonth" } : undefined
      );
      
      // Формируем сообщение с транзакциями
      let message = `
📱 *IDEX Кабинет: ${cabinet.name || cabinet.login}*
      `;

      // Добавляем информацию о фильтре, если он есть
      if (timeFilter !== 'all') {
        let filterInfo = '';
        switch (timeFilter) {
          case 'last12h':
            filterInfo = 'за последние 12 часов';
            break;
          case 'last24h':
            filterInfo = 'за последние 24 часа';
            break;
          case 'today':
            filterInfo = 'за сегодня';
            break;
          case 'yesterday':
            filterInfo = 'за вчера';
            break;
          case 'last2days':
            filterInfo = 'за последние 2 дня';
            break;
          case 'thisWeek':
            filterInfo = 'за эту неделю';
            break;
          case 'thisMonth':
            filterInfo = 'за этот месяц';
            break;
          default:
            // Если это кастомный диапазон, то timeFilter будет содержать даты
            if (timeFilter.includes('_')) {
              const [startDate, endDate] = timeFilter.split('_').map(date => 
                new Date(parseInt(date)).toLocaleString('ru-RU', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              );
              filterInfo = `с ${startDate} по ${endDate}`;
            }
        }
        
        if (filterInfo) {
          message += `\n📆 Транзакции ${filterInfo}`;
        }
      } else {
        message += `\n📆 Транзакции все`;
      }
      
      if (transactions.length === 0) {
        message += '\n\n❌ Транзакции не найдены';
      }
      
      // Добавляем информацию о каждой транзакции
      if (transactions.length > 0) {
        message += '\n\n';
        for (let i = 0; i < transactions.length; i++) {
          const tx = transactions[i];
          
          // Парсим объект суммы из JSON
          let amountStr = 'Н/Д';
          let totalUsdtStr = '';
          
          try {
            // Обработка поля amount (RUB)
            if (typeof tx.amount === 'string') {
              try {
                const amountObj = JSON.parse(tx.amount);
                if (amountObj.trader && amountObj.trader['643']) {
                  amountStr = `${amountObj.trader['643']} RUB`;
                }
              } catch (e) {
                amountStr = 'Ошибка парсинга';
              }
            } else if (tx.amount && typeof tx.amount === 'object') {
              if (tx.amount.trader && tx.amount.trader['643']) {
                amountStr = `${tx.amount.trader['643']} RUB`;
              }
            }
            
            // Обработка поля total (USDT)
            if (typeof tx.total === 'string') {
              try {
                const totalObj = JSON.parse(tx.total);
                if (totalObj.trader && totalObj.trader['000001']) {
                  totalUsdtStr = `${totalObj.trader['000001']} USDT`;
                }
              } catch (e) {
                totalUsdtStr = '';
              }
            } else if (tx.total && typeof tx.total === 'object') {
              if (tx.total.trader && tx.total.trader['000001']) {
                totalUsdtStr = `${tx.total.trader['000001']} USDT`;
              }
            }
          } catch (e) {
            console.error('Ошибка парсинга сумм:', e);
          }

          // Форматируем дату
          let dateStr = 'Н/Д';
          try {
            if (tx.createdAtExternal) {
              dateStr = new Date(tx.createdAtExternal).toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
            }
          } catch (e) {
            console.error('Ошибка форматирования даты:', e);
          }

          message += `
*${i + 1}.* ID: \`${tx.externalId || 'Н/Д'}\`
📅 Дата: \`${dateStr}\`
💰 Сумма: \`${amountStr}\`${totalUsdtStr ? `\n💵 USDT: \`${totalUsdtStr}\`` : ''}
✅ Статус: \`${tx.status || 'Н/Д'}\`
          `;
        }
      }
      
      // Если сообщение отправлено через inline-кнопку, редактируем его
      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...KeyboardBuilder.idexTransactionsPaginationKeyboard(
            cabinetId, 
            currentPage, 
            totalPages,
            timeFilter // Передаем выбранный фильтр времени
          )
        });
      } else {
        // Иначе отправляем новое сообщение
        await ctx.reply(message, {
          parse_mode: 'Markdown',
          ...KeyboardBuilder.idexTransactionsPaginationKeyboard(
            cabinetId, 
            currentPage, 
            totalPages,
            timeFilter // Передаем выбранный фильтр времени
          )
        });
      }
    } catch (error) {
      console.error('Ошибка при показе транзакций IDEX кабинета:', error);
      await ctx.reply(
        'Произошла ошибка при получении транзакций IDEX кабинета. Пожалуйста, попробуйте позже.',
        KeyboardBuilder.idexMenu()
      );
    }
  }

  /**
   * Обработчик для отображения меню фильтрации транзакций IDEX по времени
   * @param ctx Контекст бота
   */
  static async handleIdexTimeFilter(ctx: BotContext): Promise<void> {
    try {
      // Получаем ID кабинета из callback данных
      const cabinetId = parseInt(ctx.match![1]);
      
      await ctx.editMessageText(
        '📆 Выберите временной период для фильтрации транзакций:',
        { reply_markup: KeyboardBuilder.idexTimeFilterKeyboard(cabinetId) }
      );
    } catch (error) {
      console.error('Ошибка при отображении меню фильтрации транзакций:', error);
      await ctx.reply('❌ Произошла ошибка при отображении меню фильтрации транзакций.');
    }
  }

  /**
   * Обработчик для запроса пользовательского диапазона дат
   * @param ctx Контекст бота
   */
  static async handleCustomDateRangeRequest(ctx: BotContext): Promise<void> {
    try {
      // Получаем ID кабинета из callback данных
      const cabinetId = parseInt(ctx.match![1]);
      
      // Сохраняем ID кабинета в сессию для последующего использования
      if (!ctx.session) ctx.session = {};
      ctx.session.currentIdexCabinetId = cabinetId;
      ctx.session.awaitingCustomDateRange = true;
      
      await ctx.editMessageText(
        '📆 Введите начальную и конечную дату в формате:\n\n' +
        'ДД.ММ.ГГГГ ЧЧ:ММ - ДД.ММ.ГГГГ ЧЧ:ММ\n\n' +
        'Пример: 01.01.2023 00:00 - 02.01.2023 23:59',
        { reply_markup: KeyboardBuilder.cancelInputKeyboard(`back_to_idex_cabinet_${cabinetId}`) }
      );
    } catch (error) {
      console.error('Ошибка при запросе пользовательского диапазона дат:', error);
      await ctx.reply('❌ Произошла ошибка при запросе пользовательского диапазона дат.');
    }
  }

  /**
   * Обработчик для просмотра деталей IDEX кабинета
   * @param ctx Контекст бота
   */
  static async handleViewIdexCabinetDetails(ctx: BotContext): Promise<void> {
    try {
      // Получаем ID кабинета из callback данных
      const cabinetId = parseInt(ctx.match![1]);
      
      // Получаем детали кабинета напрямую через статический метод
      const cabinetDetails = await IDEXService.getCabinetDetails(cabinetId);
      
      if (!cabinetDetails || !cabinetDetails.cabinet) {
        await ctx.editMessageText('❌ Кабинет не найден.', { 
          reply_markup: KeyboardBuilder.idexCabinetKeyboard(1, 1) 
        });
        return;
      }
      
      // Форматируем текст сообщения с деталями кабинета
      const message = `
📱 *Детали IDEX кабинета*
      
*ID*: \`${cabinetDetails.cabinet.id || 'Н/Д'}\`
*Логин:* \`${cabinetDetails.cabinet.login || 'Н/Д'}\`
*Название:* \`${cabinetDetails.cabinet.name || 'Не указано'}\`
*Всего транзакций:* \`${cabinetDetails.stats.totalTransactions || 0}\`
*Последняя транзакция:* \`${cabinetDetails.stats.lastTransactionDate ? new Date(cabinetDetails.stats.lastTransactionDate).toLocaleString('ru-RU') : 'Нет данных'}\`
*Дата создания:* \`${cabinetDetails.cabinet.createdAt ? new Date(cabinetDetails.cabinet.createdAt).toLocaleString('ru-RU') : 'Н/Д'}\`
*Дата последнего обновления:* \`${cabinetDetails.cabinet.updatedAt ? new Date(cabinetDetails.cabinet.updatedAt).toLocaleString('ru-RU') : 'Н/Д'}\`
      `;
      
      await ctx.editMessageText(message, { 
        parse_mode: 'Markdown',
        reply_markup: KeyboardBuilder.idexCabinetActionsKeyboard(cabinetId) 
      });
    } catch (error) {
      console.error('Ошибка при просмотре деталей кабинета:', error);
      await ctx.reply('❌ Произошла ошибка при просмотре деталей кабинета.');
    }
  }

  /**
   * Обработчик для просмотра транзакций IDEX кабинета с фильтрацией по времени
   * @param ctx Контекст бота
   */
  static async handleViewIdexTransactions(ctx: BotContext): Promise<void> {
    try {
      // Получаем данные из callback
      const [cabinetId, page, timeFilter] = [
        parseInt(ctx.match![1]), 
        parseInt(ctx.match![2]), 
        ctx.match![3] || 'all'
      ];
      
      // Получаем кабинет
      const cabinet = await IDEXService.getCabinetById(cabinetId);
      
      if (!cabinet) {
        await ctx.editMessageText('❌ Кабинет не найден.', { 
          reply_markup: KeyboardBuilder.idexCabinetKeyboard(1, 1) 
        });
        return;
      }
      
      // Получаем транзакции с фильтрацией по времени
      const perPage = 5;
      const result = await IDEXService.getCabinetTransactions(
        cabinetId, 
        page, 
        perPage,
        timeFilter !== 'all' ? { preset: timeFilter as "last12h" | "last24h" | "today" | "yesterday" | "thisWeek" | "last2days" | "thisMonth" } : undefined
      );
      
      const totalPages = Math.ceil(result.totalCount / perPage) || 1;
      
      // Формируем сообщение
      let message = `
📱 *IDEX Кабинет: ${cabinet.name || cabinet.login}*
      `;

      // Добавляем информацию о фильтре, если он есть
      if (timeFilter !== 'all') {
        let filterInfo = '';
        switch (timeFilter) {
          case 'last12h':
            filterInfo = 'за последние 12 часов';
            break;
          case 'last24h':
            filterInfo = 'за последние 24 часа';
            break;
          case 'today':
            filterInfo = 'за сегодня';
            break;
          case 'yesterday':
            filterInfo = 'за вчера';
            break;
          case 'last2days':
            filterInfo = 'за последние 2 дня';
            break;
          case 'thisWeek':
            filterInfo = 'за эту неделю';
            break;
          case 'thisMonth':
            filterInfo = 'за этот месяц';
            break;
          default:
            // Если это кастомный диапазон, то timeFilter будет содержать даты
            if (timeFilter.includes('_')) {
              const [startDate, endDate] = timeFilter.split('_').map(date => 
                new Date(parseInt(date)).toLocaleString('ru-RU', { 
                  day: '2-digit', 
                  month: '2-digit', 
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              );
              filterInfo = `с ${startDate} по ${endDate}`;
            }
        }
        
        if (filterInfo) {
          message += `\n📆 Транзакции ${filterInfo}`;
        }
      } else {
        message += `\n📆 Транзакции все`;
      }
      
      if (result.transactions.length === 0) {
        message += '\n\n❌ Транзакции не найдены';
      }
      
      // Добавляем информацию о каждой транзакции
      if (result.transactions.length > 0) {
        message += '\n\n';
        result.transactions.forEach((tx, index) => {
          // Парсим объект суммы из JSON
          let amountStr = 'Н/Д';
          let totalUsdtStr = '';
          
          try {
            // Обработка поля amount (RUB)
            if (typeof tx.amount === 'string') {
              try {
                const amountObj = JSON.parse(tx.amount);
                if (amountObj.trader && amountObj.trader['643']) {
                  amountStr = `${amountObj.trader['643']} RUB`;
                }
              } catch (e) {
                amountStr = 'Ошибка парсинга';
              }
            } else if (tx.amount && typeof tx.amount === 'object') {
              if (tx.amount.trader && tx.amount.trader['643']) {
                amountStr = `${tx.amount.trader['643']} RUB`;
              }
            }
            
            // Обработка поля total (USDT)
            if (typeof tx.total === 'string') {
              try {
                const totalObj = JSON.parse(tx.total);
                if (totalObj.trader && totalObj.trader['000001']) {
                  totalUsdtStr = `${totalObj.trader['000001']} USDT`;
                }
              } catch (e) {
                totalUsdtStr = '';
              }
            } else if (tx.total && typeof tx.total === 'object') {
              if (tx.total.trader && tx.total.trader['000001']) {
                totalUsdtStr = `${tx.total.trader['000001']} USDT`;
              }
            }
          } catch (e) {
            console.error('Ошибка парсинга сумм:', e);
          }

          // Форматируем дату
          let dateStr = 'Н/Д';
          try {
            if (tx.createdAtExternal) {
              dateStr = new Date(tx.createdAtExternal).toLocaleString('ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });
            }
          } catch (e) {
            console.error('Ошибка форматирования даты:', e);
          }

          message += `
*${index + 1}.* ID: \`${tx.externalId || 'Н/Д'}\`
📅 Дата: \`${dateStr}\`
💰 Сумма: \`${amountStr}\`${totalUsdtStr ? `\n💵 USDT: \`${totalUsdtStr}\`` : ''}
✅ Статус: \`${tx.status || 'Н/Д'}\`
          `;
        });
      }
      
      await ctx.editMessageText(message, { 
        parse_mode: 'Markdown',
        reply_markup: KeyboardBuilder.idexTransactionsPaginationKeyboard(
          cabinetId, 
          page, 
          totalPages,
          timeFilter
        ) 
      });
    } catch (error) {
      console.error('Ошибка при просмотре транзакций:', error);
      await ctx.reply('❌ Произошла ошибка при просмотре транзакций.');
    }
  }

  /**
   * Обработчик для возврата к кабинету IDEX из просмотра транзакций
   * @param ctx Контекст бота
   */
  static async handleBackToIdexCabinet(ctx: BotContext): Promise<void> {
    try {
      // Получаем ID кабинета из callback данных
      const cabinetId = parseInt(ctx.match![1]);
      
      // Получаем кабинет напрямую через статический метод
      const cabinet = await IDEXService.getCabinetById(cabinetId);
      
      if (!cabinet) {
        await ctx.editMessageText('❌ Кабинет не найден.', { 
          reply_markup: KeyboardBuilder.idexCabinetKeyboard(1, 1) 
        });
        return;
      }
      
      // Форматируем сообщение с информацией о кабинете
      const message = `
📱 *IDEX Кабинет*
      
*ID*: \`${cabinet.id}\`
*Логин:* \`${cabinet.login}\`
*Название:* \`${cabinet.name || 'Не указано'}\`
      `;
      
      await ctx.editMessageText(message, { 
        parse_mode: 'Markdown',
        reply_markup: KeyboardBuilder.idexCabinetActionsKeyboard(cabinetId) 
      });
    } catch (error) {
      console.error('Ошибка при возврате к кабинету:', error);
      await ctx.reply('❌ Произошла ошибка при возврате к кабинету.');
    }
  }
}

function formatDuration(duration: number) {
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = duration % 60;
  
  return `${hours} ч ${minutes} мин ${seconds} сек`;
}
