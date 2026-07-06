# React Example

This example demonstrates using the ILN SDK in a React application with Freighter wallet integration.

## Features

- Connect to Freighter browser wallet
- Submit invoices via a form UI
- View submitted invoices in a table
- Display protocol configuration
- Error handling with user-friendly messages

## Prerequisites

- [Freighter](https://www.freighter.app/) browser extension installed
- A Stellar testnet account with XLM for fees

## Setup

```bash
cd examples/react-example
npm install
```

## Run

```bash
npm start
```

Opens [http://localhost:3000](http://localhost:3000) in your browser.

## How It Works

1. The app initializes the ILN SDK with a Freighter signer
2. Connects to Freighter when you submit an invoice
3. Fetches protocol configuration on load
4. Submits invoices through the form
5. Displays submitted invoices in a table with status badges

## Wallet Integration

This example uses `createFreighterSigner()` which:

- Detects the Freighter browser extension
- Prompts the user to select an account
- Signs transactions through the extension
- No secret keys exposed to the application

## Component Structure

- `App` — Main container with state management
- `InvoiceForm` — Form for submitting new invoices
- `InvoiceList` — Table displaying submitted invoices
