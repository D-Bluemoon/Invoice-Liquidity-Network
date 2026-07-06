import {
  InvoiceClient,
  exportTransactionsToCsv,
  TransactionRecord,
} from './InvoiceClient';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeOp(overrides: Partial<Record<string, any>> = {}): any {
  return {
    id: 'op-1',
    created_at: '2024-06-01T12:00:00Z',
    type: 'payment',
    source_account: 'GABC',
    from: 'GABC',
    to: 'GXYZ',
    asset_type: 'credit_alphanum4',
    asset_code: 'USDC',
    amount: '100.0000000',
    transaction_hash: 'hash-abc',
    paging_token: 'token-1',
    ...overrides,
  };
}

function mockServer(records: any[]) {
  const callFn = jest.fn().mockResolvedValue({ records });
  const queryChain = {
    forAccount: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    cursor: jest.fn().mockReturnThis(),
    call: callFn,
  };
  return { queryChain, callFn };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InvoiceClient.getTransactionHistory', () => {
  let client: InvoiceClient;

  beforeEach(() => {
    client = new InvoiceClient('https://horizon-testnet.stellar.org', 'CONTRACT_ID');
  });

  it('returns normalised records from Horizon', async () => {
    const { queryChain } = mockServer([makeOp()]);
    (client as any).server = { payments: () => queryChain };

    const page = await client.getTransactionHistory('GABC');

    expect(page.records).toHaveLength(1);
    expect(page.records[0]).toMatchObject({
      id: 'op-1',
      type: 'payment',
      from: 'GABC',
      to: 'GXYZ',
      asset: 'USDC',
      amount: '100.0000000',
      transactionHash: 'hash-abc',
    });
    expect(page.count).toBe(1);
  });

  it('maps native XLM asset correctly', async () => {
    const { queryChain } = mockServer([
      makeOp({ asset_type: 'native', asset_code: undefined }),
    ]);
    (client as any).server = { payments: () => queryChain };

    const page = await client.getTransactionHistory('GABC');
    expect(page.records[0].asset).toBe('XLM');
  });

  // Filter by type
  it('filters records by type', async () => {
    const { queryChain } = mockServer([
      makeOp({ id: 'op-1', type: 'payment' }),
      makeOp({ id: 'op-2', type: 'create_account' }),
    ]);
    (client as any).server = { payments: () => queryChain };

    const page = await client.getTransactionHistory('GABC', { type: 'payment' });
    expect(page.records).toHaveLength(1);
    expect(page.records[0].id).toBe('op-1');
  });

  it('returns all records when no type filter is given', async () => {
    const { queryChain } = mockServer([
      makeOp({ id: 'op-1', type: 'payment' }),
      makeOp({ id: 'op-2', type: 'create_account' }),
    ]);
    (client as any).server = { payments: () => queryChain };

    const page = await client.getTransactionHistory('GABC');
    expect(page.records).toHaveLength(2);
  });

  // Filter by date range
  it('filters records by startDate', async () => {
    const { queryChain } = mockServer([
      makeOp({ id: 'op-old', created_at: '2024-01-01T00:00:00Z' }),
      makeOp({ id: 'op-new', created_at: '2024-06-01T00:00:00Z' }),
    ]);
    (client as any).server = { payments: () => queryChain };

    const page = await client.getTransactionHistory('GABC', {
      startDate: '2024-03-01T00:00:00Z',
    });

    expect(page.records).toHaveLength(1);
    expect(page.records[0].id).toBe('op-new');
  });

  it('filters records by endDate', async () => {
    const { queryChain } = mockServer([
      makeOp({ id: 'op-old', created_at: '2024-01-01T00:00:00Z' }),
      makeOp({ id: 'op-new', created_at: '2024-06-01T00:00:00Z' }),
    ]);
    (client as any).server = { payments: () => queryChain };

    const page = await client.getTransactionHistory('GABC', {
      endDate: '2024-03-01T00:00:00Z',
    });

    expect(page.records).toHaveLength(1);
    expect(page.records[0].id).toBe('op-old');
  });

  it('filters records by both startDate and endDate', async () => {
    const { queryChain } = mockServer([
      makeOp({ id: 'op-a', created_at: '2024-01-01T00:00:00Z' }),
      makeOp({ id: 'op-b', created_at: '2024-04-01T00:00:00Z' }),
      makeOp({ id: 'op-c', created_at: '2024-08-01T00:00:00Z' }),
    ]);
    (client as any).server = { payments: () => queryChain };

    const page = await client.getTransactionHistory('GABC', {
      startDate: '2024-03-01T00:00:00Z',
      endDate: '2024-06-01T00:00:00Z',
    });

    expect(page.records).toHaveLength(1);
    expect(page.records[0].id).toBe('op-b');
  });

  it('accepts Date objects for startDate and endDate', async () => {
    const { queryChain } = mockServer([
      makeOp({ id: 'op-a', created_at: '2024-01-01T00:00:00Z' }),
      makeOp({ id: 'op-b', created_at: '2024-06-01T00:00:00Z' }),
    ]);
    (client as any).server = { payments: () => queryChain };

    const page = await client.getTransactionHistory('GABC', {
      startDate: new Date('2024-03-01'),
      endDate: new Date('2024-12-31'),
    });

    expect(page.records).toHaveLength(1);
    expect(page.records[0].id).toBe('op-b');
  });

  // Pagination
  it('respects the limit option', async () => {
    const ops = Array.from({ length: 10 }, (_, i) =>
      makeOp({ id: `op-${i}`, paging_token: `token-${i}` }),
    );
    const { queryChain } = mockServer(ops);
    (client as any).server = { payments: () => queryChain };

    const page = await client.getTransactionHistory('GABC', { limit: 3 });
    expect(page.records).toHaveLength(3);
    expect(page.count).toBe(3);
  });

  it('clamps limit to 200', async () => {
    const { queryChain } = mockServer([makeOp()]);
    (client as any).server = { payments: () => queryChain };

    await client.getTransactionHistory('GABC', { limit: 9999 });
    expect(queryChain.limit).toHaveBeenCalledWith(200);
  });

  it('returns nextCursor when more pages exist', async () => {
    const ops = Array.from({ length: 5 }, (_, i) =>
      makeOp({ id: `op-${i}`, paging_token: `token-${i}` }),
    );
    const { queryChain } = mockServer(ops);
    (client as any).server = { payments: () => queryChain };

    const page = await client.getTransactionHistory('GABC', { limit: 5 });
    expect(page.nextCursor).toBe('token-4');
  });

  it('returns no nextCursor when records are fewer than limit', async () => {
    const { queryChain } = mockServer([makeOp()]);
    (client as any).server = { payments: () => queryChain };

    const page = await client.getTransactionHistory('GABC', { limit: 20 });
    expect(page.nextCursor).toBeUndefined();
  });

  it('passes cursor to Horizon when provided', async () => {
    const { queryChain } = mockServer([]);
    (client as any).server = { payments: () => queryChain };

    await client.getTransactionHistory('GABC', { cursor: 'token-42' });
    expect(queryChain.cursor).toHaveBeenCalledWith('token-42');
  });

  it('passes order to Horizon', async () => {
    const { queryChain } = mockServer([]);
    (client as any).server = { payments: () => queryChain };

    await client.getTransactionHistory('GABC', { order: 'asc' });
    expect(queryChain.order).toHaveBeenCalledWith('asc');
  });

  it('defaults to desc order', async () => {
    const { queryChain } = mockServer([]);
    (client as any).server = { payments: () => queryChain };

    await client.getTransactionHistory('GABC');
    expect(queryChain.order).toHaveBeenCalledWith('desc');
  });

  it('returns empty page when Horizon returns no records', async () => {
    const { queryChain } = mockServer([]);
    (client as any).server = { payments: () => queryChain };

    const page = await client.getTransactionHistory('GABC');
    expect(page.records).toHaveLength(0);
    expect(page.nextCursor).toBeUndefined();
    expect(page.count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// exportTransactionsToCsv
// ---------------------------------------------------------------------------

describe('exportTransactionsToCsv', () => {
  const record: TransactionRecord = {
    id: 'op-1',
    createdAt: '2024-06-01T12:00:00Z',
    type: 'payment',
    from: 'GABC',
    to: 'GXYZ',
    asset: 'USDC',
    amount: '100.0000000',
    transactionHash: 'hash-abc',
  };

  it('produces a header row', () => {
    const csv = exportTransactionsToCsv([record]);
    const firstLine = csv.split('\n')[0];
    expect(firstLine).toBe('id,createdAt,type,from,to,asset,amount,transactionHash');
  });

  it('produces one data row per record', () => {
    const csv = exportTransactionsToCsv([record, { ...record, id: 'op-2' }]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
  });

  it('exports all fields in the correct order', () => {
    const csv = exportTransactionsToCsv([record]);
    const dataRow = csv.split('\n')[1];
    expect(dataRow).toBe('op-1,2024-06-01T12:00:00Z,payment,GABC,GXYZ,USDC,100.0000000,hash-abc');
  });

  it('handles undefined optional fields as empty strings', () => {
    const minimal: TransactionRecord = {
      id: 'op-min',
      createdAt: '2024-06-01T12:00:00Z',
      type: 'create_account',
      from: 'GABC',
      transactionHash: 'hash-min',
    };
    const csv = exportTransactionsToCsv([minimal]);
    const dataRow = csv.split('\n')[1];
    expect(dataRow.split(',')).toHaveLength(8);
  });

  it('wraps values containing commas in double quotes', () => {
    const r: TransactionRecord = { ...record, amount: '1,000.00' };
    const csv = exportTransactionsToCsv([r]);
    expect(csv).toContain('"1,000.00"');
  });

  it('escapes double quotes inside values per RFC 4180', () => {
    const r: TransactionRecord = { ...record, asset: 'US"DC' };
    const csv = exportTransactionsToCsv([r]);
    expect(csv).toContain('"US""DC"');
  });

  it('returns only a header row for an empty array', () => {
    const csv = exportTransactionsToCsv([]);
    expect(csv).toBe('id,createdAt,type,from,to,asset,amount,transactionHash');
    expect(csv.split('\n')).toHaveLength(1);
  });
});
