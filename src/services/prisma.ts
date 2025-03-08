import { PrismaClient } from '@prisma/client';

// Глобальный экземпляр PrismaClient для использования в рамках всего приложения
export const prisma = new PrismaClient();

export async function connectDatabase() {
  try {
    await prisma.$connect();
    console.log('База данных успешно подключена');
    
    // Проверяем и создаем первоначальные настройки системы, если их нет
    const settingsCount = await prisma.systemSettings.count();
    if (settingsCount === 0) {
      await prisma.systemSettings.create({
        data: {
          reportReminderInterval: 180, // 3 часа в минутах
          reportWaitTime: 10 // 10 минут ожидания
        }
      });
      console.log('Созданы начальные настройки системы');
    }
    
    return true;
  } catch (error) {
    console.error('Ошибка подключения к базе данных:', error);
    return false;
  }
}

export async function disconnectDatabase() {
  try {
    await prisma.$disconnect();
    console.log('Соединение с базой данных закрыто');
    return true;
  } catch (error) {
    console.error('Ошибка при закрытии соединения с базой данных:', error);
    return false;
  }
}
