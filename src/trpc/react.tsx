"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { loggerLink, unstable_httpBatchStreamLink } from "@trpc/client"
import { createTRPCReact } from "@trpc/react-query"
import { type inferRouterInputs, type inferRouterOutputs } from "@trpc/server"
import { useState, useEffect } from "react"
import superjson from "superjson"

import { type AppRouter } from "~/server/api/root"
import { useCompany } from "~/contexts/company-context"

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
      },
    },
  })

let clientQueryClientSingleton: QueryClient | undefined = undefined
const getQueryClient = () => {
  if (typeof window === "undefined") {
    return createQueryClient()
  }
  return (clientQueryClientSingleton ??= createQueryClient())
}

export const api = createTRPCReact<AppRouter>()

function createTrpcClient(companyId: string | null) {
  return api.createClient({
    transformer: superjson,
    links: [
      loggerLink({
        enabled: (op) =>
          process.env.NODE_ENV === "development" ||
          (op.direction === "down" && op.result instanceof Error),
      }),
      unstable_httpBatchStreamLink({
        url: getBaseUrl() + "/api/trpc",
        headers() {
          const headers = new Map<string, string>()
          headers.set("x-trpc-source", "nextjs-react")

          // Add company ID header if available
          if (companyId) {
            headers.set("x-company-id", companyId)
          }

          return Object.fromEntries(headers)
        },
        fetch(url, options) {
          return fetch(url, {
            ...options,
            credentials: "include",
          })
        },
      }),
    ],
  })
}

/**
 * Inference helper for inputs.
 *
 * @example type HelloInput = RouterInputs['example']['hello']
 */
export type RouterInputs = inferRouterInputs<AppRouter>

/**
 * Inference helper for outputs.
 *
 * @example type HelloOutput = RouterOutputs['example']['hello']
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>

export function TRPCReactProvider(props: { children: React.ReactNode }) {
  const queryClient = getQueryClient()
  const { currentCompanyId } = useCompany()

  const [trpcClient, setTrpcClient] = useState(() =>
    createTrpcClient(currentCompanyId)
  )

  // Recreate client when company changes
  useEffect(() => {
    const newClient = createTrpcClient(currentCompanyId)
    setTrpcClient(newClient)

    // Force clear all queries and reset the query client when company changes
    queryClient.clear()
  }, [currentCompanyId, queryClient])

  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {props.children}
      </api.Provider>
    </QueryClientProvider>
  )
}

function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return `http://localhost:${process.env.PORT ?? 4000}`
}
