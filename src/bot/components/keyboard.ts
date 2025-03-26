import { prisma } from '@/services/prisma';
import { Markup } from 'telegraf';

/**
 * Класс для создания клавиатур Telegram
 */
export class KeyboardBuilder {
  /**
   * Создает главное меню обычного пользователя
   */
  static mainMenu(): any {
    return Markup.keyboard([
      [{ text: '🔑 Ввести код' }, { text: '📊 Загрузить отчет' }],
      [{ text: '⏰ Начать работу' }, { text: '⏹️ Закончить работу' }],
      [{ text: 'ℹ️ Информация о текущей сессии' }],
      [{ text: '📋 Моя статистика' }, { text: '❓ Помощь' }]
    ]).resize();
  }

    // Кнопка возврата к списку пользователей
    static backToUsersList() {
      return Markup.inlineKeyboard([
        Markup.button.callback('🔙 Назад к списку пользователей', 'back_to_users_list')
      ]);
    }
  
    // Кнопка возврата к меню мэтчей
    static backToMatchMenu() {
      return Markup.inlineKeyboard([
        Markup.button.callback('🔙 Назад к меню мэтчей', 'back_to_match_menu')
      ]);
    }
  
  /**
   * Создает главное меню администратора
   */
  static adminMainMenu(): any {
    return Markup.keyboard([
      [{ text: '👥 Управление пользователями' }, { text: '📊 Статистика' }],
      [{ text: '📱 IDEX' }, { text: '🖥️Bybit' }],
      [{ text: '⚙️ Настройки' }, { text: '⚠️ Уведомления' }, { text: '📋 Меню мэтчей'}],
    
      [{ text: '🔙 Обычный режим' }, { text: '❓ Помощь' }]
    ]).resize();
  }

  /**
   * Создает меню IDEX
   */
  static idexMenu(): any {
    return Markup.keyboard([
      [{ text: '📱 IDEX Кабинеты' }, { text: '➕ Добавить IDEX кабинет' }],
      [{ text: '🔄 Синхронизировать все кабинеты' }],
      [{ text: '🔙 Назад к админ-панели' }]
    ]).resize();
  }

  /**
   * Создает инлайн клавиатуру для IDEX кабинетов с пагинацией и действиями
   * @param currentPage Текущая страница
   * @param totalPages Всего страниц
   * @param cabinets Массив кабинетов для отображения кнопок действий
   */
  static idexCabinetKeyboard(currentPage: number, totalPages: number, cabinets: any[] = []): any {
    const paginationButtons = [];
    
    // Кнопка на первую страницу
    if (currentPage > 1) {
      paginationButtons.push(Markup.button.callback('⏮️ Первая', 'idex_page_1'));
    }
    
    // Кнопка на предыдущую страницу
    if (currentPage > 1) {
      paginationButtons.push(Markup.button.callback('◀️ Пред.', `idex_page_${currentPage - 1}`));
    }
    
    // Текущая страница
    paginationButtons.push(Markup.button.callback(`${currentPage} из ${totalPages}`, 'noop'));
    
    // Кнопка на следующую страницу
    if (currentPage < totalPages) {
      paginationButtons.push(Markup.button.callback('След. ▶️', `idex_page_${currentPage + 1}`));
    }
    
    // Кнопка на последнюю страницу
    if (currentPage < totalPages) {
      paginationButtons.push(Markup.button.callback('⏭️ Последняя', `idex_page_${totalPages}`));
    }
    
    // Кнопки действий
    const buttons = [
      [Markup.button.callback('➕ Добавить IDEX кабинет', 'add_idex_cabinet')],
      [Markup.button.callback('🔄 Синхронизировать все', 'sync_all_idex_cabinets')],
    ];
    
    // Кнопки для каждого кабинета
    cabinets.forEach(cabinet => {
      buttons.push([
        Markup.button.callback(`📊 Кабинет #${cabinet.id}`, `view_idex_cabinet_details_${cabinet.id}`),
        Markup.button.callback(`📋 Транзакции`, `view_idex_transactions_${cabinet.id}_1_all`)
      ]);
    });
    
    buttons.push(paginationButtons);
    buttons.push([Markup.button.callback('🔙 Назад', 'back_to_admin')]);
    
    return Markup.inlineKeyboard(buttons);
  }

  /**
   * Создает инлайн клавиатуру для управления IDEX кабинетом
   * @param cabinetId ID кабинета IDEX
   * @returns Inline-клавиатура для управления кабинетом
   */
  static idexCabinetActionsKeyboard(cabinetId: number) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('📊 Детали кабинета', `idex_cabinet_details_${cabinetId}`),
        Markup.button.callback('💵 Транзакции', `idex_cabinet_tx_${cabinetId}`)
      ],
      [
        Markup.button.callback('🔄 Синхронизировать', `idex_cabinet_sync_${cabinetId}`),
        Markup.button.callback('🔧 Настройки', `idex_cabinet_settings_${cabinetId}`)
      ],
      [
        Markup.button.callback('⬅️ Назад', 'list_idex_cabinets')
      ]
    ]);
  }

  /**
   * Создает инлайн клавиатуру для просмотра транзакций IDEX кабинета с пагинацией
   * @param cabinetId ID кабинета IDEX
   * @param currentPage Текущая страница
   * @param totalPages Всего страниц
   */
  static idexTransactionsKeyboard(cabinetId: number, currentPage: number, totalPages: number): InlineKeyboardMarkup {
    const paginationButtons = [];
    
    // Кнопка на первую страницу
    if (currentPage > 1) {
      paginationButtons.push(Markup.button.callback('⏮️ Первая', `view_idex_transactions_${cabinetId}_1`));
    }
    
    // Кнопка на предыдущую страницу
    if (currentPage > 1) {
      paginationButtons.push(Markup.button.callback('◀️ Пред.', `view_idex_transactions_${cabinetId}_${currentPage - 1}`));
    }
    
    // Текущая страница
    paginationButtons.push(Markup.button.callback(`${currentPage} из ${totalPages}`, 'noop'));
    
    // Кнопка на следующую страницу
    if (currentPage < totalPages) {
      paginationButtons.push(Markup.button.callback('След. ▶️', `view_idex_transactions_${cabinetId}_${currentPage + 1}`));
    }
    
    // Кнопка на последнюю страницу
    if (currentPage < totalPages) {
      paginationButtons.push(Markup.button.callback('⏭️ Последняя', `view_idex_transactions_${cabinetId}_${totalPages}`));
    }
    
    return Markup.inlineKeyboard([
      paginationButtons,
      [
        Markup.button.callback('🔄 Обновить', `sync_idex_cabinet_${cabinetId}`),
        Markup.button.callback('🔙 Назад', `back_to_idex_cabinet_${cabinetId}`)
      ]
    ]);
  }

  /**
   * Создает инлайн клавиатуру для управления конкретным пользователем
   * @param userId ID виртуального пользователя
   */
  static userManagementKeyboard(userId: number): any {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('🔄 Сменить код', `regenerate_${userId}`),
        Markup.button.callback('✏️ Изменить имя', `rename_${userId}`)
      ],
      [
        Markup.button.callback('👁️ Телеграм аккаунты', `accounts_${userId}`),
        Markup.button.callback('⏱️ Рабочее время', `worksessions_${userId}`)
      ],
      [
        Markup.button.callback('📊 Транзакции', `transactions_${userId}`),
        Markup.button.callback('📝 История отчетов', `reports_${userId}`)
      ],
      [
        Markup.button.callback('❌ Удалить', `delete_${userId}`),
        Markup.button.callback('🔙 Назад к списку', 'user_list')
      ]
    ]);
  }
  
  /**
   * Создает клавиатуру подтверждения действия
   * @param action Действие для подтверждения
   * @param id ID объекта
   */
  static confirmationKeyboard(action: string, id: number | string): any {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Да', `confirm_${action}_${id}`),
        Markup.button.callback('❌ Нет', `cancel_${action}_${id}`)
      ]
    ]);
  }
  
  /**
   * Создает клавиатуру для отмены операции
   * @returns Объект клавиатуры
   */
  static cancelKeyboard() {
    return Markup.keyboard([
      ['❌ Отмена']
    ]).oneTime().resize();
  }
  
  /**
   * Создает клавиатуру с быстрым выбором временных периодов
   */
  static periodSelectionKeyboard(): any {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('Сегодня', 'period_day'),
        Markup.button.callback('24 часа', 'period_24h'),
        Markup.button.callback('1 час', 'period_hour')
      ],
      [
        Markup.button.callback('2 дня', 'period_2days'),
        Markup.button.callback('3 дня', 'period_3days'),
        Markup.button.callback('Неделя', 'period_week')
      ],
      [
        Markup.button.callback('Месяц', 'period_month'),
        Markup.button.callback('Свой период', 'period_custom')
      ]
    ]);
  }
  
  /**
   * Создает клавиатуру с действиями после создания пользователя
   * @param userId ID созданного пользователя
   */
  static userActionsAfterCreateKeyboard(userId: number): any {
    return Markup.inlineKeyboard([
      [Markup.button.callback('📝 Просмотреть детали', `user_${userId}`)],
      [Markup.button.callback('➕ Создать ещё одного', 'add_more_users')],
      [Markup.button.callback('🔙 Вернуться в меню', 'admin_user_menu')]
    ]);
  }
  
  /**
   * Создает пагинированную инлайн-клавиатуру для списка пользователей
   */
  static userListPaginationKeyboard(users: any[], currentPage: number, totalPages: number): any {
    // Создаем кнопки для каждого пользователя на текущей странице
    const userButtons = users.map(user => [
      Markup.button.callback(`${user.name} (ID: ${user.id})`, `user_${user.id}`)
    ]);
    
    // Добавляем кнопки пагинации
    const paginationButtons = [];
    
    // Всегда добавляем кнопку для возврата на первую страницу, если мы не на первой странице
    if (currentPage > 1) {
      paginationButtons.push(Markup.button.callback('⏮️ Первая', 'user_page_1'));
    }
    
    // Кнопка предыдущей страницы
    if (currentPage > 1) {
      paginationButtons.push(Markup.button.callback('◀️ Назад', `user_page_${currentPage - 1}`));
    }
    
    // Отображаем текущую страницу из общего количества
    paginationButtons.push(Markup.button.callback(`${currentPage} из ${totalPages}`, 'current_page'));
    
    // Кнопка следующей страницы
    if (currentPage < totalPages) {
      paginationButtons.push(Markup.button.callback('▶️ Вперед', `user_page_${currentPage + 1}`));
    }
    
    // Всегда добавляем кнопку для перехода на последнюю страницу, если мы не на последней странице
    if (currentPage < totalPages) {
      paginationButtons.push(Markup.button.callback('⏭️ Последняя', `user_page_${totalPages}`));
    }
    
    // Объединяем все кнопки
    const allButtons = [
      ...userButtons,
      paginationButtons,
      // Добавляем кнопки действий внизу
      [
        Markup.button.callback('➕ Добавить еще', 'add_more_users'),
        Markup.button.callback('🔙 Назад', 'admin_user_menu')
      ]
    ];
    
    return Markup.inlineKeyboard(allButtons);
  }
  

  
  /**
   * Создает клавиатуру для пагинации транзакций пользователя
   */
  static transactionsPaginationKeyboard(userId: number, currentPage: number, totalTransactions: number): InlineKeyboardMarkup {
    const totalPages = Math.ceil(totalTransactions / 5);
    
    // Создаем кнопки пагинации
    const paginationButtons = [];
    
    // Кнопка "Назад" (если не на первой странице)
    if (currentPage > 1) {
      paginationButtons.push(
        Markup.button.callback('⬅️', `user_transactions_page_${currentPage - 1}_${userId}`)
      );
    }
    
    // Кнопка текущей страницы
    paginationButtons.push(
      Markup.button.callback(`${currentPage} из ${totalPages}`, 'page_info_do_nothing')
    );
    
    // Кнопка "Вперед" (если не на последней странице)
    if (currentPage < totalPages) {
      paginationButtons.push(
        Markup.button.callback('➡️', `user_transactions_page_${currentPage + 1}_${userId}`)
      );
    }
    
    // Формируем клавиатуру с пагинацией и другими кнопками
    const buttons = [
      paginationButtons,
      [
        Markup.button.callback('📆 Фильтр по датам', `transactions_date_filter_${userId}`),
        Markup.button.callback('📊 По дням', `transactions_daily_stats_${userId}`)
      ],
      [
        Markup.button.callback('🔙 Назад к пользователю', `user_${userId}`),
        Markup.button.callback('🔙 К списку', 'admin_user_list')
      ]
    ];
    
    return Markup.inlineKeyboard(buttons);
  }
  
  /**
   * Создает клавиатуру для фильтрации транзакций по датам
   */
  static transactionsDateFilterKeyboard(userId: number): InlineKeyboardMarkup {
    // Получаем текущую дату
    const today = new Date();
    
    // Форматируем даты для кнопок
    const todayStr = today.toLocaleDateString('ru-RU');
    
    // Вчера
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('ru-RU');
    
    // Неделя назад
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toLocaleDateString('ru-RU');
    
    // Месяц назад
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    const monthAgoStr = monthAgo.toLocaleDateString('ru-RU');
    
    // Формируем клавиатуру
    const buttons = [
      [
        Markup.button.callback('📅 За сегодня', `transactions_date_${userId}_${todayStr}_${todayStr}`),
        Markup.button.callback('📅 За вчера', `transactions_date_${userId}_${yesterdayStr}_${yesterdayStr}`)
      ],
      [
        Markup.button.callback('📅 Последние 7 дней', `transactions_date_${userId}_${weekAgoStr}_${todayStr}`),
        Markup.button.callback('📅 Последние 30 дней', `transactions_date_${userId}_${monthAgoStr}_${todayStr}`)
      ],
      [
        Markup.button.callback('📆 За месяц', `transactions_date_${userId}_${monthAgoStr}_${todayStr}`),
        Markup.button.callback('📋 Все транзакции', `user_transactions_${userId}`)
      ],
      [
        Markup.button.callback('📆 Свой диапазон дат', `transactions_custom_date_${userId}`),
        Markup.button.callback('🔙 Назад к пользователю', `user_${userId}`)
      ]
    ];
    
    return Markup.inlineKeyboard(buttons);
  }

  /**
   * Создает меню действий для кабинета IDEX
   * @param cabinetId ID кабинета IDEX
   * @returns Inline-клавиатура
   */
  static idexCabinetActionsKeyboard(cabinetId: number): InlineKeyboardMarkup {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('📊 Детали кабинета', `view_idex_cabinet_details_${cabinetId}`),
        Markup.button.callback('🔄 Синхронизировать', `sync_idex_cabinet_${cabinetId}`)
      ],
      [
        Markup.button.callback('📋 Все транзакции', `view_idex_transactions_${cabinetId}_1_all`),
        Markup.button.callback('❌ Удалить кабинет', `delete_idex_cabinet_${cabinetId}`)
      ],
      [
        Markup.button.callback('📆 Фильтр по времени', `idex_time_filter_${cabinetId}`)
      ],
      [
        Markup.button.callback('🔙 Назад к IDEX кабинетам', 'back_to_idex_cabinets')
      ]
    ]);
  }

  /**
   * Создает меню выбора временного фильтра для транзакций IDEX
   * @param cabinetId ID кабинета IDEX
   * @returns Inline-клавиатура
   */
  static idexTimeFilterKeyboard(cabinetId: number): InlineKeyboardMarkup {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('🕛 За 12 часов', `view_idex_transactions_${cabinetId}_1_last12h`),
        Markup.button.callback('🕒 За 24 часа', `view_idex_transactions_${cabinetId}_1_last24h`)
      ],
      [
        Markup.button.callback('📅 Сегодня', `view_idex_transactions_${cabinetId}_1_today`),
        Markup.button.callback('📅 Вчера', `view_idex_transactions_${cabinetId}_1_yesterday`)
      ],
      [
        Markup.button.callback('📆 За 2 дня', `view_idex_transactions_${cabinetId}_1_last2days`),
        Markup.button.callback('📆 За неделю', `view_idex_transactions_${cabinetId}_1_thisWeek`)
      ],
      [
        Markup.button.callback('📆 За месяц', `view_idex_transactions_${cabinetId}_1_thisMonth`),
        Markup.button.callback('📋 Все транзакции', `view_idex_transactions_${cabinetId}_1_all`)
      ],
      [
        Markup.button.callback('📆 Свой диапазон дат', `custom_date_range_${cabinetId}`)
      ],
      [
        Markup.button.callback('🔙 Назад', `back_to_idex_cabinet_${cabinetId}`)
      ]
    ]);
  }
  
  /**
   * Создает пагинированную инлайн-клавиатуру для списка транзакций IDEX
   */
  static idexTransactionsPaginationKeyboard(
    cabinetId: number, 
    currentPage: number, 
    totalPages: number, 
    timeFilter: string = 'all'
  ): InlineKeyboardMarkup {
    const buttons = [];
    
    // Добавляем навигационные кнопки
    const navigationRow = [];
    
    // Всегда добавляем кнопку для возврата на первую страницу, если мы не на первой странице
    if (currentPage > 1) {
      navigationRow.push(
        Markup.button.callback('⬅️', `view_idex_transactions_${cabinetId}_${currentPage - 1}_${timeFilter}`)
      );
    }
    
    // Кнопка предыдущей страницы
    if (currentPage > 1) {
      navigationRow.push(
        Markup.button.callback('◀️ Назад', `view_idex_transactions_${cabinetId}_${currentPage - 1}_${timeFilter}`)
      );
    }
    
    // Отображаем текущую страницу из общего количества
    navigationRow.push(
      Markup.button.callback(`${currentPage} из ${totalPages}`, 'noop')
    );
    
    // Кнопка следующей страницы
    if (currentPage < totalPages) {
      navigationRow.push(
        Markup.button.callback('▶️ Вперед', `view_idex_transactions_${cabinetId}_${currentPage + 1}_${timeFilter}`)
      );
    }
    
    // Всегда добавляем кнопку для перехода на последнюю страницу, если мы не на последней странице
    if (currentPage < totalPages) {
      navigationRow.push(
        Markup.button.callback('⏭️ Последняя', `view_idex_transactions_${cabinetId}_${totalPages}_${timeFilter}`)
      );
    }
    
    // Объединяем все кнопки
    buttons.push(navigationRow);
    
    // Добавляем кнопку для выбора временного фильтра
    buttons.push([
      {
        text: '📆 Фильтр по времени',
        callback_data: `idex_tx_filter_${cabinetId}`
      }
    ]);
    
    // Кнопка для возврата к деталям кабинета
    buttons.push([
      {
        text: '◀️ Назад к кабинету',
        callback_data: `idex_cabinet_details_${cabinetId}`
      }
    ]);
    
    return { inline_keyboard: buttons };
  }
  
  /**
   * Создает клавиатуру для подтверждения действия
   * @param confirmAction Действие для подтверждения
   * @param cancelAction Действие для отмены
   * @returns Inline-клавиатура
   */
  static confirmActionKeyboard(confirmAction: string, cancelAction: string): InlineKeyboardMarkup {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Да', confirmAction),
        Markup.button.callback('❌ Нет', cancelAction)
      ]
    ]);
  }
  
  /**
   * Создает клавиатуру для отмены ввода
   * @param cancelAction Действие для отмены
   * @returns Inline-клавиатура
   */
  static cancelInputKeyboard(cancelAction: string): InlineKeyboardMarkup {
    return Markup.inlineKeyboard([
      [Markup.button.callback('❌ Отмена', cancelAction)]
    ]);
  }

  /**
   * Создает клавиатуру для пагинации при просмотре транзакций кабинета IDEX
   * @param cabinetId ID кабинета
   * @param currentPage Текущая страница
   * @param totalPages Всего страниц
   * @param timeFilter Текущий фильтр времени
   * @returns Клавиатуру с кнопками навигации
   */
  static idexTransactionsPaginationKeyboard(
    cabinetId: number, 
    currentPage: number, 
    totalPages: number,
    timeFilter: string = 'all'
  ): InlineKeyboardMarkup {
    const keyboard: InlineKeyboardButton[][] = [];
    
    // Добавляем навигационные кнопки для пагинации
    const paginationRow: InlineKeyboardButton[] = [];
    
    // Кнопка "Назад" (если не на первой странице)
    if (currentPage > 1) {
      paginationRow.push(
        Markup.button.callback('◀️ Назад', `idex_tx_page_${cabinetId}_${currentPage - 1}_${timeFilter}`)
      );
    }
    
    // Кнопка текущей страницы
    paginationRow.push(
      Markup.button.callback(`${currentPage} из ${totalPages}`, 'page_info_do_nothing')
    );
    
    // Кнопка "Вперед" (если не на последней странице)
    if (currentPage < totalPages) {
      paginationRow.push(
        Markup.button.callback('➡️', `idex_tx_page_${cabinetId}_${currentPage + 1}_${timeFilter}`)
      );
    }
    
    if (paginationRow.length > 0) {
      keyboard.push(paginationRow);
    }
    
    // Добавляем кнопку для выбора временного фильтра
    keyboard.push([
      {
        text: '📆 Фильтр по времени',
        callback_data: `idex_tx_filter_${cabinetId}`
      }
    ]);
    
    // Кнопка для возврата к деталям кабинета
    keyboard.push([
      {
        text: '◀️ Назад к кабинету',
        callback_data: `idex_cabinet_details_${cabinetId}`
      }
    ]);
    
    return { inline_keyboard: keyboard };
  }
  
  /**
   * Создает клавиатуру для выбора временного фильтра при просмотре транзакций
   * @param cabinetId ID кабинета
   * @returns Клавиатуру с вариантами временных фильтров
   */
  static idexTimeFilterKeyboard(cabinetId: number): InlineKeyboardMarkup {
    const keyboard: InlineKeyboardButton[][] = [
      [
        { text: '🕛 За 12 часов', callback_data: `idex_tx_time_${cabinetId}_last12h` },
        { text: '🕒 За 24 часа', callback_data: `idex_tx_time_${cabinetId}_last24h` }
      ],
      [
        { text: '📅 Сегодня', callback_data: `idex_tx_time_${cabinetId}_today` },
        { text: '📅 Вчера', callback_data: `idex_tx_time_${cabinetId}_yesterday` }
      ],
      [
        { text: '📆 За 2 дня', callback_data: `idex_tx_time_${cabinetId}_last2days` },
        { text: '📆 За неделю', callback_data: `idex_tx_time_${cabinetId}_thisWeek` }
      ],
      [
        { text: '📆 За месяц', callback_data: `idex_tx_time_${cabinetId}_thisMonth` },
        { text: '📋 Все транзакции', callback_data: `idex_tx_time_${cabinetId}_all` }
      ],
      [
        { text: '📆 Свой диапазон дат', callback_data: `custom_date_range_${cabinetId}` }
      ],
      [
        { text: '◀️ Назад', callback_data: `back_to_idex_cabinet_${cabinetId}` }
      ]
    ];
    
    return { inline_keyboard: keyboard };
  }

  /**
   * Создает клавиатуру для меню управления пользователями
   * @returns Объект клавиатуры
   */
  static adminUserManagementMenu() {
    return Markup.keyboard([
      ['👥 Список пользователей', '➕ Добавить пользователя'],
      ['📊 Статистика', '🔙 Назад к админ-панели']
    ]).resize();
  }
  

  
  /**
   * Создает inline клавиатуру для просмотра деталей пользователя
   * @param userId ID пользователя
   * @returns Объект inline клавиатуры
   */
  static userDetailsKeyboard(userId: number) {
    const telegramAccounts = prisma.telegramAccount.findMany( {where: {userId}} );



    return Markup.inlineKeyboard([
      [
        Markup.button.callback('📊 Статистика', `user_stats_${userId}`),
        Markup.button.callback('✏️ Переименовать', `rename_user_${userId}`)
      ],
      [
        Markup.button.callback('🗑️ Удалить', `delete_${userId}`),
        Markup.button.callback('👑 Управление админкой', `admin_manage_${userId}`)

      ],
      [
        Markup.button.callback('🔙 К списку пользователей', 'user_list')
      ]
    ]);
  }



/**
 * Создает inline клавиатуру для управления правами администратора
 * @param userId ID пользователя
 * @returns Объект inline клавиатуры
 */
static adminManagementKeyboard(userId: number) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('👑 Дать админку', `make_admin_${userId}`),
      Markup.button.callback('🚫 Убрать админку', `remove_admin_${userId}`)
    ],
    [
      Markup.button.callback('🔙 Назад к пользователю', `user_${userId}`)
    ]
  ]);
}
  
  /**
   * Создает inline клавиатуру после создания пользователя
   * @param userId ID созданного пользователя
   * @returns Объект inline клавиатуры
   */
  static userActionsAfterCreateKeyboard(userId: number) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('👁️ Просмотреть информацию', `user_${userId}`)
      ],
      [
        Markup.button.callback('👥 К списку пользователей', 'user_list')
      ],
      [
        Markup.button.callback('➕ Создать ещё одного', 'add_more_users')
      ]
    ]);
  }
  
  /**
   * Создает inline клавиатуру после переименования пользователя
   * @param userId ID переименованного пользователя
   * @returns Объект inline клавиатуры
   */
  static userActionsAfterRenameKeyboard(userId: number) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('👁️ Просмотреть информацию', `user_${userId}`)
      ],
      [
        Markup.button.callback('🔙 К списку пользователей', 'user_list')
      ]
    ]);
  }
  
  /**
   * Создает клавиатуру для отмены ввода
   * @param cancelAction Действие при отмене
   * @returns Объект inline клавиатуры
   */
  static cancelInputKeyboard(cancelAction: string) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('❌ Отмена', cancelAction)
      ]
    ]);
  }

  // Список пользователей с кнопками просмотра
  static userListWithViewButtons(users: any[]) {
    return Markup.inlineKeyboard(
      users.map(user => [
        Markup.button.callback(
          `${user.name} (${user.matchCount} мэтчей)`, 
          `view_user_matches_${user.id}`
        )
      ])
    );  
  }

    // Меню мэтчей для админа
    static matchMenu() {
      return Markup.keyboard([
        ['🔄 Замэтчить период', '📋 Список мэтчей'],
        ['👥 Мэтчи по пользователям'],
        ['🔙 Назад в меню админа']
      ]).resize();
    }

    // Меню ввода диапазона дат
    static dateRangeInputMenu() {
      return Markup.keyboard([
        ['🔙 Назад к меню мэтчей']
      ]).resize();
    }

    // Пагинация матчей пользователя
    static userMatchesPagination(currentPage: number, totalPages: number) {
      const buttons = [];
      
      // Кнопка предыдущей страницы, если не на первой странице
      if (currentPage > 1) {
        buttons.push(Markup.button.callback('◀️ Назад', `user_matches_page_${currentPage - 1}`));
      }
      
      // Индикатор текущей страницы
      buttons.push(Markup.button.callback(`${currentPage} из ${totalPages}`, 'noop'));
      
      // Кнопка следующей страницы, если не на последней странице
      if (currentPage < totalPages) {
        buttons.push(Markup.button.callback('▶️ Вперед', `user_matches_page_${currentPage + 1}`));
      }
      
      return Markup.inlineKeyboard([buttons]);
    }

    // Пагинация всех матчей
    static allMatchesPagination(currentPage: number, totalPages: number) {
      const buttons = [];
      
      // Кнопка предыдущей страницы, если не на первой странице
      if (currentPage > 1) {
        buttons.push(Markup.button.callback('◀️ Назад', `all_matches_page_${currentPage - 1}`));
      }
      
      // Индикатор текущей страницы
      buttons.push(Markup.button.callback(`${currentPage} из ${totalPages}`, 'noop'));
      
      // Кнопка следующей страницы, если не на последней странице
      if (currentPage < totalPages) {
        buttons.push(Markup.button.callback('▶️ Вперед', `all_matches_page_${currentPage + 1}`));
      }
      
      return Markup.inlineKeyboard([buttons]);
    }

    // Пагинация списка пользователей
    static usersListPagination(currentPage: number, totalPages: number) {
      const buttons = [];
      
      // Кнопка предыдущей страницы, если не на первой странице
      if (currentPage > 1) {
        buttons.push(Markup.button.callback('◀️ Назад', `users_list_page_${currentPage - 1}`));
      }
      
      // Индикатор текущей страницы
      buttons.push(Markup.button.callback(`${currentPage} из ${totalPages}`, 'noop'));
      
      // Кнопка следующей страницы, если не на последней странице
      if (currentPage < totalPages) {
        buttons.push(Markup.button.callback('▶️ Вперед', `users_list_page_${currentPage + 1}`));
      }
      
      return Markup.inlineKeyboard([buttons]);
    }

  // Меню отчетов (если этого не было в оригинале)
  static reportsMenu() {
    return Markup.keyboard([
      ['📂 Все отчеты', '📅 Отчеты за период'],
      ['🔙 Назад в меню админа']
    ]).resize();
  }

  // Меню статистики (если этого не было в оригинале)
  static statsMenu() {
    return Markup.keyboard([
      ['📈 Общая статистика', '👤 Статистика по пользователям'],
        ['🔙 Назад в меню админа']
      ]).resize();
    }
  
  /**
   * Создает клавиатуру для меню статистики пользователей
   * @returns Объект клавиатуры
   */
  static adminStatsMenu() {
    return Markup.keyboard([
      ['📊 Общая статистика', '📈 Активные пользователи'],
      ['📉 Неактивные пользователи', '💰 Транзакции'],
      ['🔙 Назад к управлению']
    ]).resize();
  }

  /**
   * Создает клавиатуру для выбора типа отчета
   */
  static reportTypeKeyboard(): any {
    return Markup.keyboard([
      [{ text: '💸 Telegram кошелек' }, { text: '📊 Bybit' }],
      [{ text: '❌ Отмена' }]
    ]).resize();
  }
}
