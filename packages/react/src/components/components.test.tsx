import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StatusBadge } from './StatusBadge';
import { AddressDisplay } from './AddressDisplay';
import { AmountDisplay } from './AmountDisplay';
import { ThemeProvider, useILNTheme } from './ThemeProvider';
import { InvoiceCard } from './InvoiceCard';

const STELLAR_ADDRESS = 'GDRMKYQMTNZ3XPRF7K7L3PFBJQI2S2Y2E3KJQF3KHKY3XT3LZXG3G5X2';

const mockInvoice = {
  id: 1n,
  issuer: STELLAR_ADDRESS,
  payer: 'GDELEGATE_ADDRESS1234567890123456789012345678901234567890',
  amount: 1_000_000_000n,
  discountRate: 300,
  dueDate: 1735689600,
  status: 'Funded',
  fundedBy: 'G_LP_ADDRESS',
  token: 'USDC_CONTRACT_ID',
} as any;

describe('StatusBadge', () => {
  it.each([
    ['Pending', 'Pending'],
    ['Funded', 'Funded'],
    ['Paid', 'Paid'],
    ['Defaulted', 'Defaulted'],
  ] as const)('renders %s status', (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('applies className', () => {
    const { container } = render(<StatusBadge status="Pending" className="my-badge" />);
    expect(container.querySelector('.my-badge')).toBeTruthy();
  });
});

describe('AddressDisplay', () => {
  it('truncates long addresses', () => {
    render(<AddressDisplay address={STELLAR_ADDRESS} />);
    expect(screen.queryByText(STELLAR_ADDRESS)).toBeFalsy();
    expect(screen.getByTitle(STELLAR_ADDRESS)).toBeTruthy();
  });

  it('shows full address when short', () => {
    render(<AddressDisplay address="GABC" />);
    expect(screen.getByText('GABC')).toBeTruthy();
  });

  it('renders copy button by default', () => {
    render(<AddressDisplay address={STELLAR_ADDRESS} />);
    expect(screen.getByRole('button', { name: /copy/i })).toBeTruthy();
  });

  it('hides copy button when copyable=false', () => {
    render(<AddressDisplay address={STELLAR_ADDRESS} copyable={false} />);
    expect(screen.queryByRole('button')).toBeFalsy();
  });
});

describe('AmountDisplay', () => {
  it('converts stroops to XLM and shows symbol', () => {
    render(<AmountDisplay amount={10_000_000n} />);
    expect(screen.getByText(/1\.00/)).toBeTruthy();
    expect(screen.getByText('XLM')).toBeTruthy();
  });

  it('uses custom symbol', () => {
    render(<AmountDisplay amount={10_000_000n} symbol="USDC" />);
    expect(screen.getByText('USDC')).toBeTruthy();
  });

  it('accepts number amounts', () => {
    render(<AmountDisplay amount={10_000_000} symbol="XLM" />);
    expect(screen.getByText(/1\.00/)).toBeTruthy();
  });
});

describe('ThemeProvider', () => {
  it('renders children', () => {
    render(
      <ThemeProvider>
        <span>child</span>
      </ThemeProvider>
    );
    expect(screen.getByText('child')).toBeTruthy();
  });

  it('merges custom theme values', () => {
    const ThemeConsumer: React.FC = () => {
      const theme = useILNTheme();
      return <span data-testid="color">{theme.colorPrimary}</span>;
    };
    render(
      <ThemeProvider theme={{ colorPrimary: '#FF0000' }}>
        <ThemeConsumer />
      </ThemeProvider>
    );
    expect(screen.getByTestId('color').textContent).toBe('#FF0000');
  });
});

describe('InvoiceCard', () => {
  it('renders invoice id and status', () => {
    render(
      <ThemeProvider>
        <InvoiceCard invoice={mockInvoice} />
      </ThemeProvider>
    );
    expect(screen.getByText('Invoice #1')).toBeTruthy();
    expect(screen.getByText('Funded')).toBeTruthy();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(
      <ThemeProvider>
        <InvoiceCard invoice={mockInvoice} onClick={onClick} />
      </ThemeProvider>
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledWith(mockInvoice);
  });

  it('renders amount and addresses', () => {
    render(
      <ThemeProvider>
        <InvoiceCard invoice={mockInvoice} />
      </ThemeProvider>
    );
    expect(screen.getByText(/100\.00/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /copy/i }).length).toBeGreaterThan(0);
  });
});
