import { prisma } from './prisma';
import { WorkSession } from '@/types';

/**
 * Сервис для работы с сессиями работы пользователей
 */
export class WorkSessionService {
  
  /**
   * Начинает новую рабочую сессию для пользователя
   * @param userId ID виртуального пользователя
   * @param cabinetIds Массив ID кабинетов IDEX для связи с сессией
   * @returns Созданная сессия или null в случае ошибки
   */
  static async startWorkSession(userId: number, cabinetIds?: number[]): Promise<WorkSession | null> {
    try {
      // Проверяем, есть ли уже активная сессия
      const activeSession = await this.getActiveSession(userId);
      
      // Если есть активная сессия, возвращаем её
      if (activeSession) {
        return activeSession;
      }
      
      // Создаём новую сессию
      const session = await prisma.workSession.create({
        data: {
          userId,
          startTime: new Date()
        },
        include: {
          idexCabinets: true
        }
      });
      
      // Если переданы ID кабинетов, связываем их с сессией
      if (cabinetIds && cabinetIds.length > 0) {
        // Обновляем каждый кабинет, устанавливая ссылку на созданную сессию
        await Promise.all(cabinetIds.map(cabinetId => 
          prisma.idexCabinet.update({
            where: { id: cabinetId },
            data: { workSessionId: session.id }
          })
        ));
        
        // Получаем обновленную сессию со связанными кабинетами
        const updatedSession = await prisma.workSession.findUnique({
          where: { id: session.id },
          include: { idexCabinets: true }
        });
        
        return updatedSession || session;
      }
      
      return session;
    } catch (error) {
      console.error('Ошибка при создании рабочей сессии:', error);
      return null;
    }
  }
  
  /**
   * Завершает активную рабочую сессию для пользователя
   * @param userId ID виртуального пользователя
   * @returns Завершенная сессия или null если активной сессии нет или возникла ошибка
   */
  static async endWorkSession(userId: number): Promise<WorkSession | null> {
    try {
      // Получаем активную сессию
      const activeSession = await this.getActiveSession(userId);
      
      // Если активной сессии нет, возвращаем null
      if (!activeSession) {
        return null;
      }
      
      // Устанавливаем время окончания сессии
      const endTime = new Date();
      
      // Вычисляем продолжительность в минутах
      const startTime = new Date(activeSession.startTime);
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationMinutes = Math.floor(durationMs / (1000 * 60));
      

      
      // Обновляем сессию
      const updatedSession = await prisma.workSession.update({
        where: { id: activeSession.id },
        data: {
          endTime,
          duration: durationMinutes
        },
        include: {
          idexCabinets: true
        }
      });
      
      return updatedSession;
    } catch (error) {
      console.error('Ошибка при завершении рабочей сессии:', error);
      return null;
    }
  }
  
  /**
   * Получает активную рабочую сессию пользователя
   * @param userId ID виртуального пользователя
   * @returns Активная сессия или null если активной сессии нет
   */
  static async getActiveSession(userId: number): Promise<WorkSession | null> {
    try {
      // Ищем сессию без времени окончания
      const session = await prisma.workSession.findFirst({
        where: {
          userId,
          endTime: null
        },
        include: {
          idexCabinets: true
        }
      });
      
      return session;
    } catch (error) {
      console.error('Ошибка при получении активной рабочей сессии:', error);
      return null;
    }
  }
  
  /**
   * Получает все рабочие сессии пользователя
   * @param userId ID виртуального пользователя
   * @returns Массив всех сессий пользователя
   */
  static async getUserWorkSessions(userId: number): Promise<WorkSession[]> {
    try {
      const sessions = await prisma.workSession.findMany({
        where: { userId },
        orderBy: { startTime: 'desc' },
        include: {
          idexCabinets: true
        }
      });
      
      return sessions;
    } catch (error) {
      console.error('Ошибка при получении рабочих сессий:', error);
      return [];
    }
  }
  
  /**
   * Получает последнюю завершенную рабочую сессию пользователя
   * @param userId ID виртуального пользователя
   * @returns Последняя завершенная сессия или null если нет завершенных сессий
   */
  static async getLastCompletedSession(userId: number): Promise<WorkSession | null> {
    try {
      const session = await prisma.workSession.findFirst({
        where: {
          userId,
          endTime: { not: null }
        },
        orderBy: { endTime: 'desc' },
        include: {
          idexCabinets: true
        }
      });
      
      return session;
    } catch (error) {
      console.error('Ошибка при получении последней завершенной сессии:', error);
      return null;
    }
  }
  
  /**
   * Получает статистику рабочих сессий за период
   * @param userId ID виртуального пользователя
   * @param startDate Начальная дата периода
   * @param endDate Конечная дата периода
   * @returns Объект со статистикой или null в случае ошибки
   */
  static async getWorkSessionStats(
    userId: number,
    startDate: Date,
    endDate: Date
  ): Promise<{ totalSessions: number, totalDuration: number, averageDuration: number } | null> {
    try {
      // Находим все сессии в указанном промежутке
      const sessions = await prisma.workSession.findMany({
        where: {
          userId,
          startTime: { gte: startDate },
          endTime: { lte: endDate, not: null }
        },
        include: {
          idexCabinets: true
        }
      });
      
      // Если сессий нет, возвращаем нулевую статистику
      if (sessions.length === 0) {
        return { totalSessions: 0, totalDuration: 0, averageDuration: 0 };
      }
      
      // Считаем общую продолжительность
      const totalDuration = sessions.reduce((sum, session) => 
        sum + (session.duration || 0), 0);
      
      // Средняя продолжительность
      const averageDuration = totalDuration / sessions.length;
      
      return {
        totalSessions: sessions.length,
        totalDuration,
        averageDuration
      };
    } catch (error) {
      console.error('Ошибка при получении статистики рабочих сессий:', error);
      return null;
    }
  }

  /**
   * Автоматически завершает все рабочие сессии, активные более 24 часов
   * @returns Количество автоматически завершенных сессий
   */
  static async autoCloseInactiveSessions(): Promise<number> {
    try {
      // Получаем дату 24 часа назад
      const twentyFourHoursAgo = new Date();
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
      
      // Находим все сессии, которые начались более 24 часов назад и не имеют времени окончания
      const inactiveSessions = await prisma.workSession.findMany({
        where: {
          startTime: { lt: twentyFourHoursAgo },
          endTime: null
        },
        include: {
          idexCabinets: true
        }
      });
      
      if (inactiveSessions.length === 0) {
        return 0;
      }
      
      // Получаем текущее время для установки в качестве времени окончания
      const endTime = new Date();
      
      // Для каждой сессии вычисляем продолжительность и обновляем запись в БД
      let closedCount = 0;
      
      for (const session of inactiveSessions) {
        const startTime = new Date(session.startTime);
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationMinutes = Math.floor(durationMs / (1000 * 60));
        

        
        await prisma.workSession.update({
          where: { id: session.id },
          data: {
            endTime,
            duration: durationMinutes,
            autoCompleted: true // Дополнительное поле, требуется добавить в схему Prisma
          }
        });
        
        closedCount++;
      }
      
      return closedCount;
    } catch (error) {
      console.error('Ошибка при автозавершении неактивных сессий:', error);
      return 0;
    }
  }

  /**
   * Получает детальную информацию об активной сессии пользователя
   * @param userId ID виртуального пользователя
   * @returns Объект с детальной информацией о сессии или null если активной сессии нет
   */
  static async getActiveSessionDetails(userId: number): Promise<{
    session: WorkSession,
    currentDuration: number,
    formattedStartTime: string,
    formattedCurrentTime: string,
    durationHours: number,
    durationMinutes: number
  } | null> {
    try {
      // Получаем активную сессию
      const activeSession = await this.getActiveSession(userId);
      
      if (!activeSession) {
        return null;
      }
      
      // Получаем текущее время
      const currentTime = new Date();
      
      // Получаем время начала сессии
      const startTime = new Date(activeSession.startTime);
      
      // Вычисляем текущую продолжительность в минутах
      const durationMs = currentTime.getTime() - startTime.getTime();
      const currentDurationMinutes = Math.floor(durationMs / (1000 * 60));
      
      // Форматируем время начала и текущее время
      const formattedStartTime = this.formatDateTime(startTime);
      const formattedCurrentTime = this.formatDateTime(currentTime);
      
      // Вычисляем продолжительность в часах и минутах
      const durationHours = Math.floor(currentDurationMinutes / 60);
      const durationMinutes = currentDurationMinutes % 60;
      
      return {
        session: activeSession,
        currentDuration: currentDurationMinutes,
        formattedStartTime,
        formattedCurrentTime,
        durationHours,
        durationMinutes
      };
    } catch (error) {
      console.error('Ошибка при получении детальной информации о сессии:', error);
      return null;
    }
  }

  /**
   * Редактирует существующую рабочую сессию (для администраторов)
   * @param sessionId ID сессии
   * @param startTime Новое время начала сессии (опционально)
   * @param endTime Новое время окончания сессии (опционально)
   * @returns Обновленная сессия или null в случае ошибки
   */
  static async editWorkSession(
    sessionId: number,
    startTime?: Date,
    endTime?: Date | null
  ): Promise<WorkSession | null> {
    try {
      const session = await prisma.workSession.findUnique({
        where: { id: sessionId },
        include: {
          idexCabinets: true
        }
      });
      
      if (!session) {
        return null;
      }
      
      // Подготавливаем данные для обновления
      const updateData: any = {};
      
      if (startTime) {
        updateData.startTime = startTime;
      }
      
      if (endTime !== undefined) {
        updateData.endTime = endTime;
      }
      
      // Если у нас есть и начальное, и конечное время, пересчитываем продолжительность
      if (startTime && endTime) {
        const durationMs = endTime.getTime() - startTime.getTime();
        const durationMinutes = Math.floor(durationMs / (1000 * 60));
        updateData.duration = durationMinutes > 0 ? durationMinutes : 0;
      } else if (startTime && session.endTime) {
        // Если изменилось только начальное время, но есть конечное время
        const endTimeDate = new Date(session.endTime);
        const durationMs = endTimeDate.getTime() - startTime.getTime();
        const durationMinutes = Math.floor(durationMs / (1000 * 60));
        updateData.duration = durationMinutes > 0 ? durationMinutes : 0;
      } else if (endTime && !startTime) {
        // Если изменилось только конечное время
        const startTimeDate = new Date(session.startTime);
        const durationMs = endTime.getTime() - startTimeDate.getTime();
        const durationMinutes = Math.floor(durationMs / (1000 * 60));
        updateData.duration = durationMinutes > 0 ? durationMinutes : 0;
      }
      
      // Если сессия завершается, но не указана продолжительность
      if (endTime && !updateData.duration) {
        const startTimeDate = new Date(session.startTime);
        const durationMs = endTime.getTime() - startTimeDate.getTime();
        const durationMinutes = Math.floor(durationMs / (1000 * 60));
        updateData.duration = durationMinutes > 0 ? durationMinutes : 0;
      }
      
      // Если мы удаляем время окончания, сбрасываем продолжительность
      if (endTime === null) {
        updateData.duration = null;
      }
      
      // Обновляем запись в БД
      const updatedSession = await prisma.workSession.update({
        where: { id: sessionId },
        data: updateData,
        include: {
          idexCabinets: true
        }
      });
      
      return updatedSession;
    } catch (error) {
      console.error('Ошибка при редактировании рабочей сессии:', error);
      return null;
    }
  }

  /**
   * Форматирует дату и время в читаемый вид
   * @param date Дата для форматирования
   * @returns Отформатированная строка даты и времени
   */
  private static formatDateTime(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  }
}