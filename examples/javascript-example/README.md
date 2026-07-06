# JavaScript (CommonJS) Example

This example demonstrates how to use the ILN SDK with plain JavaScript using CommonJS modules.

## Features

- Initialize the SDK with a keypair signer
- Fetch protocol configuration
- Submit an invoice
- Query invoice details
- Check freelancer reputation

## Setup

```bash
cd examples/javascript-example
npm install
cp .env.example .env
# Edit .env with your credentials
```

## Run

```bash
npm start
```

## What It Does

1. Connects to Stellar testnet via the ILN SDK
2. Fetches current protocol configuration (fees, limits)
3. Submits a new invoice for 10 USDC with 5% discount
4. Queries the invoice details
5. Checks the freelancer's reputation score
