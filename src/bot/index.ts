import { Telegraf, session } from 'telegraf';
import { message } from 'telegraf/filters';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parseCSVBuffer } from '@/services/csv-parser';
import { formatTransactionData } from '@/utils/message-formatter';

// Define context type for the bot
interface BotContext extends Telegraf.Context {
  session: {
    fileRequested?: boolean;
  };
}

// Create and configure bot
export function createBot(token: string) {
  const bot = new Telegraf<BotContext>(token);
  
  // Use session middleware
  bot.use(session());
  
  // Command handlers
  bot.start((ctx) => {
    ctx.reply(
      'Welcome to P2P Transaction Analyzer Bot! 📊\n\n' +
      'I can analyze your P2P transaction history from CSV exports.\n\n' +
      'To get started, forward me a CSV file from the @wallet bot.\n\n' +
      '/help - Show help information'
    );
  });
  
  bot.help((ctx) => {
    ctx.reply(
      'P2P Transaction Analyzer Bot Help 📋\n\n' +
      'This bot analyzes CSV files containing P2P market transaction data.\n\n' +
      'Commands:\n' +
      '/start - Start the bot and get a welcome message\n' +
      '/help - Show this help message\n\n' +
      'How to use:\n' +
      '1. Forward a CSV file from the @wallet bot\n' +
      '2. The bot will automatically analyze the transaction data\n\n' +
      'Note: Only CSV files forwarded from the @wallet bot will be processed.'
    );
  });
  
  // Handle document/file messages
  bot.on(message('document'), async (ctx) => {
    try {
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
          'Sorry, I can only process CSV files that are forwarded from the @wallet bot.\n\n' +
          'Please get your CSV file from the @wallet bot and forward it to me.'
        );
      }
      
      // Make sure it's a CSV file
      if (!document.file_name?.toLowerCase().endsWith('.csv')) {
        return ctx.reply('Please forward a valid CSV file from the @wallet bot. The file must have a .csv extension.');
      }
      
      // Notify the user we're processing
      await ctx.reply('📊 Processing your CSV file...');
      
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
      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error processing file:', error);
      ctx.reply(`Error processing the CSV file: ${(error as Error).message}\n\nPlease make sure the file is a valid CSV file with proper headers.`);
    }
  });
  
  // Handle regular messages
  bot.on(message('text'), (ctx) => {
    // Log text messages for debugging
    console.log('Text message received:', ctx.message.text);
    console.log('From:', ctx.message.from);
    
    ctx.reply(
      'To analyze your P2P transactions, please forward a CSV file from the @wallet bot.'
    );
  });
  
  return bot;
}
