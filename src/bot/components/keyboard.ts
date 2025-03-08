import { Markup } from 'telegraf';

/**
 * Класс для создания клавиатур Telegram
 */
export class KeyboardBuilder {
  /**
   * Создает главное меню обычного пользователя
   */
  static mainMenu() {
    return Markup.keyboard([
      [{ text: '🔑 Ввести код' }, { text: '📊 Загрузить отчет' }],
      [{ text: '⏰ Начать работу' }, { text: '⏹️ Закончить работу' }],
      [{ text: 'ℹ️ Информация о текущей сессии' }],
      [{ text: '📋 Моя статистика' }, { text: '❓ Помощь' }]
    ]).resize();
  }
  
  /**
   * Создает главное меню администратора
   */
  static adminMainMenu() {
    return Markup.keyboard([
      [{ text: '👥 Управление пользователями' }, { text: '📊 Статистика' }],
      [{ text: '⚙️ Настройки' }, { text: '⚠️ Уведомления' }],
      [{ text: '🔙 Обычный режим' }, { text: '❓ Помощь' }]
    ]).resize();
  }
  
  /**
   * Создает меню управления пользователями для администратора
   */
  static adminUserManagementMenu() {
    return Markup.keyboard([
      [{ text: '➕ Добавить пользователя' }, { text: '👥 Список пользователей' }],
      [{ text: '🔙 Назад к админ-панели' }]
    ]).resize();
  }
  
  /**
   * Создает меню статистики для администратора
   */
  static adminStatsMenu() {
    return Markup.keyboard([
      [{ text: '📅 За сегодня' }, { text: '⏱️ За 24 часа' }, { text: '⌛ За час' }],
      [{ text: '📆 За 2 дня' }, { text: '📅 За 3 дня' }, { text: '📊 За неделю' }],
      [{ text: '📈 За месяц' }, { text: '🔍 Произвольный период' }],
      [{ text: '🔙 Назад к админ-панели' }]
    ]).resize();
  }
  
  /**
   * Создает клавиатуру пагинации для списков
   * @param currentPage Текущая страница
   * @param totalPages Всего страниц
   * @param prefix Префикс для callback-данных
   */
  static paginationKeyboard(currentPage: number, totalPages: number, prefix: string = 'page') {
    const buttons = [];
    
    // Предыдущая страница
    if (currentPage > 1) {
      buttons.push(Markup.button.callback('⬅️ Назад', `${prefix}_${currentPage - 1}`));
    }
    
    // Информация о текущей странице
    buttons.push(Markup.button.callback(`${currentPage} из ${totalPages}`, 'noop'));
    
    // Следующая страница
    if (currentPage < totalPages) {
      buttons.push(Markup.button.callback('Далее ➡️', `${prefix}_${currentPage + 1}`));
    }
    
    return Markup.inlineKeyboard([buttons]);
  }
  
  /**
   * Создает клавиатуру для управления конкретным пользователем
   * @param userId ID виртуального пользователя
   */
  static userManagementKeyboard(userId: number) {
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
  static confirmationKeyboard(action: string, id: number | string) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Да', `confirm_${action}_${id}`),
        Markup.button.callback('❌ Нет', `cancel_${action}_${id}`)
      ]
    ]);
  }
  
  /**
   * Создает клавиатуру с кнопкой отмены операции
   */
  static cancelKeyboard() {
    return Markup.keyboard([
      [{ text: '❌ Отмена' }]
    ]).oneTime().resize();
  }
  
  /**
   * Создает клавиатуру с быстрым выбором временных периодов
   */
  static periodSelectionKeyboard() {
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
  static userActionsAfterCreateKeyboard(userId: number) {
    return Markup.inlineKeyboard([
      [Markup.button.callback('📝 Просмотреть детали', `user_${userId}`)],
      [Markup.button.callback('➕ Добавить еще пользователя', 'add_more_users')],
      [Markup.button.callback('🔙 Вернуться в меню', 'admin_user_menu')]
    ]);
  }
  
  /**
   * Создает пагинированную инлайн-клавиатуру для списка пользователей
   */
  static userListPaginationKeyboard(users: any[], currentPage: number, totalPages: number) {
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
    paginationButtons.push(Markup.button.callback(`${currentPage} / ${totalPages}`, 'current_page'));
    
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
   * Создает клавиатуру для управления конкретным пользователем
   */
  static userDetailsKeyboard(userId: number, isActive: boolean = true) {
    const buttons = [
      [
        Markup.button.callback(`${isActive ? '🚫 Заблокировать' : '✅ Активировать'}`, `toggle_user_status_${userId}`),
        Markup.button.callback('🗑️ Удалить', `delete_user_confirm_${userId}`)
      ],
      [
        Markup.button.callback('📊 Подробная статистика', `user_stats_${userId}`),
        Markup.button.callback('📜 Все транзакции', `user_transactions_${userId}`)
      ],
      [
        Markup.button.callback('🔙 Назад к списку', 'admin_user_list')
      ]
    ];
    
    return Markup.inlineKeyboard(buttons);
  }
  
  /**
   * Создает клавиатуру для пагинации транзакций пользователя
   */
  static transactionsPaginationKeyboard(userId: number, currentPage: number, totalTransactions: number) {
    const totalPages = Math.ceil(totalTransactions / 5);
    
    // Создаем кнопки пагинации
    const paginationButtons = [];
    
    // Кнопка "Назад" (если не на первой странице)
    if (currentPage > 1) {
      paginationButtons.push(Markup.button.callback('⬅️', `user_transactions_page_${currentPage - 1}_${userId}`));
    }
    
    // Кнопка текущей страницы
    paginationButtons.push(Markup.button.callback(`${currentPage} / ${totalPages}`, 'current_page'));
    
    // Кнопка "Вперед" (если не на последней странице)
    if (currentPage < totalPages) {
      paginationButtons.push(Markup.button.callback('➡️', `user_transactions_page_${currentPage + 1}_${userId}`));
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
  static transactionsDateFilterKeyboard(userId: number) {
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
        Markup.button.callback('📝 Указать свой период', `transactions_custom_date_${userId}`),
        Markup.button.callback('🔍 Все транзакции', `user_transactions_${userId}`)
      ],
      [
        Markup.button.callback('🔙 Назад к пользователю', `user_${userId}`)
      ]
    ];
    
    return Markup.inlineKeyboard(buttons);
  }
}
