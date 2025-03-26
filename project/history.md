# История изменений проекта

## 2025-03-26
- Добавлена функциональность загрузки отчетов Bybit
- Создана модель данных BybitTransaction в Prisma схеме
- Реализован парсер XLS файлов для Bybit (src/services/bybit-parser.ts)
- Добавлен сервис для работы с транзакциями Bybit (src/services/bybit-transaction-service.ts)
- Обновлен ReportHandler для поддержки двух типов отчетов: Telegram и Bybit
- Добавлена клавиатура для выбора типа отчета
- Модифицирован метод загрузки отчетов в MenuHandler
