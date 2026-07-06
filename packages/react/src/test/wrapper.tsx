import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { ILNClient } from '@invoice-liquidity/sdk';
import { ILNContext } from '../context/ILNContext';

interface TestWrapperProps {
  client: ILNClient;
  children: ReactNode;
}

export function TestWrapper({ client, children }: TestWrapperProps): JSX.Element {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <ILNContext.Provider value={client}>
        {children}
      </ILNContext.Provider>
    </QueryClientProvider>
  );
}
