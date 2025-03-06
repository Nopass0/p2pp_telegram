import type { P2PTransaction, ParsedCSV } from '@/types';

/**
 * Format transaction data into a human-readable message
 */
export function formatTransactionData(data: ParsedCSV): string {
  const { transactions, summary } = data;
  
  if (transactions.length === 0) {
    return 'No transactions found in the CSV file.';
  }
  
  // Format summary section
  let message = '📊 *P2P Transaction Summary*\n\n';
  message += `Total Transactions: ${summary.totalTransactions}\n\n`;
  
  // Assets summary
  message += '*Assets Summary*:\n';
  Object.keys(summary.totalAmount).forEach(asset => {
    const netAmount = summary.totalAmount[asset].toFixed(8);
    const averagePrice = summary.averagePrice[asset].toFixed(2);
    
    message += `${asset}: ${netAmount} (Avg Price: ${averagePrice})\n`;
  });
  
  message += '\n*Recent Transactions*:\n';
  
  // Show the 5 most recent transactions
  const recentTransactions = transactions.slice(-5).reverse();
  recentTransactions.forEach((tx, index) => {
    message += formatSingleTransaction(tx, index + 1);
  });
  
  message += '\n_Full analysis of all transactions is included above._';
  
  return message;
}

/**
 * Format a single transaction into a readable string
 */
function formatSingleTransaction(tx: P2PTransaction, index: number): string {
  const type = tx.type.toLowerCase().includes('buy') ? '🟢 Buy' : '🔴 Sell';
  
  // Attempt to extract a meaningful date from the dateTime field
  let formattedDate = 'Unknown date';
  
  if (tx.dateTime) {
    try {
      // First, clean up the date string to handle various formats
      let dateStr = tx.dateTime.trim();
      
      // Check if it's a timestamp
      if (/^\d{10,13}$/.test(dateStr)) {
        // Convert unix timestamp to date
        const timestamp = parseInt(dateStr);
        // If it's in milliseconds (13 digits) use as is, if in seconds (10 digits) multiply by 1000
        const date = new Date(dateStr.length >= 13 ? timestamp : timestamp * 1000);
        formattedDate = date.toISOString().split('T')[0];
      } 
      // Check if it's a ISO format or similar
      else if (dateStr.includes('T') || dateStr.includes('-') || dateStr.includes('/')) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          formattedDate = date.toISOString().split('T')[0];
        } else {
          // Try to extract date portion if parsing failed
          const datePart = dateStr.split(/[ T]/)[0];
          if (datePart && datePart.length >= 8) {
            formattedDate = datePart;
          }
        }
      } 
      // For other formats, use the date string as is but limit to first part
      else {
        formattedDate = dateStr.split(' ')[0] || dateStr.substring(0, 10);
      }
    } catch (error) {
      console.error('Error parsing date:', error, 'Original value:', tx.dateTime);
      // Fall back to using the original value if parsing fails
      formattedDate = tx.dateTime.substring(0, 10);
    }
  }
  
  return `\n${index}. ${type} ${tx.asset}\n` +
    `   Amount: ${tx.amount} | Price: ${tx.unitPrice}\n` +
    `   Total: ${tx.totalPrice} | Date: ${formattedDate}\n`;
}
