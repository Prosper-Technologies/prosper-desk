"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Home, RefreshCw, AlertTriangle, Bug, HelpCircle } from "lucide-react"

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to monitoring service
    console.error("Application error:", error)
  }, [error])

  const isDevelopment = process.env.NODE_ENV === "development"

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </div>

          <h1 className="mb-2 text-lg font-bold text-gray-900">
            Something went wrong
          </h1>

          <p className="mb-6 text-gray-600">
            We encountered an unexpected error. This might be temporary, so
            please try again.
          </p>

          {isDevelopment && (
            <div className="mb-6 rounded-lg bg-gray-100 p-3 text-left">
              <p className="break-words font-mono text-xs text-gray-700">
                <strong>Error:</strong> {error.message}
              </p>
              {error.digest && (
                <p className="mt-1 font-mono text-xs text-gray-700">
                  <strong>Digest:</strong> {error.digest}
                </p>
              )}
            </div>
          )}

          <div className="space-y-3">
            <Button onClick={reset} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>

            <Button variant="outline" asChild className="w-full">
              <Link href="/dashboard">
                <Home className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Link>
            </Button>
          </div>

          <div className="mt-6 border-t border-gray-200 pt-6">
            <p className="mb-3 text-sm text-gray-500">Still having trouble?</p>
            <div className="flex justify-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href={"/support" as any}>
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Get Support
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Report bug functionality
                  console.log("Report bug clicked", {
                    error: error.message,
                    digest: error.digest,
                  })
                }}
              >
                <Bug className="mr-2 h-4 w-4" />
                Report Bug
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
