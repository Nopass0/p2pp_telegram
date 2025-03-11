import { prisma } from './prisma';
import axios from 'axios';

interface LoginCredentials {
  login: string;
  password: string;
}

interface Cookie {
  domain: string;
  expirationDate: number;
  hostOnly: boolean;
  httpOnly: boolean;
  name: string;
  path: string;
  sameSite?: string;
  secure: boolean;
  session: boolean;
  storeId?: string;
  value: string;
}

interface Transaction {
  id: string;
  payment_method_id: string;
  wallet: string;
  amount: any;
  total: any;
  status: number;
  approved_at?: string;
  expired_at?: string;
  created_at: string;
  updated_at: string;
  [key: string]: any;
}

interface IdexCabinet {
  id: number;
  idexId: number;
  login: string;
  password: string;
}

const BASE_URL = 'https://panel.gate.cx';
const MAX_RETRIES = 5;
const BASE_DELAY = 1000;
const DEFAULT_PAGES_TO_FETCH = 25;

/**
 * Сервис для работы с IDEX кабинетами
 */
export class IDEXService {
  /**
   * Получает список всех IDEX кабинетов с пагинацией
   * @param page Номер страницы (начиная с 1)
   * @param perPage Количество записей на странице
   * @returns Объект с кабинетами и метаданными пагинации
   */
  static async getAllCabinets(page: number = 1, perPage: number = 5): Promise<{
    cabinets: any[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
  }> {
    const skip = (page - 1) * perPage;
    
    // Получаем общее количество записей
    const totalCount = await prisma.IdexCabinet.count();
    
    // Вычисляем общее количество страниц
    const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
    
    // Получаем записи для текущей страницы с количеством транзакций
    const cabinets = await prisma.IdexCabinet.findMany({
      skip,
      take: perPage,
      orderBy: {
        id: 'asc'
      },
      include: {
        _count: {
          select: {
            transactions: true
          }
        }
      }
    });
    
    return {
      cabinets,
      totalCount,
      totalPages,
      currentPage: page
    };
  }
  
  /**
   * Создает новый IDEX кабинет
   * @param idexId ID кабинета IDEX
   * @param login Логин для кабинета
   * @param password Пароль для кабинета
   * @returns Созданный кабинет
   */
  static async createCabinet(idexId: number, login: string, password: string): Promise<any> {
    return prisma.IdexCabinet.create({
      data: {
        idexId,
        login,
        password
      }
    });
  }
  
  /**
   * Получает кабинет по ID
   * @param id ID кабинета
   * @returns Найденный кабинет или null
   */
  static async getCabinetById(id: number): Promise<any | null> {
    return prisma.IdexCabinet.findUnique({
      where: { id }
    });
  }
  
  /**
   * Удаляет IDEX кабинет по ID
   * @param id ID кабинета
   * @returns Удаленный кабинет
   */
  static async deleteCabinet(id: number): Promise<any> {
    return prisma.IdexCabinet.delete({
      where: { id }
    });
  }

  /**
   * Авторизовывается в IDEX и получает куки для доступа
   * @param credentials Учетные данные для авторизации
   * @returns Куки для доступа к API IDEX
   */
  private static async login(credentials: LoginCredentials): Promise<Cookie[]> {
    const loginUrl = `${BASE_URL}/api/v1/auth/basic/login`;
    
    let retryCount = 0;
    let delay = BASE_DELAY;
    
    while (true) {
      try {
        const response = await axios.post(loginUrl, credentials);
        
        if (response.status === 200) {
          const cookies = response.headers['set-cookie'] || [];
          
          if (cookies.length === 0) {
            throw new Error('Не получены куки после авторизации');
          }
          
          const result: Cookie[] = [];
          
          for (const cookieStr of cookies) {
            const cookieParts = cookieStr.split(';')[0].split('=');
            const name = cookieParts[0];
            const value = cookieParts.slice(1).join('=');
            
            if (name === 'sid' || name === 'rsid') {
              const cookie: Cookie = {
                domain: '.panel.gate.cx',
                expirationDate: Date.now() / 1000 + 86400, // Время жизни 1 день
                hostOnly: false,
                httpOnly: true,
                name,
                path: '/',
                secure: true,
                session: false,
                value
              };
              
              result.push(cookie);
            }
          }
          
          if (result.length < 2) {
            throw new Error('Отсутствуют необходимые куки (sid и/или rsid)');
          }
          
          return result;
        } else if (response.status === 429) {
          // Слишком много запросов
          if (retryCount >= MAX_RETRIES) {
            throw new Error('Превышено максимальное количество попыток. Последний статус: 429 Too Many Requests');
          }
          
          const retryAfter = parseInt(response.headers['retry-after'] || String(delay));
          console.warn(`Ограничение скорости (429). Ожидание ${retryAfter}мс перед повторной попыткой. Попытка ${retryCount + 1}/${MAX_RETRIES}`);
          
          await new Promise(resolve => setTimeout(resolve, retryAfter));
          
          retryCount++;
          delay *= 2; // Экспоненциальное увеличение задержки
        } else if (response.status === 409) {
          throw new Error('Авторизация не удалась со статусом: 409 Conflict. Вероятно, учетные данные неверны или аккаунт заблокирован.');
        } else {
          throw new Error(`Авторизация не удалась со статусом: ${response.status}`);
        }
      } catch (error: any) {
        if (error.response?.status === 429) {
          // Обработка случая, когда axios выбрасывает ошибку вместо возврата ответа
          if (retryCount >= MAX_RETRIES) {
            throw new Error('Превышено максимальное количество попыток. Последний статус: 429 Too Many Requests');
          }
          
          const retryAfter = parseInt(error.response.headers['retry-after'] || String(delay));
          console.warn(`Ограничение скорости (429). Ожидание ${retryAfter}мс перед повторной попыткой. Попытка ${retryCount + 1}/${MAX_RETRIES}`);
          
          await new Promise(resolve => setTimeout(resolve, retryAfter));
          
          retryCount++;
          delay *= 2; // Экспоненциальное увеличение задержки
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Получает страницу транзакций из IDEX API
   * @param cookies Куки для авторизации
   * @param page Номер страницы
   * @returns Массив транзакций
   */
  private static async fetchTransactionsPage(cookies: Cookie[], page: number): Promise<Transaction[]> {
    const cookieStr = cookies
      .map(c => `${c.name}=${c.value}`)
      .join('; ');
    
    const transactionsUrl = `${BASE_URL}/api/v1/payments/payouts?filters%5Bstatus%5D%5B%5D=2&filters%5Bstatus%5D%5B%5D=3&filters%5Bstatus%5D%5B%5D=7&filters%5Bstatus%5D%5B%5D=8&filters%5Bstatus%5D%5B%5D=9&page=${page}`;
    
    let retryCount = 0;
    let delay = BASE_DELAY;
    
    while (true) {
      try {
        const response = await axios.get(transactionsUrl, {
          headers: {
            Cookie: cookieStr
          }
        });
        
        if (response.status === 200) {
          const json = response.data;
          
          let data;
          if (Array.isArray(json.data)) {
            data = json.data;
          } else if (json.response?.payouts?.data && Array.isArray(json.response.payouts.data)) {
            data = json.response.payouts.data;
          } else {
            throw new Error('Неожиданная структура ответа');
          }
          
          return data as Transaction[];
        } else if (response.status === 429) {
          // Слишком много запросов
          if (retryCount >= MAX_RETRIES) {
            throw new Error('Превышено максимальное количество попыток. Последний статус: 429 Too Many Requests');
          }
          
          const retryAfter = parseInt(response.headers['retry-after'] || String(delay));
          console.warn(`Ограничение скорости (429). Ожидание ${retryAfter}мс перед повторной попыткой. Попытка ${retryCount + 1}/${MAX_RETRIES}`);
          
          await new Promise(resolve => setTimeout(resolve, retryAfter));
          
          retryCount++;
          delay *= 2; // Экспоненциальное увеличение задержки
        } else {
          throw new Error(`Не удалось получить транзакции: ${response.status}`);
        }
      } catch (error: any) {
        if (error.response?.status === 429) {
          // Обработка случая, когда axios выбрасывает ошибку вместо возврата ответа
          if (retryCount >= MAX_RETRIES) {
            throw new Error('Превышено максимальное количество попыток. Последний статус: 429 Too Many Requests');
          }
          
          const retryAfter = parseInt(error.response.headers['retry-after'] || String(delay));
          console.warn(`Ограничение скорости (429). Ожидание ${retryAfter}мс перед повторной попыткой. Попытка ${retryCount + 1}/${MAX_RETRIES}`);
          
          await new Promise(resolve => setTimeout(resolve, retryAfter));
          
          retryCount++;
          delay *= 2; // Экспоненциальное увеличение задержки
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Получает все транзакции из IDEX API
   * @param cookies Куки для авторизации
   * @param pages Количество страниц для получения
   * @returns Массив транзакций
   */
  private static async fetchTransactions(cookies: Cookie[], pages: number = DEFAULT_PAGES_TO_FETCH): Promise<Transaction[]> {
    const allTransactions: Transaction[] = [];
    
    for (let page = 1; page <= pages; page++) {
      console.info(`Получение страницы ${page} из ${pages}`);
      
      // Добавляем задержку между запросами страниц для предотвращения ограничения скорости
      if (page > 1) {
        await new Promise(resolve => setTimeout(resolve, BASE_DELAY));
      }
      
      try {
        const transactions = await this.fetchTransactionsPage(cookies, page);
        console.info(`Найдено ${transactions.length} транзакций на странице ${page}`);
        allTransactions.push(...transactions);
      } catch (error) {
        console.warn(`Ошибка получения страницы ${page}: ${error}`);
        // Продолжаем со следующей страницей вместо полного прерывания
      }
    }
    
    return allTransactions;
  }

  /**
   * Сохраняет транзакции в базу данных
   * @param transactions Массив транзакций
   * @param cabinetId ID кабинета
   */
  private static async saveTransactions(transactions: Transaction[], cabinetId: number): Promise<void> {
    // Получаем существующие ID транзакций для этого кабинета
    const existingTransactions = await prisma.IdexTransaction.findMany({
      where: { cabinetId },
      select: { externalId: true }
    });
    
    const existingIds = new Set(existingTransactions.map(t => BigInt(t.externalId.toString())));
    
    // Фильтруем только новые транзакции
    const newTransactions = transactions.filter(t => !existingIds.has(BigInt(t.id)));
    
    if (newTransactions.length === 0) {
      console.info(`Нет новых транзакций для сохранения для кабинета ${cabinetId}`);
      return;
    }
    
    // Сохраняем новые транзакции
    const savedTransactions = await Promise.all(
      newTransactions.map(async transaction => {
        const { id, payment_method_id, wallet, amount, total, status, approved_at, expired_at, created_at, updated_at, ...extraData } = transaction;
        
        return prisma.IdexTransaction.create({
          data: {
            externalId: BigInt(id),
            paymentMethodId: BigInt(payment_method_id),
            wallet,
            amount,
            total,
            status,
            approvedAt: approved_at,
            expiredAt: expired_at,
            createdAtExternal: created_at,
            updatedAtExternal: updated_at,
            extraData: extraData as any,
            cabinetId
          }
        });
      })
    );
    
    console.info(`Сохранено ${savedTransactions.length} новых транзакций для кабинета ${cabinetId} (всего: ${existingTransactions.length + savedTransactions.length})`);
  }

  /**
   * Синхронизирует транзакции для одного кабинета
   * @param cabinet Кабинет IDEX
   * @param pages Количество страниц для получения
   */
  private static async syncCabinetTransactions(cabinet: { id: number, login: string, password: string }, pages: number = DEFAULT_PAGES_TO_FETCH): Promise<void> {
    try {
      console.info(`Обработка кабинета ${cabinet.login}`);
      
      const cookies = await this.login({
        login: cabinet.login,
        password: cabinet.password
      });
      
      console.info(`Успешная авторизация для кабинета ${cabinet.login}`);
      
      // Добавляем задержку перед запросом транзакций
      await new Promise(resolve => setTimeout(resolve, BASE_DELAY));
      
      const transactions = await this.fetchTransactions(cookies, pages);
      await this.saveTransactions(transactions, cabinet.id);
      
      console.info(`Обработаны транзакции для кабинета ${cabinet.login}`);
    } catch (error) {
      console.error(`Ошибка синхронизации кабинета ${cabinet.login}: ${error}`);
    }
  }

  /**
   * Синхронизирует транзакции для всех кабинетов IDEX
   * @param pages Количество страниц для получения
   * @param concurrentRequests Количество одновременных запросов
   */
  static async syncAllCabinetsTransactions(pages: number = DEFAULT_PAGES_TO_FETCH, concurrentRequests: number = 3): Promise<void> {
    // Получаем все кабинеты
    const cabinets = await prisma.IdexCabinet.findMany();
    
    if (cabinets.length === 0) {
      console.info('Нет кабинетов для синхронизации');
      return;
    }
    
    console.info(`Загружено ${cabinets.length} кабинетов`);
    
    // Обрабатываем кабинеты с ограничением параллельных запросов
    const chunks = [];
    for (let i = 0; i < cabinets.length; i += concurrentRequests) {
      chunks.push(cabinets.slice(i, i + concurrentRequests));
    }
    
    for (const chunk of chunks) {
      await Promise.all(chunk.map(cabinet => this.syncCabinetTransactions(cabinet, pages)));
      
      // Добавляем задержку между группами запросов
      if (chunks.indexOf(chunk) < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, BASE_DELAY));
      }
    }
    
    console.info('Все задачи завершены');
  }

  /**
   * Синхронизирует транзакции для конкретного кабинета IDEX
   * @param cabinetId ID кабинета
   * @param pages Количество страниц для получения
   */
  static async syncCabinetTransactionsById(cabinetId: number, pages: number = DEFAULT_PAGES_TO_FETCH): Promise<void> {
    const cabinet = await prisma.IdexCabinet.findUnique({
      where: { id: cabinetId }
    });
    
    if (!cabinet) {
      throw new Error(`Кабинет с ID ${cabinetId} не найден`);
    }
    
    await this.syncCabinetTransactions(cabinet, pages);
  }

  /**
   * Получает транзакции для кабинета с пагинацией и фильтрацией по времени
   * @param cabinetId ID кабинета
   * @param page Номер страницы (начиная с 1)
   * @param perPage Количество записей на странице
   * @param timeFilter Опциональный фильтр по временному промежутку
   * @returns Объект с транзакциями и метаданными пагинации
   */
  static async getCabinetTransactions(
    cabinetId: number, 
    page: number = 1, 
    perPage: number = 10,
    timeFilter?: {
      startDate?: Date | string,
      endDate?: Date | string,
      preset?: 'last12h' | 'last24h' | 'today' | 'yesterday' | 'thisWeek' | 'last2days' | 'thisMonth'
    }
  ): Promise<{
    transactions: any[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
  }> {
    const skip = (page - 1) * perPage;
    
    // Строим условие where с учетом фильтров по времени
    const whereCondition: any = { cabinetId };
    
    // Обрабатываем фильтр времени
    if (timeFilter) {
      const dateFilter: any = {};
      
      // Если передан preset, вычисляем startDate и endDate на основе пресета
      if (timeFilter.preset) {
        const now = new Date();
        let startDate: Date;
        const endDate = new Date();
        
        switch (timeFilter.preset) {
          case 'last12h':
            startDate = new Date(now.getTime() - 12 * 60 * 60 * 1000);
            break;
          case 'last24h':
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case 'today':
            startDate = new Date(now.setHours(0, 0, 0, 0));
            break;
          case 'yesterday':
            startDate = new Date(now.setHours(0, 0, 0, 0));
            startDate.setDate(startDate.getDate() - 1);
            endDate.setHours(0, 0, 0, 0);
            break;
          case 'thisWeek':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - now.getDay());
            startDate.setHours(0, 0, 0, 0);
            break;
          case 'last2days':
            startDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
            break;
          case 'thisMonth':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          default:
            startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // По умолчанию last24h
        }
        
        timeFilter.startDate = startDate;
        timeFilter.endDate = endDate;
      }
      
      // Применяем фильтры по дате, если они заданы
      if (timeFilter.startDate || timeFilter.endDate) {
        // Для фильтрации нам нужно использовать поле approvedAt,
        // которое имеет строковый формат в базе данных
        // Поэтому создаем сложный фильтр

        // Время в формате строки в базе данных
        if (timeFilter.startDate) {
          const startDate = typeof timeFilter.startDate === 'string' 
            ? new Date(timeFilter.startDate) 
            : timeFilter.startDate;
          
          // Формируем строку в формате ISO для сравнения
          const startDateStr = startDate.toISOString();
          whereCondition.approvedAt = {
            ...(whereCondition.approvedAt || {}),
            gte: startDateStr
          };
        }
        
        if (timeFilter.endDate) {
          const endDate = typeof timeFilter.endDate === 'string' 
            ? new Date(timeFilter.endDate) 
            : timeFilter.endDate;
          
          // Формируем строку в формате ISO для сравнения
          const endDateStr = endDate.toISOString();
          whereCondition.approvedAt = {
            ...(whereCondition.approvedAt || {}),
            lte: endDateStr
          };
        }
      }
    }
    
    // Получаем общее количество записей с учетом фильтра
    const totalCount = await prisma.IdexTransaction.count({
      where: whereCondition
    });
    
    // Вычисляем общее количество страниц
    const totalPages = Math.max(1, Math.ceil(totalCount / perPage));
    
    // Получаем записи для текущей страницы с учетом фильтра
    const transactions = await prisma.IdexTransaction.findMany({
      where: whereCondition,
      skip,
      take: perPage,
      orderBy: {
        externalId: 'desc' // Сортировка по ID транзакции по убыванию (новые в начале)
      }
    });
    
    return {
      transactions,
      totalCount,
      totalPages,
      currentPage: page
    };
  }

  /**
   * Получает детальную информацию о кабинете
   * @param cabinetId ID кабинета
   * @returns Информация о кабинете и статистика транзакций
   */
  static async getCabinetDetails(cabinetId: number): Promise<{
    cabinet: any;
    stats: {
      totalTransactions: number;
      lastTransactionDate: string | null;
      lastSyncDate: Date | null;
    }
  }> {
    const cabinet = await prisma.IdexCabinet.findUnique({
      where: { id: cabinetId }
    });
    
    if (!cabinet) {
      throw new Error(`Кабинет с ID ${cabinetId} не найден`);
    }
    
    // Получаем общее количество транзакций
    const totalTransactions = await prisma.IdexTransaction.count({
      where: { cabinetId }
    });
    
    // Получаем последнюю транзакцию
    const lastTransaction = await prisma.IdexTransaction.findFirst({
      where: { cabinetId },
      orderBy: { updatedAtExternal: 'desc' }
    });
    
    return {
      cabinet,
      stats: {
        totalTransactions,
        lastTransactionDate: lastTransaction?.updatedAtExternal || null,
        lastSyncDate: cabinet.updatedAt
      }
    };
  }

  /**
   * Парсит строку даты-времени из формата "DD.MM.YYYY HH:MM" в объект Date
   * @param dateTimeStr Строка в формате "DD.MM.YYYY HH:MM"
   * @returns Объект Date или null в случае ошибки
   */
  static parseCustomDateTime(dateTimeStr: string): Date | null {
    try {
      // Формат входной строки: "DD.MM.YYYY HH:MM"
      const [datePart, timePart] = dateTimeStr.split(' ');
      
      if (!datePart || !timePart) {
        return null;
      }
      
      const [day, month, year] = datePart.split('.');
      const [hours, minutes] = timePart.split(':');
      
      if (!day || !month || !year || !hours || !minutes) {
        return null;
      }
      
      const date = new Date(
        parseInt(year), 
        parseInt(month) - 1, // Месяцы в JS начинаются с 0
        parseInt(day),
        parseInt(hours),
        parseInt(minutes)
      );
      
      // Проверяем, что дата валидна
      if (isNaN(date.getTime())) {
        return null;
      }
      
      return date;
    } catch (error) {
      console.error(`Ошибка парсинга даты-времени: ${error}`);
      return null;
    }
  }
}