import { Context } from 'telegraf';
import { message } from 'telegraf/filters';
import { BotContext } from '@/types';
import { UserService } from '@/services/user-service';
import { AdminService } from '@/services/admin-service';
import { KeyboardBuilder } from '../components/keyboard';

/**
 * Обработчик процесса аутентификации
 */
export class AuthHandler {
  /**
   * Инициализирует обработчики для аутентификации
   * @param bot Экземпляр бота Telegraf
   */
  static init(bot: any) {
    // Обработка кнопки "Ввести код"
    bot.hears('🔑 Ввести код', this.startAuthProcess);
    
    // Обработка ввода кода-пароля
    bot.on(message('text'), this.handlePassCode);
  }
  
  /**
   * Начало процесса аутентификации
   */
  static async startAuthProcess(ctx: BotContext) {
    // Инициализируем сессию, если она не существует
    if (!ctx.session) {
      ctx.session = {};
    }
    
    // Устанавливаем состояние "ожидает код"
    ctx.session.lastAction = 'waiting_auth_code';
    
    await ctx.reply(
      'Пожалуйста, введите ваш код-пароль для идентификации.',
      KeyboardBuilder.cancelKeyboard()
    );
  }
  
  /**
   * Обработка введенного кода-пароля
   */
  private static async handlePassCode(ctx: BotContext, next: () => Promise<void>) {
    // Инициализируем сессию, если она не существует
    if (!ctx.session) {
      ctx.session = {};
    }
    
    // Если не в режиме ожидания кода, передаем управление дальше
    if (ctx.session.lastAction !== 'waiting_auth_code') {
      return next();
    }
    
    // Отмена операции
    if (ctx.message.text === '❌ Отмена') {
      ctx.session.lastAction = undefined;
      await ctx.reply(
        'Авторизация отменена.',
        KeyboardBuilder.mainMenu()
      );
      return;
    }
    
    const passCode = ctx.message.text;
    
    // Ищем пользователя по коду
    const user = await UserService.findUserByPassCode(passCode);
    
    if (!user) {
      await ctx.reply(
        'Неверный код-пароль. Пожалуйста, попробуйте снова.',
        KeyboardBuilder.cancelKeyboard()
      );
      return;
    }
    
    // Проверяем активность пользователя
    if (!user.isActive) {
      await ctx.reply(
        'Ваша учетная запись неактивна. Пожалуйста, обратитесь к администратору для активации.',
        KeyboardBuilder.mainMenu()
      );
      ctx.session.lastAction = undefined;
      return;
    }
    
    // Пользователь найден - сохраняем его ID в сессии
    ctx.session.userId = user.id;
    ctx.session.lastAction = undefined;
    
    // Добавляем телеграм аккаунт к пользователю, если он еще не связан
    await UserService.addTelegramAccount(
      user.id,
      ctx.from.id.toString(),
      ctx.from.username,
      ctx.from.first_name,
      ctx.from.last_name
    );
    
    // Проверяем, является ли пользователь админом
    const isAdmin = await AdminService.isAdmin(ctx.from.id.toString());
    ctx.session.isAdmin = isAdmin;
    
    // Приветствуем пользователя и показываем соответствующее меню
    if (isAdmin) {
      await ctx.reply(
        `Добро пожаловать, ${user.name}! Вы успешно авторизованы как администратор.`,
        KeyboardBuilder.adminMainMenu()
      );
    } else {
      await ctx.reply(
        `Добро пожаловать, ${user.name}! Вы успешно авторизованы.`,
        KeyboardBuilder.mainMenu()
      );
    }
  }
  
  /**
   * Проверяет, авторизован ли пользователь
   * @param ctx Контекст бота
   */
  static async checkAuth(ctx: BotContext, next: () => Promise<void>) {
    // Инициализируем сессию, если она не существует
    if (!ctx.session) {
      ctx.session = {};
    }
    
    // Если пользователь еще не авторизован
    if (!ctx.session.userId) {
      // Проверяем, есть ли аккаунт пользователя в базе
      const userByTelegram = await UserService.findUserByTelegramId(ctx.from.id.toString());
      
      // Если аккаунт найден, автоматически авторизуем
      if (userByTelegram) {
        ctx.session.userId = userByTelegram.id;
        ctx.session.isAdmin = await AdminService.isAdmin(ctx.from.id.toString());
      } else {
        // Если пользователь не в базе, предлагаем ему ввести код-пароль
        await ctx.reply(
          'Для доступа к функциям бота, пожалуйста, введите ваш код-пароль.',
          KeyboardBuilder.mainMenu()
        );
        return;
      }
    }
    
    return next();
  }
  
  /**
   * Проверяет, является ли пользователь администратором
   * @param ctx Контекст бота
   */
  static async checkAdmin(ctx: BotContext, next: () => Promise<void>) {
    // Инициализируем сессию, если она не существует
    if (!ctx.session) {
      ctx.session = {};
    }
    
    if (!ctx.session.isAdmin) {
      await ctx.reply('У вас нет доступа к этой функции. Необходимы права администратора.');
      return;
    }
    
    return next();
  }
}
