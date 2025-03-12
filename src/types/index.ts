import { Context } from 'telegraf';

export interface P2PTransaction {
  id: string;
  orderNo: string;
  dateTime: string;
  type: string;
  asset: string;
  amount: number;
  totalPrice: number;
  unitPrice: number;
  counterparty: string;
  status: string;
  [key: string]: string | number; // Для любых дополнительных полей
}

export interface ParsedCSV {
  transactions: P2PTransaction[];
  summary: {
    totalTransactions: number;
    totalAmount: Record<string, number>;
    totalValue: Record<string, number>;
    averagePrice: Record<string, number>;
  };
}

// Новые типы для бизнес-логики

export interface VirtualUser {
  id: number;
  name: string;
  passCode: string;
  isActive: boolean;
  telegramAccounts: TelegramAccount[];
  workSessions: WorkSession[];
  lastNotified?: Date;
}

export interface TelegramAccount {
  id: number;
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  userId: number;
}

export interface WorkSession {
  id: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  userId: number;
}

export interface TransactionDB {
  id: number;
  externalId?: string;
  orderNo?: string;
  dateTime: Date;
  type: string;
  asset: string;
  amount: number;
  totalPrice: number;
  unitPrice: number;
  counterparty?: string;
  status: string;
  userId: number;
}

export interface ReportNotification {
  id: number;
  notificationTime: Date;
  reportReceived: boolean;
  reportTime?: Date;
  adminNotified: boolean;
  adminNotifyTime?: Date;
  userId: number;
}

export interface SystemSettings {
  reportReminderInterval: number; // в минутах
  reportWaitTime: number; // в минутах
}

// Расширяем тип Context для использования в боте
export interface BotContext extends Context {
  session: {
    fileRequested?: boolean;
    userId?: number; // ID виртуального пользователя, если аутентифицирован
    isAdmin?: boolean; // Флаг администратора
    lastMessage?: number; // ID последнего сообщения для редактирования
    lastAction?: string; // Последнее действие для поддержки состояния диалога
    authAttempts?: number; // Количество попыток ввода кода
    tempData?: any; // Временные данные для многошаговых операций
    currentPage?: number; // Текущая страница для пагинации
    activeWorkSessionId?: number; // ID активной рабочей сессии
    matchAction?: string; // Новое поле для действий мэтчинга
    viewingUserId?: number; // Новое поле для хранения ID просматриваемого пользователя
    
    // Данные для загрузки отчета
    reportStep?: 'waiting_file' | 'waiting_period_start' | 'waiting_period_end' | 'waiting_exchange';
    reportData?: {
      filePath?: string;
      fileName?: string;
      periodStart?: string;
      periodEnd?: string;
      exchange?: string;
    };
    
    // Поля для поддержки админ-функциональности
    waitingForAddUser?: boolean; // Ожидание имени для нового пользователя
    waitingForRename?: number; // ID пользователя для переименования
    waitingForUserName?: boolean; // Ожидание ввода имени пользователя
    creatingUser?: boolean; // Флаг создания нового пользователя
    userListPage?: number; // Текущая страница в списке пользователей
    selectedUserId?: number; // ID выбранного пользователя для управления
    dateRangeStart?: Date; // Начало периода для отчетов и статистики
    dateRangeEnd?: Date; // Конец периода для отчетов и статистики
    settingsMode?: string | boolean; // Режим настроек
    
    // Данные для добавления пользователя
    userStep?: 'waiting_name' | 'waiting_email' | 'waiting_role' | 'waiting_confirm';
    userData?: {
      name?: string;
      email?: string;
      role?: 'user' | 'admin';
    };
    
    // Данные для IDEX кабинета
    idexCabinetData?: {
      idexId?: number;
      login?: string;
      password?: string;
    };
    idexCabinetStep?: 'waiting_idex_id' | 'waiting_login' | 'waiting_password';
  };
  
  match?: RegExpExecArray;
  
  // Методы из Context Telegraf
  reply(text: string, extra?: any): Promise<any>;
  replyWithMarkdown(text: string, extra?: any): Promise<any>;
  replyWithHTML(text: string, extra?: any): Promise<any>;
  replyWithPhoto(photo: any, extra?: any): Promise<any>;
  replyWithDocument(document: any, extra?: any): Promise<any>;
  deleteMessage(messageId?: number): Promise<any>;
  editMessageText(text: string, extra?: any): Promise<any>;
  editMessageReplyMarkup(markup: any): Promise<any>;
  answerCallbackQuery(text?: string, extra?: any): Promise<boolean>;
  scene: any;
}
