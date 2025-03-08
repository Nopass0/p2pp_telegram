import { Context } from 'telegraf';
import { BotContext } from '@/types';
import { WorkSessionService } from '@/services/work-session-service';
import { KeyboardBuilder } from '../components/keyboard';

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

    // Автоматически закрываем сессии, активные более 24 часов, при запуске бота
    this.checkAndCloseInactiveSessions();

    // Запускаем периодическую проверку неактивных сессий каждый час
    setInterval(this.checkAndCloseInactiveSessions, 60 * 60 * 1000);
  }
  
  /**
   * Начинает новую рабочую сессию
   */
  private static async startWorkSession(ctx: BotContext) {
    // Проверка авторизации
    if (!ctx.session.userId) {
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
    
    // Создаем новую сессию
    const session = await WorkSessionService.startWorkSession(ctx.session.userId);
    
    if (!session) {
      await ctx.reply(
        'Произошла ошибка при начале рабочей сессии. Пожалуйста, попробуйте позже.',
        KeyboardBuilder.mainMenu()
      );
      return;
    }
    
    await ctx.reply(
      `Рабочая сессия успешно начата!\n\nВремя начала: ${new Date(session.startTime).toLocaleString('ru-RU')}\n\nВам будут приходить уведомления о необходимости загружать отчеты.`,
      KeyboardBuilder.mainMenu()
    );
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
    const message = `
📊 <b>Информация о текущей рабочей сессии</b>

⏱ <b>Время начала:</b> ${sessionDetails.formattedStartTime}
🕒 <b>Текущее время:</b> ${sessionDetails.formattedCurrentTime}

⌛️ <b>Продолжительность:</b> ${sessionDetails.durationHours} ч. ${sessionDetails.durationMinutes} мин.

📝 <b>ID сессии:</b> ${sessionDetails.session.id}

<i>Сессия автоматически завершится после 24 часов с момента начала</i>
    `;
    
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
