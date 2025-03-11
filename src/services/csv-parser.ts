import type { P2PTransaction, ParsedCSV } from '@/types';
import csvParser from 'csv-parser';
import { createReadStream } from 'fs';

/**
 * Parse CSV data from a file
 */
export async function parseCSVFile(filePath: string): Promise<ParsedCSV> {
  const transactions: P2PTransaction[] = [];
  
  return new Promise((resolve, reject) => {
    createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => {
        // Process each row
        console.log('Raw CSV row:', data);
        const transaction = normalizeTransaction(data);
        transactions.push(transaction);
      })
      .on('end', () => {
        // Calculate summary statistics
        const summary = generateSummary(transactions);
        resolve({
          transactions,
          summary
        });
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

/**
 * Parse CSV data from a buffer (for Telegram file downloads)
 */
export async function parseCSVBuffer(buffer: Buffer): Promise<ParsedCSV> {
  const transactions: P2PTransaction[] = [];
  
  return new Promise((resolve, reject) => {
    const { Readable } = require('stream');
    
    // First, check if we're dealing with a Binance P2P CSV by looking at the first line
    const csvText = buffer.toString('utf8');
    const firstLine = csvText.split('\n')[0];
    
    // Detect if it's a Binance P2P CSV format
    const isBinanceP2P = firstLine.includes('Order Number') || 
                          firstLine.includes('Date') || 
                          firstLine.includes('Type') ||
                          firstLine.includes('Asset');
    
    // Detect if it's the P2P CSV format from the example
    const isP2PExampleFormat = firstLine.includes('Ad Number') && 
                              firstLine.includes('Ad Type') && 
                              firstLine.includes('Order Number') &&
                              firstLine.includes('Role') &&
                              firstLine.includes('Crypto Amount');
    
    console.log('CSV first line:', firstLine);
    console.log('Detected as Binance P2P format:', isBinanceP2P);
    console.log('Detected as P2P Example format:', isP2PExampleFormat);
    
    // Create a readable stream from the buffer
    const bufferStream = new Readable();
    bufferStream.push(buffer);
    bufferStream.push(null);
    
    bufferStream
      .pipe(csvParser())
      .on('data', (data) => {
        // Process each row and log the original data for debugging
        console.log('Raw CSV row:', data);
        
        let transaction;
        if (isP2PExampleFormat) {
          transaction = processP2PExampleFormat(data);
        } else if (isBinanceP2P) {
          transaction = processBinanceP2PFormat(data);
        } else {
          transaction = normalizeTransaction(data);
        }
        
        transactions.push(transaction);
      })
      .on('end', () => {
        // Calculate summary statistics
        const summary = generateSummary(transactions);
        resolve({
          transactions,
          summary
        });
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

/**
 * Process Binance P2P CSV format specifically
 */
function processBinanceP2PFormat(data: Record<string, any>): P2PTransaction {
  console.log('Processing as Binance P2P format:', data);
  
  // Binance P2P specific column mappings
  // Common column names in Binance P2P exports:
  // "Order Number", "Date", "Type", "Asset", "Amount", "Price", "Counterparty", "Status"
  
  let orderNo = '';
  let dateTime = '';
  let type = '';
  let asset = '';
  let amount = 0;
  let unitPrice = 0;
  let totalPrice = 0;
  let counterparty = '';
  let status = '';
  
  // Iterate through all fields to find the right ones
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    
    if (lowerKey.includes('order') && lowerKey.includes('number')) {
      orderNo = String(value);
    }
    else if (lowerKey.includes('date') || lowerKey.includes('time')) {
      dateTime = String(value);
    }
    else if (lowerKey === 'type' || lowerKey.includes('side')) {
      type = String(value);
    }
    else if (lowerKey === 'asset' || lowerKey.includes('coin')) {
      asset = String(value);
    }
    else if (lowerKey === 'amount' || lowerKey.includes('quantity')) {
      amount = parseFloat(String(value));
    }
    else if (lowerKey === 'price' || lowerKey.includes('unit')) {
      unitPrice = parseFloat(String(value));
    }
    else if (lowerKey.includes('total') || lowerKey.includes('sum')) {
      totalPrice = parseFloat(String(value));
    }
    else if (lowerKey.includes('counterparty') || lowerKey.includes('trader')) {
      counterparty = String(value);
    }
    else if (lowerKey === 'status' || lowerKey.includes('state')) {
      status = String(value);
    }
  }
  
  // If we have amount and unit price but no total price, calculate it
  if (totalPrice === 0 && amount !== 0 && unitPrice !== 0) {
    totalPrice = amount * unitPrice;
  }
  
  // Create transaction object
  const transaction: P2PTransaction = {
    id: orderNo,
    orderNo,
    dateTime,
    type,
    asset: asset || 'USDT',
    amount,
    unitPrice,
    totalPrice,
    counterparty,
    status
  };
  
  console.log('Processed Binance transaction:', transaction);
  return transaction;
}

/**
 * Process the specific P2P CSV format from the example
 */
function processP2PExampleFormat(data: Record<string, any>): P2PTransaction {
  console.log('Processing as P2P Example format:', data);
  
  // Key fields from the example CSV format
  // "Ad Number","Ad Type","Order Number","Role","Crypto Amount","Crypto Currency","Fiat Amount","Fiat Currency","Price","Payment Method","Creation Time","Completion Time"
  
  // Create transaction object with explicit mapping
  const transaction: P2PTransaction = {
    id: String(data['Ad Number'] || ''),
    orderNo: String(data['Order Number'] || ''),
    dateTime: String(data['Completion Time'] || data['Creation Time'] || ''),
    type: String(data['Ad Type'] || ''),
    asset: String(data['Crypto Currency'] || 'USDT'),
    amount: parseFloat(String(data['Crypto Amount'] || 0)),
    totalPrice: parseFloat(String(data['Fiat Amount'] || 0)),
    unitPrice: parseFloat(String(data['Price'] || 0)),
    counterparty: String(data['Role'] || ''),
    status: 'Completed', // Assuming all transactions in the file are completed
    paymentMethod: String(data['Payment Method'] || '')
  };
  
  // Add creation time as a separate field if it exists
  if (data['Creation Time']) {
    transaction['creationTime'] = String(data['Creation Time']);
  }
  
  // Add fiat currency if it exists
  if (data['Fiat Currency']) {
    transaction['fiatCurrency'] = String(data['Fiat Currency']);
  }
  
  console.log('Processed P2P Example transaction:', transaction);
  return transaction;
}

/**
 * Normalize a transaction row from CSV
 */
function normalizeTransaction(data: Record<string, any>): P2PTransaction {
  // Debug original data
  console.log('Original CSV row data:', JSON.stringify(data));
  
  // Clean and normalize the data
  const cleanedData: Record<string, string | number> = {};
  
  // Normalize keys (remove spaces, lowercase)
  Object.keys(data).forEach(key => {
    const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, '');
    cleanedData[normalizedKey] = data[key];
  });
  
  // Check if this is the P2P CSV format seen in the example
  const isP2PFormat = 'adnumber' in cleanedData && 'ordernumber' in cleanedData;
  
  if (isP2PFormat) {
    console.log('Detected P2P format CSV row');
    // Map the P2P specific fields based on the example format
    const transaction: P2PTransaction = {
      id: String(cleanedData.adnumber || ''),
      orderNo: String(cleanedData.ordernumber || ''),
      dateTime: String(cleanedData.completiontime || cleanedData.creationtime || ''),
      type: String(cleanedData.adtype || ''),
      asset: String(cleanedData.cryptocurrency || 'USDT'),
      amount: parseFloat(String(cleanedData.cryptoamount || 0)),
      totalPrice: parseFloat(String(cleanedData.fiatamount || 0)),
      unitPrice: parseFloat(String(cleanedData.price || 0)),
      counterparty: String(cleanedData.role || ''),
      status: 'Completed', // Assuming all transactions in the file are completed
    };
    
    // Add any additional fields from original data
    Object.keys(cleanedData).forEach(key => {
      if (!(key in transaction)) {
        transaction[key] = cleanedData[key];
      }
    });
    
    console.log('Processed P2P transaction:', transaction);
    return transaction;
  }
  
  // Debug normalized keys
  console.log('Normalized keys:', Object.keys(cleanedData));
  
  // Try to find the date/time field - searching for common column names
  let dateTime = '';
  const possibleDateKeys = [
    'datetime', 'date', 'time', 'createtime', 'ordertime', 'createdat', 
    'timestamp', 'transactiondate', 'transactiontime', 'transactiondatetime',
    'created', 'completed', 'ordered', 'ordercreatedat', 'ordercreatetime',
    'completiontime', 'creationtime' // Adding these based on the example
  ];
  
  for (const key of Object.keys(cleanedData)) {
    if (possibleDateKeys.includes(key) || 
        possibleDateKeys.some(dateKey => key.includes(dateKey)) ||
        key.includes('date') || 
        key.includes('time')) {
      if (cleanedData[key] && String(cleanedData[key]).trim() !== '') {
        dateTime = String(cleanedData[key]);
        console.log(`Found date/time in field '${key}': ${dateTime}`);
        break;
      }
    }
  }
  
  // Map to our transaction interface
  const transaction: P2PTransaction = {
    id: String(cleanedData.orderid || cleanedData.id || cleanedData.ordernum || cleanedData.adnumber || ''),
    orderNo: String(cleanedData.orderno || cleanedData.ordernumber || cleanedData.ordernum || cleanedData.no || ''),
    dateTime: dateTime,
    type: String(cleanedData.type || cleanedData.ordertype || cleanedData.side || cleanedData.direction || cleanedData.tradetype || cleanedData.adtype || ''),
    asset: String(cleanedData.asset || cleanedData.coin || cleanedData.cryptocurrency || cleanedData.currency || cleanedData.token || 'USDT'),
    amount: parseFloat(String(cleanedData.amount || cleanedData.quantity || cleanedData.volume || cleanedData.qty || cleanedData.cryptoamount || 0)),
    totalPrice: parseFloat(String(cleanedData.totalprice || cleanedData.total || cleanedData.money || cleanedData.fiat || cleanedData.sum || cleanedData.fiatamount || 0)),
    unitPrice: parseFloat(String(cleanedData.unitprice || cleanedData.price || cleanedData.rate || cleanedData.exchangerate || 0)),
    counterparty: String(cleanedData.counterparty || cleanedData.counterpartyname || cleanedData.trader || cleanedData.opponent || cleanedData.username || cleanedData.role || ''),
    status: String(cleanedData.status || cleanedData.state || cleanedData.orderstatus || 'Completed'),
  };
  
  // If date is not found, check if there's any key that might contain a date-like string
  if (!transaction.dateTime) {
    for (const [key, value] of Object.entries(cleanedData)) {
      const strValue = String(value);
      // Check if the value looks like a date (contains numbers and separators like /, -, or :)
      if (/\d[\/-: \.]\d/.test(strValue)) {
        transaction.dateTime = strValue;
        console.log(`Found potential date/time in field '${key}': ${strValue}`);
        break;
      }
    }
  }
  
  // Add any additional fields from original data
  Object.keys(cleanedData).forEach(key => {
    if (!(key in transaction)) {
      transaction[key] = cleanedData[key];
    }
  });
  
  console.log('Processed transaction:', transaction);
  return transaction;
}

/**
 * Generate summary statistics from transactions
 */
function generateSummary(transactions: P2PTransaction[]) {
  const totalTransactions = transactions.length;
  const totalAmount: Record<string, number> = {};
  const totalValue: Record<string, number> = {};
  
  // Calculate totals by asset
  transactions.forEach(tx => {
    const asset = tx.asset;
    
    if (!totalAmount[asset]) {
      totalAmount[asset] = 0;
      totalValue[asset] = 0;
    }
    
    // Add or subtract based on type (buy/sell)
    const multiplier = tx.type.toLowerCase().includes('buy') ? 1 : -1;
    totalAmount[asset] += tx.amount * multiplier;
    totalValue[asset] += tx.totalPrice * multiplier;
  });
  
  // Calculate average prices
  const averagePrice: Record<string, number> = {};
  Object.keys(totalAmount).forEach(asset => {
    if (totalAmount[asset] !== 0) {
      averagePrice[asset] = Math.abs(totalValue[asset]) / Math.abs(totalAmount[asset]);
    } else {
      averagePrice[asset] = 0;
    }
  });
  
  return {
    totalTransactions,
    totalAmount,
    totalValue,
    averagePrice
  };
}
