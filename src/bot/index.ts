import { Telegraf, session } from 'telegraf';
import { message } from 'telegraf/filters';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parseCSVBuffer } from '@/services/csv-parser';
import { formatTransactionData } from '@/utils/message-formatter';
import { UserService } from '@/services/user-service';
import { AdminService } from '@/services/admin-service';
import { BotContext } from '@/types';
import { KeyboardBuilder } from './components/keyboard';
import { AuthHandler } from './handlers/auth-handler';
import { ReportHandler } from './handlers/report-handler';
import { WorkSessionHandler } from './handlers/work-session-handler';
import { MenuHandler } from './handlers/menu-handler';
import { AdminHandler } from './handlers/admin-handler';
import { MatchHandler } from './handlers/match-handler';

// Create and configure bot
export function createBot(token: string) {
  const bot = new Telegraf<BotContext>(token);
  
  // Use session middleware
  bot.use(session({
    // Настройка сессии для лучшей стабильности
    ttl: 24 * 60 * 60 * 1000, // увеличенное время жизни сессии (24 часа)
    getSessionKey: (ctx) => {
      // Используем Telegram ID пользователя как ключ сессии
      return ctx.from?.id.toString();
    },
  }));
  
  // Initialize handlers
  AuthHandler.init(bot);
  ReportHandler.init(bot);
  WorkSessionHandler.init(bot);
  MenuHandler.init(bot);
  AdminHandler.init(bot);
  MatchHandler.init(bot);

  // Command handlers
  bot.start(async (ctx) => {
    // Проверяем, является ли пользователь администратором
    const isAdmin = await AdminService.isAdmin(ctx.from.id.toString());
    
    // Если пользователь администратор
    if (isAdmin) {
      // Ищем пользователя по Telegram ID
      let user = await UserService.findUserByTelegramId(ctx.from.id.toString());
      
      // Если пользователь не найден, проверяем существование по имени
      if (!user) {
        const name = ctx.from.first_name + (ctx.from.last_name ? ` ${ctx.from.last_name}` : '');
        
        // Проверяем, существуют ли пользователи с телеграм-аккаунтами
        const usersWithTelegramAccounts = await UserService.getUsersWithTelegramAccounts();
        
        // Ищем, есть ли среди них пользователь с телеграм-аккаунтом текущего админа
        let existingUser = null;
        for (const u of usersWithTelegramAccounts) {
          if (u.telegramAccounts.some(account => account.telegramId === ctx.from.id.toString())) {
            existingUser = u;
            break;
          }
        }
        
        // Если нашли пользователя с телеграм-аккаунтом админа
        if (existingUser) {
          user = existingUser;
          console.log(`Найден существующий пользователь с привязанным телеграм-аккаунтом: ${name} (${ctx.from.id})`);
        } else {
          // Если не нашли по телеграм ID, ищем по имени среди всех пользователей
          const existingUsers = await UserService.getAllUsers();
          const adminUser = existingUsers.find(u => u.name === name);
          
          // Используем существующего пользователя или создаём нового
          if (adminUser) {
            user = adminUser;
            // Привязываем телеграм аккаунт к существующему пользователю
            await UserService.addTelegramAccount(
              user.id,
              ctx.from.id.toString(),
              ctx.from.username,
              ctx.from.first_name,
              ctx.from.last_name
            );
            console.log(`Привязан телеграм аккаунт к существующему пользователю: ${name} (${ctx.from.id})`);
          } else {
            // Создаем нового пользователя только если не нашли ни по телеграм ID, ни по имени
            user = await UserService.createUser(name);
            
            if (user) {
              // Привязываем телеграм аккаунт к пользователю
              await UserService.addTelegramAccount(
                user.id,
                ctx.from.id.toString(),
                ctx.from.username,
                ctx.from.first_name,
                ctx.from.last_name
              );
              
              console.log(`Создан новый пользователь-администратор: ${name} (${ctx.from.id})`);
            }
          }
        }
      }
      
      // Устанавливаем сессию
      ctx.session.userId = user?.id;
      ctx.session.isAdmin = true;
      
      // Отправляем приветственное сообщение и меню администратора
      await ctx.reply(
        `Добро пожаловать, ${user?.name || ctx.from.first_name}! 📊\n\n` +
        'Вы вошли как администратор. Выберите действие из меню:',
        KeyboardBuilder.adminMainMenu()
      );
    } else {
      // Для обычных пользователей проверяем, есть ли у них уже аккаунт
      const user = await UserService.findUserByTelegramId(ctx.from.id.toString());
      
      if (user) {
        // Если пользователь уже авторизован, показываем его меню
        ctx.session.userId = user.id;
        ctx.session.isAdmin = false;
        
        await ctx.reply(
          `Добро пожаловать, ${user.name}! 📊\n\n` +
          'Выберите действие из меню:',
          KeyboardBuilder.mainMenu()
        );
      } else {
        // Если пользователя нет, предлагаем ввести код
        await ctx.reply(
          'Добро пожаловать в P2P Transaction Analyzer Bot! 📊\n\n' +
          'Для доступа к функциям бота, пожалуйста, введите ваш код-пароль:',
          KeyboardBuilder.mainMenu()
        );
      }
    }
  });
  
  bot.help((ctx) => {
    ctx.reply(
      'P2P Transaction Analyzer Bot Help 📋\n\n' +
      'Этот бот анализирует CSV файлы, содержащие данные транзакций P2P рынка.\n\n' +
      'Команды:\n' +
      '/start - Запустить бота и получить меню\n' +
      '/help - Показать это сообщение помощи\n\n' +
      'Как использовать:\n' +
      '1. Перешлите CSV файл из бота @wallet\n' +
      '2. Бот автоматически проанализирует данные транзакций\n\n' +
      'Примечание: Будут обработаны только CSV файлы, пересланные из бота @wallet.'
    );
  });
  
  // Handle document/file messages
  bot.on(message('document'), async (ctx) => {
    try {
      // Проверяем авторизацию пользователя
      if (!ctx.session.userId) {
        return ctx.reply(
          'Для доступа к функциям бота, пожалуйста, введите ваш код-пароль.',
          KeyboardBuilder.mainMenu()
        );
      }

      const { document } = ctx.message;
      
      // Log complete message for debugging
      console.log('Complete message object:', JSON.stringify(ctx.message, null, 2));
      
      // Check if the message is a forward from wallet bot
      const forwardFrom = ctx.message.forward_from;
      const forwardOrigin = (ctx.message as any).forward_origin; // Telegram API sometimes uses forward_origin
      
      // Extract forwarded info
      const isForwarded = !!forwardFrom || !!forwardOrigin;
      const forwardedFromUsername = forwardFrom?.username?.toLowerCase();
      const forwardedFromFirstName = forwardFrom?.first_name?.toLowerCase();
      
      // Additional forward_origin check (in newer Telegram API versions)
      const forwardOriginType = forwardOrigin?.type;
      const forwardOriginUser = forwardOrigin?.sender_user;
      const forwardOriginUsername = forwardOriginUser?.username?.toLowerCase();
      const forwardOriginFirstName = forwardOriginUser?.first_name?.toLowerCase();
      
      // Check message caption (often contains transaction history information)
      const messageCaption = ctx.message.caption?.toLowerCase();
      
      console.log('Forward validation info:', {
        isForwarded,
        forwardedFromUsername,
        forwardedFromFirstName,
        forwardOriginType,
        forwardOriginUsername,
        forwardOriginFirstName,
        messageCaption: messageCaption?.substring(0, 50)
      });
      
      // Also check if the message is a reply from a wallet bot (our previous case)
      const replyMessage = ctx.message.reply_to_message;
      const isReply = !!replyMessage;
      const replyFrom = replyMessage?.from;
      const replyForwardFrom = replyMessage?.forward_from;
      
      // Reply validation values
      const replyFromUsername = replyFrom?.username?.toLowerCase();
      const replyFromFirstName = replyFrom?.first_name?.toLowerCase();
      const replyForwardFromUsername = replyForwardFrom?.username?.toLowerCase();
      const replyForwardFromFirstName = replyForwardFrom?.first_name?.toLowerCase();
      const replyText = replyMessage?.text?.toLowerCase();
      
      console.log('Reply validation info:', {
        isReply,
        replyFromUsername,
        replyFromFirstName,
        replyForwardFromUsername,
        replyForwardFromFirstName,
        replyTextPreview: replyText?.substring(0, 50)
      });
      
      // Check if the message appears to be from wallet bot, either as a forward or a reply
      const isFromWalletBot = (
        // Forwarded message checks
        (isForwarded && (
          // Direct username match
          forwardedFromUsername === 'wallet' ||
          forwardOriginUsername === 'wallet' ||
          
          // Name contains wallet
          (forwardedFromFirstName && forwardedFromFirstName.includes('wallet')) ||
          (forwardOriginFirstName && forwardOriginFirstName.includes('wallet')) ||
          
          // Caption contains wallet-related keywords
          (messageCaption && (
            messageCaption.includes('история сделок') ||
            messageCaption.includes('transaction history') ||
            messageCaption.includes('p2p') ||
            messageCaption.includes('csv') ||
            messageCaption.includes('wallet')
          ))
        )) ||
        
        // Reply message checks (from previous implementation)
        (isReply && (
          // Direct username match
          replyFromUsername === 'wallet' ||
          replyForwardFromUsername === 'wallet' ||
          
          // Username contains wallet
          (replyFromUsername && replyFromUsername.includes('wallet')) ||
          (replyForwardFromUsername && replyForwardFromUsername.includes('wallet')) ||
          
          // First name contains wallet
          (replyFromFirstName && replyFromFirstName.includes('wallet')) ||
          (replyForwardFromFirstName && replyForwardFromFirstName.includes('wallet')) ||
          
          // Text contains wallet-related keywords
          (replyText && (
            replyText.includes('история сделок') ||  // Russian: "transaction history"
            replyText.includes('transaction history') ||
            replyText.includes('p2p') ||
            replyText.includes('csv') ||
            replyText.includes('wallet') ||
            replyText.includes('биржа') ||  // Russian: "exchange"
            replyText.includes('exchange')
          ))
        ))
      );
      
      console.log('Is message from @wallet bot?', isFromWalletBot);
      
      // Only continue if the message appears to be from the wallet bot
      if (!isFromWalletBot) {
        return ctx.reply(
          'Извините, я могу обрабатывать только CSV файлы, пересланные из бота @wallet.\n\n' +
          'Пожалуйста, получите ваш CSV файл из бота @wallet и перешлите его мне.',
          ctx.session.isAdmin ? KeyboardBuilder.adminMainMenu() : KeyboardBuilder.mainMenu()
        );
      }
      
      // Make sure it's a CSV file
      if (!document.file_name?.toLowerCase().endsWith('.csv')) {
        return ctx.reply(
          'Пожалуйста, перешлите действительный CSV файл из бота @wallet. Файл должен иметь расширение .csv.',
          ctx.session.isAdmin ? KeyboardBuilder.adminMainMenu() : KeyboardBuilder.mainMenu()
        );
      }
      
      // Notify the user we're processing
      await ctx.reply('📊 Обработка вашего CSV файла...');
      
      // Get file from Telegram servers
      const fileLink = await ctx.telegram.getFileLink(document.file_id);
      console.log('Downloaded file from:', fileLink.toString());
      const response = await fetch(fileLink.toString());
      
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      
      // Save the original CSV to a temporary file for debugging
      try {
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, `p2p_debug_${Date.now()}.csv`);
        fs.writeFileSync(tempFilePath, Buffer.from(buffer));
        console.log(`Saved original CSV to: ${tempFilePath}`);
        
        // Read the first few lines of the CSV for column detection
        const csvPreview = Buffer.from(buffer).toString('utf8').split('\n').slice(0, 3).join('\n');
        console.log('CSV Preview (first 3 lines):', csvPreview);
      } catch (err) {
        console.error('Error saving debug file:', err);
      }
      
      // Parse the CSV data
      console.log('Starting CSV parsing...');
      const parsedData = await parseCSVBuffer(Buffer.from(buffer));
      console.log(`Parsed ${parsedData.transactions.length} transactions`);
      
      if (parsedData.transactions.length > 0) {
        console.log('First transaction:', JSON.stringify(parsedData.transactions[0]));
        console.log('Last transaction:', JSON.stringify(parsedData.transactions[parsedData.transactions.length - 1]));
      }
      
      // Format and send the results
      const message = formatTransactionData(parsedData);
      await ctx.reply(message, { 
        parse_mode: 'Markdown',
        reply_markup: ctx.session.isAdmin ? KeyboardBuilder.adminMainMenu().reply_markup : KeyboardBuilder.mainMenu().reply_markup
      });
    } catch (error) {
      console.error('Error processing file:', error);
      ctx.reply(
        `Ошибка обработки CSV файла: ${(error as Error).message}\n\nПожалуйста, убедитесь, что файл является действительным CSV файлом с правильными заголовками.`,
        ctx.session.isAdmin ? KeyboardBuilder.adminMainMenu() : KeyboardBuilder.mainMenu()
      );
    }
  });
  
  // Handle regular messages
  bot.on('text', async (ctx) => {
    // Если пользователь уже в процессе авторизации, передаем управление дальше
    if (ctx.session.lastAction === 'waiting_auth_code') {
      return;
    }
    
    // Обработка процесса добавления IDEX кабинета
    if (ctx.session.idexCabinetStep === 'waiting_idex_id') {
      await MenuHandler.handleIdexCabinetId(ctx, ctx.message.text);
      return;
    } else if (ctx.session.idexCabinetStep === 'waiting_login') {
      await MenuHandler.handleIdexCabinetLogin(ctx, ctx.message.text);
      return;
    } else if (ctx.session.idexCabinetStep === 'waiting_password') {
      await MenuHandler.handleIdexCabinetPassword(ctx, ctx.message.text);
      return;
    }
    
    // Если пользователь не авторизован и это не команда, просим ввести код
    if (!ctx.session.userId && !ctx.message.text.startsWith('/')) {
      // Проверяем, является ли пользователь администратором
      const isAdmin = await AdminService.isAdmin(ctx.from.id.toString());
      
      if (isAdmin) {
        // Проверяем, существует ли уже пользователь с данным Telegram ID
        let user = await UserService.findUserByTelegramId(ctx.from.id.toString());
        
        if (user) {
          // Если пользователь уже существует, используем его
          ctx.session.userId = user.id;
          ctx.session.isAdmin = true;
          
          await ctx.reply(
            `Добро пожаловать, ${user.name}! Вы вошли как администратор.`,
            KeyboardBuilder.adminMainMenu()
          );
        } else {
          // Проверяем, есть ли пользователь с таким именем
          const name = ctx.from.first_name + (ctx.from.last_name ? ` ${ctx.from.last_name}` : '');
          const existingUsers = await UserService.getAllUsers();
          const adminUser = existingUsers.find(u => u.name === name);
          
          if (adminUser) {
            // Привязываем телеграм аккаунт к существующему пользователю
            await UserService.addTelegramAccount(
              adminUser.id,
              ctx.from.id.toString(),
              ctx.from.username,
              ctx.from.first_name,
              ctx.from.last_name
            );
            
            ctx.session.userId = adminUser.id;
            ctx.session.isAdmin = true;
            
            await ctx.reply(
              `Добро пожаловать, ${adminUser.name}! Вы вошли как администратор.`,
              KeyboardBuilder.adminMainMenu()
            );
          } else {
            // Создаем нового пользователя и привязываем телеграм аккаунт
            const newUser = await UserService.createUser(name);
            
            if (newUser) {
              await UserService.addTelegramAccount(
                newUser.id,
                ctx.from.id.toString(),
                ctx.from.username,
                ctx.from.first_name,
                ctx.from.last_name
              );
              
              ctx.session.userId = newUser.id;
              ctx.session.isAdmin = true;
              
              await ctx.reply(
                `Добро пожаловать, ${newUser.name}! Вы были автоматически авторизованы как администратор.`,
                KeyboardBuilder.adminMainMenu()
              );
            }
          }
        }
      } else {
        // Для обычных пользователей запускаем процесс авторизации
        await AuthHandler.startAuthProcess(ctx);
      }
      return;
    }
    
    // Log text messages for debugging
    console.log('Text message received:', ctx.message.text);
    console.log('From:', ctx.message.from);
    
    // Если сообщение не обработано, передаем его дальше
    return;
  });
  
  return bot;
}
