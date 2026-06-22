"use client";

import { queryClient as singletonQueryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { FC, ReactNode, useState } from "react";

interface QueryProviderProps {
  children: ReactNode;
}

const QueryProvider: FC<QueryProviderProps> = ({ children }) => {
  const [client] = useState(() => singletonQueryClient);

  return (
    <>
      <QueryClientProvider client={client}>
        {children}
        {process.env.NODE_ENV !== "production" && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </QueryClientProvider>
    </>
  );
};

export default QueryProvider;
