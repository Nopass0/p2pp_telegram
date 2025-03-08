import { prisma } from './prisma';

/**
 * Сервис для работы с администраторами системы
 */
export class AdminService {
  
  /**
   * Проверяет, является ли пользователь администратором
   * @param telegramId ID пользователя в Telegram
   * @returns true, если пользователь является администратором
   */
  static async isAdmin(telegramId: string): Promise<boolean> {
    try {
      // Сначала проверяем, есть ли в .env ADMIN_IDS
      const adminIdsStr = process.env.ADMIN_IDS || '';
      const adminIds = adminIdsStr.split(',').map(id => id.trim());
      
      // Если пользователь в списке ADMIN_IDS, то он администратор
      if (adminIds.includes(telegramId)) {
        return true;
      }
      
      // Если нет, проверяем базу данных
      const admin = await prisma.admin.findUnique({
        where: { telegramId }
      });
      
      return !!admin;
    } catch (error) {
      console.error('Ошибка при проверке администратора:', error);
      return false;
    }
  }
  
  /**
   * Получает список всех администраторов
   * @returns Массив всех администраторов
   */
  static async getAllAdmins() {
    try {
      const admins = await prisma.admin.findMany();
      
      // Добавляем администраторов из переменной окружения
      const adminIdsStr = process.env.ADMIN_IDS || '';
      const envAdminIds = adminIdsStr.split(',').map(id => id.trim()).filter(id => id);
      
      // Добавляем администраторов из .env, которых нет в базе
      const dbAdminIds = admins.map(admin => admin.telegramId);
      const missingEnvAdmins = envAdminIds
        .filter(id => !dbAdminIds.includes(id))
        .map(telegramId => ({ 
          id: 0, // В результате это не важно, т.к. не из базы
          telegramId,
          username: null,
          firstName: 'ENV Admin',
          lastName: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }));
      
      return [...admins, ...missingEnvAdmins];
    } catch (error) {
      console.error('Ошибка при получении списка администраторов:', error);
      return [];
    }
  }
  
  /**
   * Добавляет нового администратора
   * @param telegramId ID пользователя в Telegram
   * @param username Имя пользователя в Telegram
   * @param firstName Имя в Telegram
   * @param lastName Фамилия в Telegram
   * @returns Созданный администратор или null в случае ошибки
   */
  static async addAdmin(
    telegramId: string, 
    username?: string, 
    firstName?: string, 
    lastName?: string
  ) {
    try {
      // Проверяем, существует ли уже такой админ
      const existingAdmin = await prisma.admin.findUnique({
        where: { telegramId }
      });
      
      if (existingAdmin) {
        return existingAdmin;
      }
      
      // Создаём нового администратора
      const admin = await prisma.admin.create({
        data: {
          telegramId,
          username,
          firstName,
          lastName
        }
      });
      
      return admin;
    } catch (error) {
      console.error('Ошибка при добавлении администратора:', error);
      return null;
    }
  }
  
  /**
   * Удаляет администратора
   * @param telegramId ID пользователя в Telegram
   * @returns true, если администратор успешно удален
   */
  static async removeAdmin(telegramId: string): Promise<boolean> {
    try {
      // Проверяем, есть ли администратор в базе
      const admin = await prisma.admin.findUnique({
        where: { telegramId }
      });
      
      if (!admin) {
        return false;
      }
      
      // Удаляем администратора
      await prisma.admin.delete({
        where: { telegramId }
      });
      
      return true;
    } catch (error) {
      console.error('Ошибка при удалении администратора:', error);
      return false;
    }
  }
  
  /**
   * Получает настройки системы
   * @returns Объект с настройками системы
   */
  static async getSystemSettings() {
    try {
      // Получаем первую запись настроек (должна быть только одна)
      const settings = await prisma.systemSettings.findFirst();
      
      // Если настроек нет, создаём дефолтные
      if (!settings) {
        return await prisma.systemSettings.create({
          data: {
            reportReminderInterval: 180, // 3 часа в минутах
            reportWaitTime: 10 // 10 минут ожидания
          }
        });
      }
      
      return settings;
    } catch (error) {
      console.error('Ошибка при получении настроек системы:', error);
      return null;
    }
  }
  
  /**
   * Обновляет настройки системы
   * @param reportReminderInterval Интервал напоминаний в минутах
   * @param reportWaitTime Время ожидания отчета после напоминания в минутах
   * @returns Обновленные настройки системы
   */
  static async updateSystemSettings(
    reportReminderInterval?: number,
    reportWaitTime?: number
  ) {
    try {
      // Получаем текущие настройки
      const currentSettings = await this.getSystemSettings();
      
      if (!currentSettings) {
        return null;
      }
      
      // Подготавливаем объект для обновления
      const updateData: any = {};
      if (reportReminderInterval !== undefined) {
        updateData.reportReminderInterval = reportReminderInterval;
      }
      if (reportWaitTime !== undefined) {
        updateData.reportWaitTime = reportWaitTime;
      }
      
      // Обновляем настройки
      const updatedSettings = await prisma.systemSettings.update({
        where: { id: currentSettings.id },
        data: updateData
      });
      
      return updatedSettings;
    } catch (error) {
      console.error('Ошибка при обновлении настроек системы:', error);
      return null;
    }
  }
}
