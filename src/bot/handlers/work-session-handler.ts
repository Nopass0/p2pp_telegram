import { Context } from 'telegraf';
import { BotContext } from '@/types';
import { WorkSessionService } from '@/services/work-session-service';
import { KeyboardBuilder } from '../components/keyboard';
import { IDEXService } from '@/services/idex-service';

/**
 * Обработчик рабочих сессий пользователя
 */
export class WorkSessionHandler {
  /**
   * Инициализирует обработчики для управления рабочими сессиями
   * @param bot Экземпляр бота Telegraf
   */
  static init(bot: any) {
    // Начало рабочей сессии
    bot.hears('⏰ Начать работу', this.startWorkSession);
    
    // Окончание рабочей сессии
    bot.hears('⏹️ Закончить работу', this.endWorkSession);

    // Информация о текущей сессии
    bot.hears('ℹ️ Информация о текущей сессии', this.getSessionInfo);

    // Подтверждение кабинетов
    bot.hears(['Да, все верно', 'Yes', 'Да'], this.confirmCabinets);
    bot.hears(['Нет, ввести заново', 'No', 'Нет'], this.reenterCabinets);
    
    // Message handler для ввода idexId кабинетов
    bot.on('message', async (ctx, next) => {
      // Проверяем, что у нас есть текст и ожидаем ввод кабинетов
      if (ctx.message && 'text' in ctx.message && ctx.session?.waitingForCabinetIds) {
        await this.handleCabinetIdsInput(ctx);
      } else {
        // Передаем управление следующему обработчику
        await next();
      }
    });

    // Автоматически закрываем сессии, активные более 24 часов, при запуске бота
    this.checkAndCloseInactiveSessions();

    // Запускаем периодическую проверку неактивных сессий каждый час
    setInterval(this.checkAndCloseInactiveSessions, 60 * 60 * 1000);
  }
  
  /**
   * Начинает процесс создания новой рабочей сессии
   */
  private static async startWorkSession(ctx: BotContext) {
    // Проверка авторизации
    if (!ctx.session?.userId) {
      await ctx.reply('Для начала работы необходимо авторизоваться. Используйте команду "🔑 Ввести код".');
      return;
    }
    
    // Получаем активную сессию
    const activeSession = await WorkSessionService.getActiveSession(ctx.session.userId);
    
    // Если уже есть активная сессия
    if (activeSession) {
      const startTime = new Date(activeSession.startTime);
      const now = new Date();
      const durationMs = now.getTime() - startTime.getTime();
      const hours = Math.floor(durationMs / (1000 * 60 * 60));
      const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
      
      await ctx.reply(
        `У вас уже есть активная рабочая сессия!\n\nНачата: ${startTime.toLocaleString('ru-RU')}\nТекущая продолжительность: ${hours} ч. ${minutes} мин.`,
        KeyboardBuilder.mainMenu()
      );
      return;
    }
    
    // Просим пользователя ввести ID кабинетов IDEX
    await ctx.reply(
      'Пожалуйста, введите ID кабинетов IDEX, с которыми вы будете работать, через запятую.\n\nНапример: 123, 456, 789',
      KeyboardBuilder.cancelKeyboard()
    );
    
    // Устанавливаем флаг ожидания ввода кабинетов
    ctx.session.waitingForCabinetIds = true;
  }

  /**
   * Обрабатывает ввод ID кабинетов пользователем
   */
  private static async handleCabinetIdsInput(ctx: BotContext) {
    if (!ctx.message || !('text' in ctx.message)) {
      return;
    }

    const text = ctx.message.text;
    
    // Разбиваем строку по запятым и удаляем пробелы
    const cabinetIdStrings = text.split(',').map(id => id.trim()).filter(id => id);
    
    if (cabinetIdStrings.length === 0) {
      await ctx.reply(
        'Вы не ввели ни одного ID кабинета. Пожалуйста, введите ID кабинетов IDEX через запятую.',
        KeyboardBuilder.cancelKeyboard()
      );
      return;
    }
    
    // Проверяем, что все введенные ID - числа
    const invalidIds = cabinetIdStrings.filter(id => !/^\d+$/.test(id));
    if (invalidIds.length > 0) {
      await ctx.reply(
        `Следующие ID содержат недопустимые символы: ${invalidIds.join(', ')}\n\nПожалуйста, введите только числовые ID кабинетов IDEX через запятую.`,
        KeyboardBuilder.cancelKeyboard()
      );
      return;
    }
    
    // Преобразуем строки в числа
    const cabinetIds = cabinetIdStrings.map(id => parseInt(id, 10));
    
    // Находим кабинеты в базе данных по их idexId
    const cabinets = await IDEXService.findCabinetsByIdexIds(cabinetIds);
    
    if (cabinets.length === 0) {
      await ctx.reply(
        'Не найдено ни одного кабинета IDEX с указанными ID. Пожалуйста, проверьте введенные данные и попробуйте снова.',
        KeyboardBuilder.cancelKeyboard()
      );
      return;
    }
    
    // Если найдены не все кабинеты, сообщаем пользователю
    if (cabinets.length < cabinetIds.length) {
      const foundIds = cabinets.map(cabinet => cabinet.idexId);
      const notFoundIds = cabinetIds.filter(id => !foundIds.includes(id));
      
      await ctx.reply(
        `Внимание! Не найдены следующие кабинеты: ${notFoundIds.join(', ')}\n\nБудут использованы только найденные кабинеты.`
      );
    }
    
    // Формируем список найденных кабинетов для подтверждения
    let message = 'Найдены следующие кабинеты IDEX:\n\n';
    
    cabinets.forEach((cabinet, index) => {
      message += `${index + 1}. ID: ${cabinet.idexId}, Логин: ${cabinet.login}\n`;
    });
    
    message += '\nВсе верно? Подтвердите, чтобы начать рабочую сессию с этими кабинетами.';
    
    // Сохраняем найденные кабинеты в сессии для последующего использования
    ctx.session.foundCabinets = cabinets;
    
    // Убираем флаг ожидания ввода кабинетов и устанавливаем флаг ожидания подтверждения
    ctx.session.waitingForCabinetIds = false;
    ctx.session.waitingForCabinetConfirmation = true;
    
    // Отправляем сообщение с клавиатурой для подтверждения
    await ctx.reply(
      message,
      {
        reply_markup: {
          keyboard: [['Да, все верно', 'Нет, ввести заново']],
          resize_keyboard: true,
          one_time_keyboard: true
        }
      }
    );
  }

  /**
   * Обрабатывает подтверждение выбора кабинетов и начинает рабочую сессию
   */
  private static async confirmCabinets(ctx: BotContext) {
    // Проверяем, что ожидаем подтверждение и есть найденные кабинеты
    if (!ctx.session?.waitingForCabinetConfirmation || !ctx.session?.foundCabinets || !ctx.session?.userId) {
      return;
    }
    
    // Получаем ID найденных кабинетов
    const cabinetIds = ctx.session.foundCabinets.map(cabinet => cabinet.id);
    
    // Создаем новую сессию, связывая ее с выбранными кабинетами
    const session = await WorkSessionService.startWorkSession(ctx.session.userId, cabinetIds);
    
    if (!session) {
      await ctx.reply(
        'Произошла ошибка при начале рабочей сессии. Пожалуйста, попробуйте позже.',
        KeyboardBuilder.mainMenu()
      );
      return;
    }
    
    // Формируем сообщение об успешном начале сессии
    let message = `Рабочая сессия успешно начата!\n\nВремя начала: ${new Date(session.startTime).toLocaleString('ru-RU')}\n`;
    
    if (session.idexCabinets && session.idexCabinets.length > 0) {
      message += '\nВыбранные кабинеты IDEX:\n';
      session.idexCabinets.forEach((cabinet, index) => {
        message += `${index + 1}. ID: ${cabinet.idexId}, Логин: ${cabinet.login}\n`;
      });
    }
    
    message += '\nВам будут приходить уведомления о необходимости загружать отчеты.';
    
    // Очищаем данные из сессии
    delete ctx.session.waitingForCabinetConfirmation;
    delete ctx.session.foundCabinets;
    
    await ctx.reply(message, KeyboardBuilder.mainMenu());
  }

  /**
   * Обрабатывает отказ от подтверждения и предлагает ввести кабинеты заново
   */
  private static async reenterCabinets(ctx: BotContext) {
    // Проверяем, что ожидаем подтверждение
    if (!ctx.session?.waitingForCabinetConfirmation) {
      return;
    }
    
    // Очищаем данные из сессии
    delete ctx.session.waitingForCabinetConfirmation;
    delete ctx.session.foundCabinets;
    
    // Просим пользователя ввести ID кабинетов IDEX снова
    await ctx.reply(
      'Пожалуйста, введите ID кабинетов IDEX, с которыми вы будете работать, через запятую.',
      KeyboardBuilder.cancelKeyboard()
    );
    
    // Устанавливаем флаг ожидания ввода кабинетов
    ctx.session.waitingForCabinetIds = true;
  }
  
  /**
   * Завершает активную рабочую сессию
   */
  private static async endWorkSession(ctx: BotContext) {
    // Проверка авторизации
    if (!ctx.session.userId) {
      await ctx.reply('Для управления рабочими сессиями необходимо авторизоваться. Используйте команду "🔑 Ввести код".');
      return;
    }
    
    // Получаем активную сессию
    const activeSession = await WorkSessionService.getActiveSession(ctx.session.userId);
    
    // Если нет активной сессии
    if (!activeSession) {
      await ctx.reply(
        'У вас нет активной рабочей сессии. Чтобы начать работу, нажмите "⏰ Начать работу".',
        KeyboardBuilder.mainMenu()
      );
      return;
    }
    
    // Завершаем сессию
    const session = await WorkSessionService.endWorkSession(ctx.session.userId);
    
    if (!session) {
      await ctx.reply(
        'Произошла ошибка при завершении рабочей сессии. Пожалуйста, попробуйте позже.',
        KeyboardBuilder.mainMenu()
      );
      return;
    }
    
    const startTime = new Date(session.startTime);
    const endTime = new Date(session.endTime);
    const hours = Math.floor(session.duration / 60);
    const minutes = session.duration % 60;
    
    await ctx.reply(
      `Рабочая сессия успешно завершена!\n\nНачало: ${startTime.toLocaleString('ru-RU')}\nОкончание: ${endTime.toLocaleString('ru-RU')}\nПродолжительность: ${hours} ч. ${minutes} мин.`,
      KeyboardBuilder.mainMenu()
    );
  }

  /**
   * Отображает подробную информацию о текущей активной сессии
   */
  private static async getSessionInfo(ctx: BotContext) {
    // Проверка авторизации
    if (!ctx.session.userId) {
      await ctx.reply('Для просмотра информации о сессии необходимо авторизоваться. Используйте команду "🔑 Ввести код".');
      return;
    }
    
    // Получаем детальную информацию о текущей активной сессии
    const sessionDetails = await WorkSessionService.getActiveSessionDetails(ctx.session.userId);
    
    // Если нет активной сессии
    if (!sessionDetails) {
      await ctx.reply(
        'У вас нет активной рабочей сессии. Чтобы начать работу, нажмите "⏰ Начать работу".',
        KeyboardBuilder.mainMenu()
      );
      return;
    }
    
    // Формируем красивое сообщение с информацией о сессии
    let message = `
📊 <b>Информация о текущей рабочей сессии</b>

⏱ <b>Время начала:</b> ${sessionDetails.formattedStartTime}
🕒 <b>Текущее время:</b> ${sessionDetails.formattedCurrentTime}

⌛️ <b>Продолжительность:</b> ${sessionDetails.durationHours} ч. ${sessionDetails.durationMinutes} мин.

📝 <b>ID сессии:</b> ${sessionDetails.session.id}
`;

    // Добавляем информацию о связанных кабинетах IDEX
    if (sessionDetails.session.idexCabinets && sessionDetails.session.idexCabinets.length > 0) {
      message += '\n📱 <b>Кабинеты IDEX:</b>\n';
      sessionDetails.session.idexCabinets.forEach((cabinet, index) => {
        message += `${index + 1}. ID: ${cabinet.idexId}, Логин: ${cabinet.login}\n`;
      });
    }

    message += '\n<i>Сессия автоматически завершится после 24 часов с момента начала</i>';
    
    await ctx.reply(message, {
      parse_mode: 'HTML',
      ...KeyboardBuilder.mainMenu()
    });
  }

  /**
   * Проверяет и автоматически закрывает неактивные сессии (более 24 часов)
   */
  private static async checkAndCloseInactiveSessions() {
    try {
      console.log('Запущена проверка неактивных сессий...');
      const closedCount = await WorkSessionService.autoCloseInactiveSessions();
      
      if (closedCount > 0) {
        console.log(`Автоматически завершено ${closedCount} неактивных сессий.`);
      } else {
        console.log('Неактивных сессий не обнаружено.');
      }
    } catch (error) {
      console.error('Ошибка при проверке неактивных сессий:', error);
    }
  }
}