import { config } from 'dotenv';
import { createBot } from '@/bot';

// Load environment variables
config();

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('ERROR: BOT_TOKEN is not set in .env file');
  console.log('Please create a .env file with BOT_TOKEN=your_telegram_bot_token');
  process.exit(1);
}

console.log('Starting P2P Transactions Telegram Bot...');

// Create and launch the bot
const bot = createBot(BOT_TOKEN);

// Start the bot
bot.launch()
  .then(() => {
    console.log('Bot is running!');
  })
  .catch((error) => {
    console.error('Failed to start bot:', error);
  });

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));