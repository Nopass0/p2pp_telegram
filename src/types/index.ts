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

export interface BotContext {
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
    
    // Новые поля для поддержки админ-функциональности
    waitingForAddUser?: boolean; // Ожидание имени для нового пользователя
    waitingForRename?: number; // ID пользователя для переименования
    userListPage?: number; // Текущая страница в списке пользователей
    selectedUserId?: number; // ID выбранного пользователя для управления
    dateRangeStart?: Date; // Начало периода для отчетов и статистики
    dateRangeEnd?: Date; // Конец периода для отчетов и статистики
  };
}
