# P2P Transactions Telegram Bot

A Telegram bot that processes CSV exports from P2P market transactions and provides analysis of the transaction data.

## Features

- Parses CSV files containing P2P transactions
- Handles forwarded CSV files from wallet bots
- Analyzes transaction data and generates summary statistics
- Supports various CSV formats with flexible column mapping

## Requirements

- [Bun](https://bun.sh/) runtime
- Telegram Bot Token (get one from [@BotFather](https://t.me/BotFather))

## Installation

1. Clone this repository
2. Install dependencies: `bun install`
3. Create a `.env` file based on `.env.example` and add your Telegram Bot Token
4. Run the bot: `bun start`

## Development

- `bun dev` - Run the bot with hot reloading

## Usage

1. Start a chat with your bot on Telegram
2. Send the `/start` command to get started
3. Upload a CSV file containing P2P market transactions
4. The bot will analyze the file and respond with a summary

## CSV Format

The bot supports various CSV formats and attempts to automatically detect column names. The CSV should contain the following information:

- Order ID/Number
- Date/Time
- Transaction Type (Buy/Sell)
- Asset/Coin
- Amount/Quantity
- Price (Unit price)
- Total Price
- Counterparty (optional)
- Status (optional)

## License

MIT
