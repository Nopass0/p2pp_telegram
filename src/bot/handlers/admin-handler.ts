import { Telegraf, Markup } from 'telegraf';
import type { BotContext } from '@/types';
import { UserService } from '@/services/user-service';
import { KeyboardBuilder } from '../components/keyboard';
import { TransactionService } from '@/services/transaction-service';

/**
 * Класс для управления административными командами
 */
export class AdminHandler {
  /**
   * Регистрирует административные обработчики для бота
   * @param bot Экземпляр бота Telegraf
   */
  static init(bot: Telegraf<BotContext>) {
    try {
      console.log('Инициализация AdminHandler');
      
      // Базовые команды для взаимодействия с меню
      bot.command('admin', this.showAdminMenu);
      bot.command('users', this.showUserManagementMenu);
      bot.command('adduser', this.startAddUserProcess);
      
      // Отображение административного меню
      bot.hears('👥 Управление пользователями', this.showUserManagementMenu);
      
      // Обработка запроса на просмотр списка пользователей
      bot.hears('👥 Список пользователей', this.showUserList);
      
      // Обработка запроса на добавление пользователя
      bot.hears('➕ Добавить пользователя', this.startAddUserProcess);
      
      // Возврат к админ-панели
      bot.hears('🔙 Назад к админ-панели', this.backToAdminMenu);
      
      // Обработчики для меню статистики
      bot.hears('📊 Общая статистика', this.showGeneralStats);
      bot.hears('📈 Активные пользователи', this.showActiveUsers);
      bot.hears('📉 Неактивные пользователи', this.showInactiveUsers);
      bot.hears('💰 Транзакции', this.showAllTransactions);
      bot.hears('🔙 Назад к управлению', this.showUserManagementMenu);
      
      // Обработка отмены операции
      bot.hears('❌ Отмена', this.cancelOperation);
      
      // Обработчик текстовых сообщений (используем общий обработчик без фильтров)
      bot.on('text', async (ctx, next) => {
        // Проверяем наличие сессии и состояние ожидания ввода
        if (!ctx.session) ctx.session = {};
          
        // Добавляем больше логирования для отладки
        console.log('Получено текстовое сообщение в глобальном обработчике:', ctx.message.text);
        console.log('Текущее состояние сессии:', JSON.stringify(ctx.session));
        
        // Проверяем оба возможных ключа для совместимости
        if (ctx.session.waitingForAddUser || ctx.session.waitingForUserName) {
          console.log('Обнаружено состояние ожидания имени пользователя, обрабатываем сообщение');
          return await this.processTextInput(ctx);
        }
        
        // Если это не наше сообщение, передаем управление дальше
        return next();
      });

      // Inline кнопки для управления пользователями
      bot.action(/^user_(\d+)$/, this.showUserDetails);
      bot.action(/^delete_(\d+)$/, this.confirmDeleteUser);
      bot.action(/^confirm_delete_(\d+)$/, this.deleteUser);
      bot.action(/^cancel_delete_(\d+)$/, this.cancelDeleteUser);
      bot.action('user_list', this.showUserList);
      bot.action('add_more_users', this.startAddUserProcess);
      bot.action('admin_user_menu', this.showUserManagementMenu);
      bot.action(/^user_stats_(\d+)$/, this.showUserDetailedStats);
      bot.action(/^user_transactions_(\d+)$/, this.showUserTransactions);
      bot.action(/^transactions_date_filter_(\d+)$/, this.showTransactionsDateFilter);
      
      // Обработчики пагинации
      bot.action(/^user_page_(\d+)$/, (ctx) => this.handleUserListPagination(ctx, parseInt(ctx.match[1])));
      bot.action(/^user_transactions_page_(\d+)_(\d+)$/, this.handleTransactionsPagination);
      
      // Обработчик для текущей страницы (просто скрываем уведомление)
      bot.action('current_page', async (ctx) => {
        await ctx.answerCbQuery('Текущая страница');
      });
      
      // Добавляем обработчик ошибок для админ-функций
      bot.catch((err, ctx) => {
        console.error('Ошибка в обработчике AdminHandler:', err);
        if (ctx.session?.isAdmin) {
          ctx.reply('Произошла ошибка. Пожалуйста, попробуйте еще раз.', KeyboardBuilder.adminMainMenu());
        }
      });
    } catch (error) {
      console.error('Ошибка при инициализации AdminHandler:', error);
    }
  }

  /**
   * Показывает главное меню администратора
   */
  private static async showAdminMenu(ctx: BotContext) {
    if (!ctx.session) ctx.session = {};
    ctx.session.isAdmin = true;
    await ctx.reply('Главное меню администратора:', KeyboardBuilder.adminMainMenu());
  }

  /**
   * Показывает меню управления пользователями
   */
  private static async showUserManagementMenu(ctx: BotContext) {
    if (!ctx.session) ctx.session = {};
    ctx.session.isAdmin = true;
    
    // Сбрасываем все состояния сессии
    delete ctx.session.waitingForAddUser;
    
    await ctx.reply('Меню управления пользователями:', KeyboardBuilder.adminUserManagementMenu());
  }

  /**
   * Возвращает к главному меню администратора
   */
  private static async backToAdminMenu(ctx: BotContext) {
    if (!ctx.session) ctx.session = {};
    ctx.session.isAdmin = true;
    
    // Сбрасываем все состояния сессии
    delete ctx.session.waitingForAddUser;
    
    await ctx.reply('Главное меню администратора:', KeyboardBuilder.adminMainMenu());
  }

  /**
   * Отменяет текущую операцию
   */
  private static async cancelOperation(ctx: BotContext) {
    if (!ctx.session) ctx.session = {};
    
    // Сбрасываем все состояния сессии
    delete ctx.session.waitingForAddUser;
    
    await ctx.reply('Операция отменена.', KeyboardBuilder.adminUserManagementMenu());
  }

  /**
   * Запускает процесс добавления пользователя
   */
  private static async startAddUserProcess(ctx: BotContext) {
    try {
      if (!ctx.session) ctx.session = {};
      
      // Устанавливаем флаги
      ctx.session.isAdmin = true;
      ctx.session.waitingForUserName = true;
      ctx.session.creatingUser = true;
      
      console.log('Запуск процесса добавления пользователя');
      console.log('Текущая сессия (ПЕРЕД отправкой сообщения):', JSON.stringify(ctx.session));
      
      // Отправляем сообщение с клавиатурой для отмены
      const sentMessage = await ctx.reply(
        '✏️ *Введите имя нового пользователя:*\n\nВы можете отменить операцию, нажав на кнопку "Отмена"', 
        {
          parse_mode: 'Markdown',
          ...KeyboardBuilder.cancelKeyboard()
        }
      );
      
      // Сохраняем ID сообщения для возможного редактирования
      if (sentMessage && 'message_id' in sentMessage) {
        ctx.session.lastMessage = sentMessage.message_id;
      }
      
      console.log('Текущая сессия (ПОСЛЕ отправки сообщения):', JSON.stringify(ctx.session));
      
    } catch (error) {
      console.error('Ошибка при запуске процесса добавления пользователя:', error);
      await ctx.reply('❌ Произошла ошибка при запуске процесса добавления пользователя.', KeyboardBuilder.adminUserManagementMenu());
    }
  }
  
  /**
   * Обрабатывает текстовые сообщения, включая ввод имени пользователя
   */
  private static async processTextInput(ctx: BotContext) {
    try {
      if (!ctx.session) ctx.session = {};
      
      // Проверяем, есть ли текстовое сообщение
      if (!ctx.message || !('text' in ctx.message)) {
        return false;
      }
      
      // Выводим дополнительную информацию для отладки
      console.log('processTextInput вызван с текстом:', ctx.message.text);
      console.log('Состояние сессии:', JSON.stringify(ctx.session));
      
      // Проверяем флаги ожидания ввода имени пользователя
      if (ctx.session.waitingForUserName && ctx.message.text) {
        console.log('Обработка имени пользователя:', ctx.message.text);
        const name = ctx.message.text;
        
        // Если пользователь ввел "Отмена" или нажал кнопку отмены
        if (name === '❌ Отмена') {
          // Очищаем все флаги
          delete ctx.session.waitingForUserName;
          delete ctx.session.creatingUser;
          return await ctx.reply('Операция отменена.', KeyboardBuilder.adminUserManagementMenu());
        }
        
        console.log('Создание пользователя с именем:', name);
        
        // Сразу очищаем флаги ожидания имени, чтобы предотвратить повторную обработку
        delete ctx.session.waitingForUserName;
        delete ctx.session.creatingUser;
        
        // Создаем нового пользователя
        try {
          const user = await UserService.createUser(name);
          
          if (user) {
            console.log('Пользователь успешно создан:', user);
            
            return await ctx.reply(
              `✅ Пользователь "${user.name}" успешно создан!\n\n` +
              `🆔 ID: ${user.id}\n` +
              `🔑 Код доступа: \`${user.passCode}\`\n\n` +
              `Этот код нужно передать пользователю для привязки телеграм-аккаунта.\n\n` +
              `Выберите дальнейшее действие:`,
              {
                parse_mode: 'Markdown',
                ...KeyboardBuilder.userActionsAfterCreateKeyboard(user.id)
              }
            );
          } else {
            console.error('Ошибка при создании пользователя: user равен null');
            return await ctx.reply('❌ Ошибка при создании пользователя.', KeyboardBuilder.adminUserManagementMenu());
          }
        } catch (error) {
          console.error('Ошибка при создании пользователя:', error);
          return await ctx.reply('❌ Произошла ошибка при создании пользователя.', KeyboardBuilder.adminUserManagementMenu());
        }
      }
      
      // Если это был другой текст, просто возвращаем false
      return false;
    } catch (error) {
      console.error('Ошибка в processTextInput:', error);
      return false;
    }
  }

  /**
   * Показывает список пользователей с пагинацией
   */
  private static async showUserList(ctx: BotContext) {
    if (!ctx.session) ctx.session = {};
    
    // Устанавливаем состояние админа
    ctx.session.isAdmin = true;
    
    // Получаем текущую страницу (по умолчанию 1)
    const currentPage = ctx.session.userListPage || 1;
    const pageSize = 5; // Количество пользователей на странице
    
    try {
      // Получаем пользователей с пагинацией
      const result = await UserService.getUsersWithPagination(currentPage, pageSize);
      
      if (result.users.length === 0) {
        return await ctx.reply('Пользователи не найдены.', KeyboardBuilder.adminUserManagementMenu());
      }
      
      // Формируем сообщение со списком пользователей
      let message = `📋 *Список пользователей* (стр. ${currentPage}/${result.totalPages}):\n\n`;
      
      // Добавляем информацию о каждом пользователе
      for (const user of result.users) {
        const telegramInfo = user.telegramAccounts.length > 0 
          ? `✅ Привязан к Telegram` 
          : `❌ Нет привязки к Telegram`;
        
        message += `👤 *${user.name}* (ID: ${user.id})\n` +
                  `🔑 Код: ${user.passCode}\n` +
                  `${telegramInfo}\n\n`;
      }
      
      // Добавляем информацию о пагинации
      message += `Всего пользователей: ${result.totalUsers}`;
      
      // Отправляем сообщение с клавиатурой пагинации
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...KeyboardBuilder.userListPaginationKeyboard(result.users, currentPage, result.totalPages)
      });
      
    } catch (error) {
      console.error('Ошибка при получении списка пользователей:', error);
      await ctx.reply('❌ Произошла ошибка при получении списка пользователей.', KeyboardBuilder.adminUserManagementMenu());
    }
  }
  
  /**
   * Обрабатывает пагинацию списка пользователей
   */
  private static async handleUserListPagination(ctx: BotContext, page: number) {
    if (!ctx.session) ctx.session = {};
    
    // Устанавливаем текущую страницу
    ctx.session.userListPage = page;
    
    // Повторно вызываем метод отображения списка с новой страницей
    await this.showUserList(ctx);
    
    // Удаляем колбэк, чтобы не было уведомления "Loading..."
    await ctx.answerCbQuery();
  }

  /**
   * Показывает детальную информацию о пользователе
   */
  private static async showUserDetails(ctx: BotContext) {
    if (!ctx.session) ctx.session = {};
    ctx.session.isAdmin = true;
    
    // Получаем ID пользователя из callback_data
    const userId = parseInt(ctx.match[1]);
    
    // Сохраняем ID выбранного пользователя в сессии
    ctx.session.selectedUserId = userId;
    
    try {
      // Получаем данные пользователя
      const user = await UserService.findUserById(userId);
      
      if (!user) {
        await ctx.answerCbQuery('Пользователь не найден');
        return await ctx.editMessageText('Пользователь не найден', KeyboardBuilder.adminUserManagementMenu());
      }
      
      // Форматируем информацию о пользователе
      const telegramAccounts = user.telegramAccounts || [];
      let telegramInfo = '';
      
      if (telegramAccounts.length > 0) {
        telegramInfo = '\n📱 *Привязанные телеграм аккаунты:*\n';
        for (const account of telegramAccounts) {
          const username = account.username ? `@${account.username}` : 'Имя пользователя не указано';
          const name = account.firstName ? 
            (account.lastName ? `${account.firstName} ${account.lastName}` : account.firstName) : 
            'Имя не указано';
            
          telegramInfo += `- ${username} (${name})\n`;
        }
      } else {
        telegramInfo = '\n❌ Нет привязанных телеграм аккаунтов\n';
      }
      
      // Получаем статистику пользователя
      const stats = await UserService.getUserStats(userId);
      let statsInfo = '';
      
      if (stats) {
        statsInfo = '\n📊 *Статистика:*\n' +
          `- Всего сессий: ${stats.totalSessions || 0}\n` +
          `- Активных сессий: ${stats.activeSessions || 0}\n` +
          `- Общее время работы: ${stats.totalWorkTime || '0:00'}\n` +
          `- Последняя активность: ${stats.lastActivity || 'нет данных'}\n`;
      }
      
      // Получаем последние транзакции пользователя
      const { transactions, total } = await TransactionService.getUserTransactions(userId, 1, 5);
      let transactionsInfo = '';
      
      if (transactions && transactions.length > 0) {
        transactionsInfo = '\n💰 *Последние транзакции:*\n';
        for (const tx of transactions) {
          const date = new Date(tx.dateTime).toLocaleString('ru-RU', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
          
          // Исправляем определение типа транзакции и форматирование
          const type = tx.type.toUpperCase() === 'BUY' ? '🔴 Покупка' : (tx.type.toUpperCase() === 'SELL' ? '🟢 Продажа' : tx.type);
          
          // Используем корректное форматирование числовых значений
          const amount = parseFloat(tx.amount.toString()).toFixed(6);
          const price = parseFloat(tx.totalPrice.toString()).toFixed(2);
          
          transactionsInfo += `${date}: ${type} ${amount} ${tx.asset} - ${price} RUB\n`;
        }
        
        // Добавляем информацию о прочих транзакциях, если их больше 5
        if (total > 5) {
          transactionsInfo += `\n_...и ещё ${total - 5} транзакций_\n`;
        }
      } else {
        transactionsInfo = '\n💰 *Транзакции:* нет данных\n';
      }
      
      // Формируем сообщение
      const message = `👤 *Управление пользователем:*\n\n` +
        `*${user.name}* (ID: ${user.id})\n` +
        `🔑 Код доступа: \`${user.passCode}\`\n` +
        `🔄 Статус: ${user.isActive ? '✅ Активен' : '❌ Заблокирован'}\n` +
        telegramInfo +
        statsInfo +
        transactionsInfo;
      
      // Клавиатура действий с пользователем
      const keyboard = KeyboardBuilder.userDetailsKeyboard(user.id, user.isActive);
      
      // Отправляем сообщение с клавиатурой
      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
        
        await ctx.answerCbQuery();
      } else {
        await ctx.reply(message, {
          parse_mode: 'Markdown',
          ...keyboard
        });
      }
    } catch (error) {
      console.error('Ошибка при получении информации о пользователе:', error);
      await ctx.answerCbQuery('Произошла ошибка');
      await ctx.editMessageText('❌ Произошла ошибка при получении информации о пользователе.', 
        KeyboardBuilder.adminUserManagementMenu());
    }
  }

  /**
   * Показывает запрос на подтверждение удаления пользователя
   */
  private static async confirmDeleteUser(ctx: BotContext) {
    if (!ctx.session) ctx.session = {};
    ctx.session.isAdmin = true;
    
    try {
      const userId = parseInt(ctx.match[1]);
      const user = await UserService.findUserById(userId);
      
      if (!user) {
        return await ctx.reply('Пользователь не найден.', KeyboardBuilder.adminUserManagementMenu());
      }
      
      await ctx.reply(
        `Вы действительно хотите удалить пользователя "${user.name}" (ID: ${user.id})?`,
        KeyboardBuilder.confirmationKeyboard('delete', userId)
      );
    } catch (error) {
      console.error('Ошибка при подготовке удаления пользователя:', error);
      await ctx.reply('❌ Произошла ошибка при подготовке удаления пользователя.', KeyboardBuilder.adminUserManagementMenu());
    }
  }

  /**
   * Удаляет пользователя
   */
  private static async deleteUser(ctx: BotContext) {
    if (!ctx.session) ctx.session = {};
    ctx.session.isAdmin = true;
    
    try {
      const userId = parseInt(ctx.match[1]);
      const user = await UserService.findUserById(userId);
      
      if (!user) {
        return await ctx.reply('Пользователь не найден.', KeyboardBuilder.adminUserManagementMenu());
      }
      
      // Удаляем пользователя
      const result = await UserService.deleteUser(userId);
      
      if (result) {
        await ctx.reply(`✅ Пользователь "${user.name}" успешно удален.`, KeyboardBuilder.adminUserManagementMenu());
      } else {
        await ctx.reply('❌ Не удалось удалить пользователя.', KeyboardBuilder.adminUserManagementMenu());
      }
    } catch (error) {
      console.error('Ошибка при удалении пользователя:', error);
      await ctx.reply('❌ Произошла ошибка при удалении пользователя.', KeyboardBuilder.adminUserManagementMenu());
    }
  }

  /**
   * Отменяет удаление пользователя
   */
  private static async cancelDeleteUser(ctx: BotContext) {
    if (!ctx.session) ctx.session = {};
    ctx.session.isAdmin = true;
    
    await ctx.reply('Удаление пользователя отменено.', KeyboardBuilder.adminUserManagementMenu());
  }

  /**
   * Показывает детальную статистику пользователя
   */
  private static async showUserDetailedStats(ctx: BotContext) {
    if (!ctx.session) ctx.session = {};
    ctx.session.isAdmin = true;
    
    try {
      // Добавляем логирование для отладки
      console.log('Запрос на отображение детальной статистики пользователя');
      console.log('Контекст callback query:', ctx.callbackQuery);
      
      const userId = parseInt(ctx.match[1]);
      console.log('Получен ID пользователя:', userId);
      
      const user = await UserService.findUserById(userId);
      
      if (!user) {
        await ctx.answerCbQuery('Пользователь не найден');
        return await ctx.editMessageText('Пользователь не найден', KeyboardBuilder.adminUserManagementMenu());
      }
      
      // Получаем детальную статистику пользователя
      const stats = await UserService.getUserDetailedStats(userId);
      
      if (!stats) {
        await ctx.answerCbQuery('Статистика недоступна');
        return await ctx.editMessageText('Детальная статистика пользователя недоступна', KeyboardBuilder.adminUserManagementMenu());
      }
      
      // Формируем сообщение со статистикой
      let message = `📊 *Детальная статистика пользователя ${user.name} (ID: ${user.id})*\n\n`;
      
      // Статистика сессий
      message += `*📆 Статистика сессий:*\n`;
      message += `- Всего сессий: ${stats.totalSessions || 0}\n`;
      message += `- Активных сессий: ${stats.activeSessions || 0}\n`;
      message += `- Общее время работы: ${stats.totalWorkTime || '0:00'}\n`;
      
      if (stats.lastActivity) {
        message += `- Последняя активность: ${stats.lastActivity}\n`;
      } else {
        message += `- Последняя активность: нет данных\n`;
      }
      
      // Статистика по дням недели
      message += `\n*📅 Сессии по дням недели:*\n`;
      const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
      for (let i = 0; i < 7; i++) {
        message += `- ${dayNames[i]}: ${stats.sessionsByDay[i]}\n`;
      }
      
      // Статистика транзакций
      message += `\n*💰 Статистика транзакций:*\n`;
      message += `- Всего транзакций: ${stats.totalTransactions || 0}\n`;
      message += `- Сумма покупок: ${stats.totalPurchaseAmount || 0} RUB\n`;
      message += `- Сумма продаж: ${stats.totalSaleAmount || 0} RUB\n`;
      message += `- Баланс: ${stats.transactionBalance || 0} RUB\n`;
      
      // Телеграм-аккаунты
      message += `\n*📱 Телеграм-аккаунты:*\n`;
      message += `- Привязано аккаунтов: ${stats.telegramAccounts || 0}\n`;
      
      // Клавиатура действий
      const keyboard = [
        [
          Markup.button.callback('📜 Все транзакции', `user_transactions_${userId}`),
          Markup.button.callback('📅 Фильтр транзакций', `transactions_date_filter_${userId}`)
        ],
        [
          Markup.button.callback('🔙 Назад к пользователю', `user_${userId}`),
          Markup.button.callback('🔙 К списку', 'admin_user_list')
        ]
      ];
      
      // Отправляем сообщение с клавиатурой
      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(keyboard)
        });
        
        await ctx.answerCbQuery();
      } else {
        await ctx.reply(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(keyboard)
        });
      }
    } catch (error) {
      console.error('Ошибка при получении детальной статистики пользователя:', error);
      await ctx.answerCbQuery('Произошла ошибка');
      await ctx.reply('❌ Произошла ошибка при получении детальной статистики.', KeyboardBuilder.adminUserManagementMenu());
    }
  }

  /**
   * Показывает транзакции пользователя
   */
  private static async showUserTransactions(ctx: BotContext) {
    if (!ctx.session) ctx.session = {};
    ctx.session.isAdmin = true;
    
    try {
      // Добавляем логирование для отладки
      console.log('Запрос на отображение транзакций пользователя');
      console.log('Контекст callback query:', ctx.callbackQuery);
      
      const userId = parseInt(ctx.match[1]);
      console.log('Получен ID пользователя для транзакций:', userId);
      
      const user = await UserService.findUserById(userId);
      
      if (!user) {
        await ctx.answerCbQuery('Пользователь не найден');
        return await ctx.editMessageText('Пользователь не найден', KeyboardBuilder.adminUserManagementMenu());
      }
      
      // Получаем транзакции с пагинацией
      const { transactions, total } = await TransactionService.getUserTransactions(userId, 1, 5);
      
      if (!transactions || transactions.length === 0) {
        await ctx.answerCbQuery('Транзакции не найдены');
        return await ctx.editMessageText(`У пользователя ${user.name} нет транзакций`, KeyboardBuilder.userDetailsKeyboard(userId, user.isActive));
      }
      
      let message = `💰 *Транзакции пользователя ${user.name} (ID: ${user.id})*:\n\n`;
      
      for (const tx of transactions) {
        const date = new Date(tx.dateTime).toLocaleString('ru-RU', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        // Исправляем определение типа транзакции и форматирование
        const type = tx.type.toUpperCase() === 'BUY' ? '🔴 Покупка' : (tx.type.toUpperCase() === 'SELL' ? '🟢 Продажа' : tx.type);
        
        // Используем корректное форматирование числовых значений
        const amount = parseFloat(tx.amount.toString()).toFixed(6);
        const price = parseFloat(tx.totalPrice.toString()).toFixed(2);
        
        message += `${date}: ${type} ${amount} ${tx.asset} - ${price} RUB\n`;
      }
      
      // Добавляем информацию о прочих транзакциях, если их больше 5
      if (total > 5) {
        message += `\n_...и ещё ${total - 5} транзакций_\n`;
      }
      
      // Отправляем сообщение с клавиатурой для пагинации
      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...KeyboardBuilder.transactionsPaginationKeyboard(userId, 1, total)
        });
        await ctx.answerCbQuery();
      } else {
        await ctx.reply(message, {
          parse_mode: 'Markdown',
          ...KeyboardBuilder.transactionsPaginationKeyboard(userId, 1, total)
        });
      }
    } catch (error) {
      console.error('Ошибка при получении транзакций пользователя:', error);
      await ctx.answerCbQuery('Произошла ошибка');
      await ctx.reply('❌ Произошла ошибка при получении транзакций пользователя.', KeyboardBuilder.adminUserManagementMenu());
    }
  }

  /**
   * Обрабатывает пагинацию транзакций пользователя
   */
  private static async handleTransactionsPagination(ctx: BotContext) {
    if (!ctx.session) ctx.session = {};
    ctx.session.isAdmin = true;
    
    try {
      // Добавляем логирование для отладки
      console.log('Запрос на пагинацию транзакций пользователя');
      console.log('Контекст callback query:', ctx.callbackQuery);
      
      const page = parseInt(ctx.match[1]);
      const userId = parseInt(ctx.match[2]);
      
      console.log(`Страница: ${page}, ID пользователя: ${userId}`);
      
      const user = await UserService.findUserById(userId);
      
      if (!user) {
        await ctx.answerCbQuery('Пользователь не найден');
        return await ctx.editMessageText('Пользователь не найден', KeyboardBuilder.adminUserManagementMenu());
      }
      
      const { transactions, total } = await TransactionService.getUserTransactions(userId, page, 5);
      
      if (!transactions || transactions.length === 0) {
        await ctx.answerCbQuery('Транзакции не найдены');
        return await ctx.editMessageText(`У пользователя ${user.name} нет транзакций`, KeyboardBuilder.userDetailsKeyboard(userId, user.isActive));
      }
      
      let message = `💰 *Транзакции пользователя ${user.name} (стр. ${page}/${Math.ceil(total / 5)})*:\n\n`;
      
      for (const tx of transactions) {
        const date = new Date(tx.dateTime).toLocaleString('ru-RU', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        // Исправляем определение типа транзакции и форматирование
        const type = tx.type.toUpperCase() === 'BUY' ? '🔴 Покупка' : (tx.type.toUpperCase() === 'SELL' ? '🟢 Продажа' : tx.type);
        
        // Используем корректное форматирование числовых значений
        const amount = parseFloat(tx.amount.toString()).toFixed(6);
        const price = parseFloat(tx.totalPrice.toString()).toFixed(2);
        
        message += `${date}: ${type} ${amount} ${tx.asset} - ${price} RUB\n`;
      }
      
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...KeyboardBuilder.transactionsPaginationKeyboard(userId, page, total)
      });
      
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Ошибка при обработке пагинации транзакций пользователя:', error);
      await ctx.answerCbQuery('Произошла ошибка');
      await ctx.reply('❌ Произошла ошибка при обработке пагинации транзакций.', KeyboardBuilder.adminUserManagementMenu());
    }
  }

  /**
   * Показывает фильтр по датам для транзакций пользователя
   */
  private static async showTransactionsDateFilter(ctx: BotContext) {
    if (!ctx.session) ctx.session = {};
    ctx.session.isAdmin = true;
    
    try {
      const userId = parseInt(ctx.match[1]);
      const user = await UserService.findUserById(userId);
      
      if (!user) {
        return await ctx.reply('Пользователь не найден.', KeyboardBuilder.adminUserManagementMenu());
      }
      
      await ctx.reply('Выберите даты для фильтрации транзакций:', KeyboardBuilder.transactionsDateFilterKeyboard(userId));
    } catch (error) {
      console.error('Ошибка при показе фильтра по датам для транзакций пользователя:', error);
      await ctx.reply('❌ Произошла ошибка при показе фильтра по датам для транзакций пользователя.', KeyboardBuilder.adminUserManagementMenu());
    }
  }

  /**
   * Показывает общую статистику пользователей
   */
  private static async showGeneralStats(ctx: BotContext) {
    try {
      if (!ctx.session) ctx.session = {};
      ctx.session.isAdmin = true;
      
      // Получаем статистику по пользователям
      const userStats = await UserService.getUserStats();
      const txStats = await TransactionService.getTransactionStats();
      
      // Формируем сообщение со статистикой
      let message = '📊 *Общая статистика*\n\n';
      
      message += `👥 *Пользователей всего:* ${userStats.total}\n`;
      message += `✅ *Активных пользователей:* ${userStats.active}\n`;
      message += `❌ *Неактивных пользователей:* ${userStats.inactive}\n\n`;
      
      if (txStats) {
        message += `💰 *Транзакций всего:* ${txStats.total}\n`;
        message += `💸 *Сумма всех транзакций:* ${txStats.totalAmount.toFixed(2)} USD\n`;
        message += `📅 *Транзакций за последние 7 дней:* ${txStats.lastWeek}\n`;
        message += `📅 *Транзакций за последние 30 дней:* ${txStats.lastMonth}\n`;
      } else {
        message += '💰 *Транзакций:* нет данных\n';
      }
      
      // Отправляем сообщение с клавиатурой
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...KeyboardBuilder.adminStatsMenu()
      });
    } catch (error) {
      console.error('Ошибка при получении общей статистики:', error);
      await ctx.reply('❌ Произошла ошибка при получении статистики.', KeyboardBuilder.adminStatsMenu());
    }
  }
  
  /**
   * Показывает список активных пользователей
   */
  private static async showActiveUsers(ctx: BotContext) {
    try {
      if (!ctx.session) ctx.session = {};
      ctx.session.isAdmin = true;
      
      // Получаем список активных пользователей
      const users = await UserService.getActiveUsers();
      
      // Формируем сообщение со списком
      let message = '📈 *Активные пользователи*\n\n';
      
      if (users && users.length > 0) {
        users.forEach((user, index) => {
          message += `${index + 1}. *${user.name}* (ID: ${user.id})\n`;
          if (user.lastLoginAt) {
            const lastLogin = new Date(user.lastLoginAt);
            message += `   📅 Последний вход: ${lastLogin.toLocaleDateString('ru-RU')}\n`;
          }
          message += '\n';
        });
      } else {
        message += '❌ Активных пользователей не найдено.\n';
      }
      
      // Отправляем сообщение с клавиатурой
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...KeyboardBuilder.adminStatsMenu()
      });
    } catch (error) {
      console.error('Ошибка при получении списка активных пользователей:', error);
      await ctx.reply('❌ Произошла ошибка при получении списка активных пользователей.', KeyboardBuilder.adminStatsMenu());
    }
  }
  
  /**
   * Показывает список неактивных пользователей
   */
  private static async showInactiveUsers(ctx: BotContext) {
    try {
      if (!ctx.session) ctx.session = {};
      ctx.session.isAdmin = true;
      
      // Получаем список неактивных пользователей
      const users = await UserService.getInactiveUsers();
      
      // Формируем сообщение со списком
      let message = '📉 *Неактивные пользователи*\n\n';
      
      if (users && users.length > 0) {
        users.forEach((user, index) => {
          message += `${index + 1}. *${user.name}* (ID: ${user.id})\n`;
          if (user.createdAt) {
            const createdAt = new Date(user.createdAt);
            message += `   📅 Создан: ${createdAt.toLocaleDateString('ru-RU')}\n`;
          }
          message += '\n';
        });
      } else {
        message += '❌ Неактивных пользователей не найдено.\n';
      }
      
      // Отправляем сообщение с клавиатурой
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...KeyboardBuilder.adminStatsMenu()
      });
    } catch (error) {
      console.error('Ошибка при получении списка неактивных пользователей:', error);
      await ctx.reply('❌ Произошла ошибка при получении списка неактивных пользователей.', KeyboardBuilder.adminStatsMenu());
    }
  }
  
  /**
   * Показывает общую статистику по транзакциям
   */
  private static async showAllTransactions(ctx: BotContext) {
    try {
      // Получаем статистику транзакций
      const txStats = await TransactionService.getTransactionStats();
      
      // Получаем последние 10 транзакций
      const transactions = await TransactionService.getTransactions({ limit: 10 });
      
      let message = '*📊 Статистика транзакций*\n\n';
      
      if (txStats) {
        message += `*Всего транзакций:* ${txStats.total}\n`;
        message += `*Общая сумма:* ${txStats.totalAmount.toFixed(2)} USD\n`;
        message += `*За последние 7 дней:* ${txStats.lastWeek} транзакций\n`;
        message += `*За последние 30 дней:* ${txStats.lastMonth} транзакций\n\n`;
      }
      
      message += '*Последние транзакции:*\n\n';
      
      if (transactions && transactions.length > 0) {
        transactions.forEach((tx, index) => {
          const date = tx.createdAt ? new Date(tx.createdAt) : new Date();
          message += `${index + 1}. *${tx.amount.toFixed(2)} USD* (${date.toLocaleDateString('ru-RU')})\n`;
          if (tx.user) {
            message += `   👤 Пользователь: ${tx.user.name}\n`;
          }
          message += '\n';
        });
      } else {
        message += '❌ Транзакций не найдено.\n';
      }
      
      // Отправляем сообщение с клавиатурой
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        ...KeyboardBuilder.adminStatsMenu()
      });
    } catch (error) {
      console.error('Ошибка при получении статистики транзакций:', error);
      await ctx.reply('❌ Произошла ошибка при получении статистики транзакций.', KeyboardBuilder.adminStatsMenu());
    }
  }
}
