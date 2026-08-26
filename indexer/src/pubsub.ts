import { createPubSub } from 'graphql-yoga';
import type { Invoice } from './types';

/**
 * Invoices as published by the processor: fetched from the RPC before the
 * database assigns `created_at` / `updated_at`, so those fields are absent
 * from the published payloads.
 */
type PublishedInvoice = Omit<Invoice, 'created_at' | 'updated_at'>;

type PubSubChannels = {
  INVOICE_CREATED: [PublishedInvoice];
  INVOICE_UPDATED: [PublishedInvoice];
};

export const pubSub = createPubSub<PubSubChannels>();
