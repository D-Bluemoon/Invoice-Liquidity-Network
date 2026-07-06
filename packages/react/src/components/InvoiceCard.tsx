import React from 'react';
import type { Invoice } from '@invoice-liquidity/sdk';
import { StatusBadge } from './StatusBadge';
import { AddressDisplay } from './AddressDisplay';
import { AmountDisplay } from './AmountDisplay';
import { useILNTheme } from './ThemeProvider';

export interface InvoiceCardProps {
  invoice: Invoice;
  /** Called when the user clicks the card. */
  onClick?: (invoice: Invoice) => void;
  className?: string;
}

function formatDueDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export const InvoiceCard: React.FC<InvoiceCardProps> = ({ invoice, onClick, className }) => {
  const theme = useILNTheme();

  const cardStyle: React.CSSProperties = {
    background: theme.colorBg,
    border: `1px solid ${theme.colorBorder}`,
    borderRadius: theme.borderRadius,
    padding: '16px 20px',
    fontFamily: theme.fontFamily,
    color: theme.colorText,
    cursor: onClick ? 'pointer' : undefined,
    transition: 'box-shadow 0.15s ease',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: theme.colorTextMuted,
    marginBottom: 2,
  };

  const valueStyle: React.CSSProperties = {
    fontSize: 14,
    fontWeight: 500,
  };

  return (
    <div
      className={className}
      style={cardStyle}
      onClick={onClick ? () => onClick(invoice) : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(invoice); } : undefined}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>Invoice #{String(invoice.id)}</span>
        <StatusBadge status={invoice.status as any} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 24px' }}>
        <div>
          <div style={labelStyle}>Issuer</div>
          <div style={valueStyle}>
            <AddressDisplay address={invoice.issuer as unknown as string ?? ''} />
          </div>
        </div>

        <div>
          <div style={labelStyle}>Payer</div>
          <div style={valueStyle}>
            <AddressDisplay address={invoice.payer as unknown as string ?? ''} />
          </div>
        </div>

        <div>
          <div style={labelStyle}>Amount</div>
          <div style={{ ...valueStyle, fontWeight: 700, color: theme.colorPrimary }}>
            <AmountDisplay amount={invoice.amount as unknown as bigint} />
          </div>
        </div>

        <div>
          <div style={labelStyle}>Due Date</div>
          <div style={valueStyle}>{formatDueDate(invoice.dueDate as unknown as number)}</div>
        </div>
      </div>
    </div>
  );
};
