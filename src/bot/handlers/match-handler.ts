import { Telegraf } from 'telegraf';
import dayjs from 'dayjs';
import { KeyboardBuilder } from '../components/keyboard';
import { matchTransactions, getUserMatches, getAllMatches, getUsersWithMatchStats, getUserById } from '../../services/matching-service';
import type { BotContext } from '@/types';

// Хранилище для диапазонов дат (для каждого пользователя)
interface DateRange {
  startDate: string | null;
  endDate: string | null;
}

const dateRanges: Record<string, DateRange> = {};

export class MatchHandler {
  static init(bot: Telegraf<BotContext>) {
    // Обработка кнопки "Меню мэтчей"
    bot.hears('📋 Меню мэтчей', async (ctx) => {
      if (!ctx.session.isAdmin) {
        return ctx.reply('Доступно только для администраторов.');
      }
      
      await ctx.reply(
        'Меню управления мэтчами. Выберите действие:',
        KeyboardBuilder.matchMenu()
      );
    });
    
    // Обработка кнопки "Назад в меню админа"
    bot.hears('🔙 Назад в меню админа', async (ctx) => {
      if (!ctx.session.isAdmin) {
        return ctx.reply('Доступно только для администраторов.');
      }
      
      await ctx.reply(
        'Главное меню администратора:',
        KeyboardBuilder.adminMainMenu()
      );
    });
    
    // Обработка кнопки "Замэтчить период"
    bot.hears('🔄 Замэтчить период', async (ctx) => {
      if (!ctx.session.isAdmin) {
        return ctx.reply('Доступно только для администраторов.');
      }
      
      // Инициализация диапазона дат для этого пользователя
      const userId = ctx.from!.id.toString();
      dateRanges[userId] = { startDate: null, endDate: null };
      
      // Установка состояния сессии
      ctx.session.matchAction = 'waiting_start_date';
      
      await ctx.reply(
        'Введите начальную дату и время периода в формате дд.мм.гггг чч:мм\n' +
        'Например: 01.01.2023 12:00',
        KeyboardBuilder.dateRangeInputMenu()
      );
    });
    
    // Обработка кнопки "Назад к меню мэтчей"
    bot.hears('🔙 Назад к меню мэтчей', async (ctx) => {
      if (!ctx.session.isAdmin) {
        return ctx.reply('Доступно только для администраторов.');
      }
      
      // Очистка состояния matchAction
      delete ctx.session.matchAction;
      
      await ctx.reply(
        'Меню управления мэтчами. Выберите действие:',
        KeyboardBuilder.matchMenu()
      );
    });
    
    // Обработка кнопки "Список мэтчей"
    bot.hears('📋 Список мэтчей', async (ctx) => {
      if (!ctx.session.isAdmin) {
        return ctx.reply('Доступно только для администраторов.');
      }
      
      // Инициализация диапазона дат для этого пользователя
      const userId = ctx.from!.id.toString();
      dateRanges[userId] = { startDate: null, endDate: null };
      
      // Установка состояния сессии
      ctx.session.matchAction = 'list_matches_start_date';
      
      await ctx.reply(
        'Введите начальную дату и время периода в формате дд.мм.гггг чч:мм\n' +
        'Например: 01.01.2023 12:00',
        KeyboardBuilder.dateRangeInputMenu()
      );
    });
    
    // Обработка кнопки "Мэтчи по пользователям"
    bot.hears('👥 Мэтчи по пользователям', async (ctx) => {
      if (!ctx.session.isAdmin) {
        return ctx.reply('Доступно только для администраторов.');
      }
      
      // Инициализация диапазона дат для этого пользователя
      const userId = ctx.from!.id.toString();
      dateRanges[userId] = { startDate: null, endDate: null };
      
      // Установка состояния сессии
      ctx.session.matchAction = 'users_matches_start_date';
      
      await ctx.reply(
        'Введите начальную дату и время периода в формате дд.мм.гггг чч:мм\n' +
        'Например: 01.01.2023 12:00',
        KeyboardBuilder.dateRangeInputMenu()
      );
    });
    
    // Обработка пагинации для всех матчей
    bot.action(/all_matches_page_(\d+)/, async (ctx) => {
      if (!ctx.session.isAdmin) {
        return ctx.answerCbQuery('Доступно только для администраторов.');
      }
      
      const page = parseInt(ctx.match[1]);
      const userId = ctx.from!.id.toString();
      const dateRange = dateRanges[userId];
      
      if (!dateRange || !dateRange.startDate || !dateRange.endDate) {
        return ctx.answerCbQuery('Ошибка: Не указан период. Вернитесь в меню мэтчей.');
      }
      
      try {
        await ctx.answerCbQuery();
        await showAllMatches(ctx, dateRange.startDate, dateRange.endDate, page);
      } catch (error) {
        console.error('Ошибка при обработке пагинации:', error);
        await ctx.reply('Произошла ошибка при обработке пагинации.');
      }
    });
    
    // Обработка пагинации для списка пользователей
    bot.action(/users_list_page_(\d+)/, async (ctx) => {
      if (!ctx.session.isAdmin) {
        return ctx.answerCbQuery('Доступно только для администраторов.');
      }
      
      const page = parseInt(ctx.match[1]);
      const userId = ctx.from!.id.toString();
      const dateRange = dateRanges[userId];
      
      if (!dateRange || !dateRange.startDate || !dateRange.endDate) {
        return ctx.answerCbQuery('Ошибка: Не указан период. Вернитесь в меню мэтчей.');
      }
      
      try {
        await ctx.answerCbQuery();
        await showUsersWithMatches(ctx, dateRange.startDate, dateRange.endDate, page);
      } catch (error) {
        console.error('Ошибка при обработке пагинации:', error);
        await ctx.reply('Произошла ошибка при обработке пагинации.');
      }
    });
    
    // Обработка просмотра матчей пользователя
    bot.action(/view_user_matches_(\d+)/, async (ctx) => {
      if (!ctx.session.isAdmin) {
        return ctx.answerCbQuery('Доступно только для администраторов.');
      }
      
      const userIdToView = parseInt(ctx.match[1]);
      const userId = ctx.from!.id.toString();
      const dateRange = dateRanges[userId];
      
      if (!dateRange || !dateRange.startDate || !dateRange.endDate) {
        return ctx.answerCbQuery('Ошибка: Не указан период. Вернитесь в меню мэтчей.');
      }
      
      try {
        await ctx.answerCbQuery();
        ctx.session.viewingUserId = userIdToView; // Сохраняем ID просматриваемого пользователя
        await showUserMatches(ctx, userIdToView, dateRange.startDate, dateRange.endDate, 1);
      } catch (error) {
        console.error('Ошибка при просмотре матчей пользователя:', error);
        await ctx.reply('Произошла ошибка при просмотре матчей пользователя.');
      }
    });
    
    // Обработка пагинации для матчей пользователя
    bot.action(/user_matches_page_(\d+)/, async (ctx) => {
      if (!ctx.session.isAdmin) {
        return ctx.answerCbQuery('Доступно только для администраторов.');
      }
      
      const page = parseInt(ctx.match[1]);
      const userId = ctx.from!.id.toString();
      const dateRange = dateRanges[userId];
      const userIdToView = ctx.session.viewingUserId;
      
      if (!dateRange || !dateRange.startDate || !dateRange.endDate || !userIdToView) {
        return ctx.answerCbQuery('Ошибка: Некорректные параметры. Вернитесь в меню мэтчей.');
      }
      
      try {
        await ctx.answerCbQuery();
        await showUserMatches(ctx, userIdToView, dateRange.startDate, dateRange.endDate, page);
      } catch (error) {
        console.error('Ошибка при обработке пагинации:', error);
        await ctx.reply('Произошла ошибка при обработке пагинации.');
      }
    });
    
    // Обработка возврата к списку пользователей
    bot.action('back_to_users_list', async (ctx) => {
      if (!ctx.session.isAdmin) {
        return ctx.answerCbQuery('Доступно только для администраторов.');
      }
      
      const userId = ctx.from!.id.toString();
      const dateRange = dateRanges[userId];
      
      if (!dateRange || !dateRange.startDate || !dateRange.endDate) {
        return ctx.answerCbQuery('Ошибка: Не указан период. Вернитесь в меню мэтчей.');
      }
      
      // Очистка ID просматриваемого пользователя
      delete ctx.session.viewingUserId;
      
      try {
        await ctx.answerCbQuery();
        await showUsersWithMatches(ctx, dateRange.startDate, dateRange.endDate, 1);
      } catch (error) {
        console.error('Ошибка при возврате к списку пользователей:', error);
        await ctx.reply('Произошла ошибка при возврате к списку пользователей.');
      }
    });
    
    // Обработка возврата к меню мэтчей
    bot.action('back_to_match_menu', async (ctx) => {
      if (!ctx.session.isAdmin) {
        return ctx.answerCbQuery('Доступно только для администраторов.');
      }
      
      try {
        await ctx.answerCbQuery();
        await ctx.reply(
          'Меню управления мэтчами. Выберите действие:',
          KeyboardBuilder.matchMenu()
        );
      } catch (error) {
        console.error('Ошибка при возврате к меню мэтчей:', error);
        await ctx.reply('Произошла ошибка при возврате к меню мэтчей.');
      }
    });
    
    // Обработка noop действия (ничего не делаем)
    bot.action('noop', (ctx) => ctx.answerCbQuery());
    
    // Обработка текстовых сообщений для ввода дат
    bot.on('text', async (ctx, next) => {
      // Пропускаем, если пользователь не админ или не в режиме ввода данных для матчей
      if (!ctx.session.isAdmin || !ctx.session.matchAction) {
        return next();
      }
      
      const text = ctx.message.text;
      
      // Пропускаем тексты кнопок меню
      if (
        text === '🔙 Назад к меню мэтчей' ||
        text === '🔄 Замэтчить период' ||
        text === '📋 Список мэтчей' ||
        text === '👥 Мэтчи по пользователям' ||
        text === '🔙 Назад в меню админа'
      ) {
        return next();
      }
      
      const userId = ctx.from!.id.toString();
      
      // Обработка ввода дат в зависимости от текущего действия
      if (ctx.session.matchAction === 'waiting_start_date' ||
          ctx.session.matchAction === 'list_matches_start_date' ||
          ctx.session.matchAction === 'users_matches_start_date') {
        
        // Парсим дату
        const date = parseDate(text);
        
        if (!date) {
          await ctx.reply(
            'Некорректный формат даты. Пожалуйста, введите дату в формате дд.мм.гггг чч:мм',
            KeyboardBuilder.dateRangeInputMenu()
          );
          return;
        }
        
        // Сохраняем начальную дату
        if (!dateRanges[userId]) {
          dateRanges[userId] = { startDate: null, endDate: null };
        }
        dateRanges[userId].startDate = date.toISOString();
        
        // Обновляем действие для ожидания конечной даты
        if (ctx.session.matchAction === 'waiting_start_date') {
          ctx.session.matchAction = 'waiting_end_date';
        } else if (ctx.session.matchAction === 'list_matches_start_date') {
          ctx.session.matchAction = 'list_matches_end_date';
        } else if (ctx.session.matchAction === 'users_matches_start_date') {
          ctx.session.matchAction = 'users_matches_end_date';
        }
        
        await ctx.reply(
          'Введите конечную дату и время периода в формате дд.мм.гггг чч:мм\n' +
          'Например: 31.01.2023 12:00',
          KeyboardBuilder.dateRangeInputMenu()
        );
        
      } else if (ctx.session.matchAction === 'waiting_end_date') {
        // Парсим конечную дату
        const date = parseDate(text);
        
        if (!date) {
          await ctx.reply(
            'Некорректный формат даты. Пожалуйста, введите дату в формате дд.мм.гггг чч:мм',
            KeyboardBuilder.dateRangeInputMenu()
          );
          return;
        }
        
        // Сохраняем конечную дату
        dateRanges[userId].endDate = date.toISOString();
        
        // Очищаем действие
        delete ctx.session.matchAction;
        
        // Начинаем процесс сопоставления
        await ctx.reply('⏳ Начинаю процесс сопоставления транзакций...');
        
        try {
          const startDate = dateRanges[userId].startDate!;
          const endDate = dateRanges[userId].endDate!;
          
          const stats = await matchTransactions(startDate, endDate);
          
          // Форматируем результаты
          const startDateStr = dayjs(startDate).format('DD.MM.YYYY HH:mm');
          const endDateStr = dayjs(endDate).format('DD.MM.YYYY HH:mm');
          
          const message = [
            `✅ Сопоставление транзакций за период с ${startDateStr} по ${endDateStr} завершено!`,
            '',
            `📊 Результаты:`,
            `🔢 Сопоставлено транзакций: ${stats.matchedCount}`,
            `💰 Общие расходы: ${stats.grossExpense.toFixed(2)} руб.`,
            `💵 Общий доход: ${stats.grossIncome.toFixed(2)} руб.`,
            `📈 Общая прибыль: ${stats.grossProfit.toFixed(2)} руб.`,
            `📊 Процент прибыли: ${stats.profitPercentage.toFixed(2)}%`,
            `💼 Прибыль на сделку: ${stats.profitPerOrder.toFixed(2)} руб.`,
            `📉 Расход на сделку: ${stats.expensePerOrder.toFixed(2)} руб.`,
          ].join('\n');
          
          await ctx.reply(message, KeyboardBuilder.matchMenu());
        } catch (error) {
          console.error('Ошибка при сопоставлении транзакций:', error);
          await ctx.reply(
            'Произошла ошибка при сопоставлении транзакций. Пожалуйста, попробуйте еще раз.',
            KeyboardBuilder.matchMenu()
          );
        }
        
      } else if (ctx.session.matchAction === 'list_matches_end_date') {
        // Парсим конечную дату
        const date = parseDate(text);
        
        if (!date) {
          await ctx.reply(
            'Некорректный формат даты. Пожалуйста, введите дату в формате дд.мм.гггг чч:мм',
            KeyboardBuilder.dateRangeInputMenu()
          );
          return;
        }
        
        // Сохраняем конечную дату
        dateRanges[userId].endDate = date.toISOString();
        
        // Очищаем действие
        delete ctx.session.matchAction;
        
        // Показываем все матчи
        await showAllMatches(ctx, dateRanges[userId].startDate!, dateRanges[userId].endDate!);
        
      } else if (ctx.session.matchAction === 'users_matches_end_date') {
        // Парсим конечную дату
        const date = parseDate(text);
        
        if (!date) {
          await ctx.reply(
            'Некорректный формат даты. Пожалуйста, введите дату в формате дд.мм.гггг чч:мм',
            KeyboardBuilder.dateRangeInputMenu()
          );
          return;
        }
        
        // Сохраняем конечную дату
        dateRanges[userId].endDate = date.toISOString();
        
        // Очищаем действие
        delete ctx.session.matchAction;
        
        // Показываем пользователей с матчами
        await showUsersWithMatches(ctx, dateRanges[userId].startDate!, dateRanges[userId].endDate!);
      }
    });
  }
}

/**
 * Вспомогательная функция для парсинга строки даты в формате "дд.мм.гггг чч:мм"
 */
function parseDate(dateStr: string): Date | null {
  // Проверяем формат даты с помощью регулярного выражения
  const match = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4}) (\d{1,2}):(\d{2})$/);
  
  if (!match) {
    return null;
  }
  
  const [, day, month, year, hour, minute] = match;
  
  // Создаем объект Date (месяцы в JavaScript начинаются с 0)
  const date = new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute)
  );
  
  // Проверяем, является ли дата допустимой
  if (isNaN(date.getTime())) {
    return null;
  }
  
  return date;
}

/**
 * Функция для форматирования деталей транзакции
 */
function formatTransactionDetails(match: any): string {
  const idexTx = match.idexTransaction;
  const tx = match.transaction;
  
  // Форматируем данные IdexTransaction
  let idexAmount = 'Н/Д';
  try {
    // Проверяем, является ли amount строкой JSON
    if (typeof idexTx.amount === 'string') {
      const amountJson = JSON.parse(idexTx.amount);
      idexAmount = amountJson.trader?.[643] || 'Н/Д';
    } else {
      // Если amount уже является объектом
      idexAmount = idexTx.amount.trader?.[643] || 'Н/Д';
    }
  } catch (error) {
    console.error('Ошибка при парсинге JSON поля amount:', error);
  }
  
  let idexTotal = 'Н/Д';
  try {
    // Проверяем, является ли total строкой JSON
    if (typeof idexTx.total === 'string') {
      const totalJson = JSON.parse(idexTx.total);
      idexTotal = totalJson.trader?.[643] || 'Н/Д';
    } else {
      // Если total уже является объектом
      idexTotal = idexTx.total.trader?.[643] || 'Н/Д';
    }
  } catch (error) {
    console.error('Ошибка при парсинге JSON поля total:', error);
  }
  
  return [
    `🆔 ID мэтча: ${match.id}`,
    `⏱ Разница во времени: ${(match.timeDifference / 60).toFixed(1)} мин.`,
    '',
    `📱 IDEX транзакция:`,
    `🔢 External ID: ${idexTx.externalId}`,
    `💰 Сумма: ${idexAmount}`,
    `💵 Итого: ${idexTotal}`,
    `📊 Статус: ${idexTx.status}`,
    `📅 Подтверждено: ${idexTx.approvedAt || 'Н/Д'}`,
    '',
    `💼 Транзакция P2P:`,
    `🔢 External ID: ${tx.externalId || 'Н/Д'}`,
    `📝 Order №: ${tx.orderNo || 'Н/Д'}`,
    `📅 Дата: ${dayjs(tx.dateTime).format('DD.MM.YYYY HH:mm')}`,
    `📊 Тип: ${tx.type}`,
    `💰 Актив: ${tx.asset}`,
    `🔢 Количество: ${tx.amount}`,
    `💵 Общая цена: ${tx.totalPrice}`,
    `💹 Цена за единицу: ${tx.unitPrice}`,
    `👤 Контрагент: ${tx.counterparty || 'Н/Д'}`,
    `📊 Статус: ${tx.status}`,
    '',
    `${Number(match.grossProfit) < 0 ? '🔴 ' : '🟢 ' }💵 Прибыль: ${match.grossProfit.toFixed(2)} USDT. (${match.profitPercentage.toFixed(2)}%)`,
  ].join('\n');
}

/**
 * Функция для форматирования статистики
 */
function formatStats(stats: any): string {
  return [
    `📊 Статистика:`,
    `🔢 Сопоставлено транзакций: ${stats.matchedCount}`,
    `💰 Общие расходы: ${stats.grossExpense.toFixed(2)} руб.`,
    `💵 Общий доход: ${stats.grossIncome.toFixed(2)} руб.`,
    `📈 Общая прибыль: ${stats.grossProfit.toFixed(2)} руб.`,
    `📊 Процент прибыли: ${stats.profitPercentage.toFixed(2)}%`,
    `💼 Прибыль на сделку: ${stats.profitPerOrder.toFixed(2)} руб.`,
    `📉 Расход на сделку: ${stats.expensePerOrder.toFixed(2)} руб.`,
  ].join('\n');
}

/**
 * Функция для отображения всех матчей
 */
async function showAllMatches(ctx: BotContext, startDate: string, endDate: string, page = 1) {
  try {
    const result = await getAllMatches(startDate, endDate, page);
    
    // Форматируем даты для отображения
    const startDateStr = dayjs(startDate).format('DD.MM.YYYY HH:mm');
    const endDateStr = dayjs(endDate).format('DD.MM.YYYY HH:mm');
    
    if (result.matches.length === 0) {
      await ctx.reply(
        `За период с ${startDateStr} по ${endDateStr} не найдено сопоставленных транзакций.`,
        {
          reply_markup: KeyboardBuilder.backToMatchMenu().reply_markup
        }
      );
      return;
    }
    
    // Показываем статистику
    await ctx.reply(
      `📊 Статистика за период с ${startDateStr} по ${endDateStr}:\n\n` +
      formatStats(result.stats)
    );
    
    // Показываем матчи с пагинацией
    for (const match of result.matches) {
      await ctx.reply(
        formatTransactionDetails(match)
      );
    }
    
    // Показываем элементы управления пагинацией
    const paginationMarkup = KeyboardBuilder.allMatchesPagination(result.currentPage, result.totalPages);
    const backMarkup = KeyboardBuilder.backToMatchMenu();
    
    // Комбинируем кнопки
    const combinedButtons = [
      ...(paginationMarkup.reply_markup?.inline_keyboard || []),
      ...(backMarkup.reply_markup?.inline_keyboard || [])
    ];
    
    await ctx.reply(
      `Страница ${result.currentPage} из ${result.totalPages}`,
      {
        reply_markup: {
          inline_keyboard: combinedButtons
        }
      }
    );
  } catch (error) {
    console.error('Ошибка при отображении всех матчей:', error);
    await ctx.reply('Произошла ошибка при получении списка мэтчей.');
  }
}

/**
 * Функция для отображения пользователей с матчами
 */
async function showUsersWithMatches(ctx: BotContext, startDate: string, endDate: string, page = 1) {
  try {
    const result = await getUsersWithMatchStats(startDate, endDate, page);
    
    // Форматируем даты для отображения
    const startDateStr = dayjs(startDate).format('DD.MM.YYYY HH:mm');
    const endDateStr = dayjs(endDate).format('DD.MM.YYYY HH:mm');
    
    if (result.users.length === 0) {
      await ctx.reply(
        `За период с ${startDateStr} по ${endDateStr} не найдено пользователей с сопоставленными транзакциями.`,
        {
          reply_markup: KeyboardBuilder.backToMatchMenu().reply_markup
        }
      );
      return;
    }
    
    // Показываем общую статистику
    await ctx.reply(
      `📊 Общая статистика за период с ${startDateStr} по ${endDateStr}:\n\n` +
      formatStats(result.totalStats)
    );
    
    // Создаем сообщение со списком пользователей
    const userListMessage = [
      `👥 Список пользователей с мэтчами (страница ${result.currentPage} из ${result.totalPages}):`,
      '',
      ...result.users.map((user, index) => 
        `${index + 1}. ${user.name} - ${user.matchCount} мэтчей, прибыль: ${user.stats.grossProfit.toFixed(2)} руб. (${user.stats.profitPercentage.toFixed(2)}%)`
      )
    ].join('\n');
    
    // Показываем список пользователей с кнопками для просмотра матчей каждого пользователя
    await ctx.reply(
      userListMessage,
      {
        reply_markup: KeyboardBuilder.userListWithViewButtons(result.users).reply_markup
      }
    );
    
    // Показываем элементы управления пагинацией
    const paginationMarkup = KeyboardBuilder.usersListPagination(result.currentPage, result.totalPages);
    const backMarkup = KeyboardBuilder.backToMatchMenu();
    
    // Комбинируем кнопки
    const combinedButtons = [
      ...(paginationMarkup.reply_markup?.inline_keyboard || []),
      ...(backMarkup.reply_markup?.inline_keyboard || [])
    ];
    
    await ctx.reply(
      `Страница ${result.currentPage} из ${result.totalPages}`,
      {
        reply_markup: {
          inline_keyboard: combinedButtons
        }
      }
    );
  } catch (error) {
    console.error('Ошибка при отображении пользователей с матчами:', error);
    await ctx.reply('Произошла ошибка при получении списка пользователей с мэтчами.');
  }
}

/**
 * Функция для отображения матчей для конкретного пользователя
 */
async function showUserMatches(ctx: BotContext, userId: number, startDate: string, endDate: string, page = 1) {
  try {
    // Сначала получаем информацию о пользователе
    const user = await getUserById(userId);
    
    if (!user) {
      await ctx.reply(
        'Пользователь не найден.',
        {
          reply_markup: KeyboardBuilder.backToUsersList().reply_markup
        }
      );
      return;
    }
    
    const result = await getUserMatches(userId, startDate, endDate, page);
    
    // Форматируем даты для отображения
    const startDateStr = dayjs(startDate).format('DD.MM.YYYY HH:mm');
    const endDateStr = dayjs(endDate).format('DD.MM.YYYY HH:mm');
    
    if (result.matches.length === 0) {
      await ctx.reply(
        `У пользователя ${user.name} нет сопоставленных транзакций за период с ${startDateStr} по ${endDateStr}.`,
        {
          reply_markup: KeyboardBuilder.backToUsersList().reply_markup
        }
      );
      return;
    }
    
    // Показываем статистику пользователя
    await ctx.reply(
      `📊 Статистика пользователя ${user.name} за период с ${startDateStr} по ${endDateStr}:\n\n` +
      formatStats(result.stats)
    );
    
    // Показываем матчи с пагинацией
    for (const match of result.matches) {
      await ctx.reply(
        formatTransactionDetails(match)
      );
    }
    
    // Показываем элементы управления пагинацией
    const paginationMarkup = KeyboardBuilder.userMatchesPagination(result.currentPage, result.totalPages);
    const backMarkup = KeyboardBuilder.backToUsersList();
    
    // Комбинируем кнопки
    const combinedButtons = [
      ...(paginationMarkup.reply_markup?.inline_keyboard || []),
      ...(backMarkup.reply_markup?.inline_keyboard || [])
    ];
    
    await ctx.reply(
      `Страница ${result.currentPage} из ${result.totalPages}`,
      {
        reply_markup: {
          inline_keyboard: combinedButtons
        }
      }
    );
  } catch (error) {
    console.error('Ошибка при отображении матчей пользователя:', error);
    await ctx.reply('Произошла ошибка при получении мэтчей пользователя.');
  }
}