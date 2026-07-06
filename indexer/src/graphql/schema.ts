export const typeDefs = `#graphql
  type Invoice {
    id: Int!
    freelancer: String!
    payer: String!
    amount: String!
    dueDate: Int!
    discountRate: Int!
    status: InvoiceStatus!
    funder: String
    fundedAt: Int
    createdAt: Int!
    updatedAt: Int!
  }

  enum InvoiceStatus {
    Pending
    Funded
    Paid
    Defaulted
  }

  enum ILNEventType {
    submitted
    funded
    paid
    defaulted
  }

  type ILNEvent {
    eventId: String!
    eventType: ILNEventType!
    invoiceId: Int!
    ledger: Int!
    ledgerClosedAt: String!
    createdAt: Int!
  }

  type InvoicePage {
    invoices: [Invoice!]!
    hasMore: Boolean!
    nextCursor: String
  }

  type ProtocolStats {
    totalInvoices: Int!
    totalVolume: String!
    totalYield: String!
    defaultRate: Float!
  }

  type Query {
    invoice(id: Int!): Invoice
    invoices(
      status: InvoiceStatus
      freelancer: String
      payer: String
      funder: String
      limit: Int
      cursor: String
    ): InvoicePage!
    stats: ProtocolStats!
  }

  type Subscription {
    invoiceUpdated(
      id: Int
      status: InvoiceStatus
      freelancer: String
      payer: String
      funder: String
    ): Invoice!

    eventStream(
      invoiceId: Int
      eventType: ILNEventType
    ): ILNEvent!
  }
`;
