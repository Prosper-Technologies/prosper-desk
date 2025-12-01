"use client"

import Link from "next/link"
import { Button } from "~/components/ui/button"
import { Card, CardContent } from "~/components/ui/card"
import { Home, ArrowLeft, FileQuestion, Search } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <FileQuestion className="h-4 w-4 text-blue-600" />
          </div>

          <h1 className="mb-2 text-lg font-bold text-gray-900">
            Page Not Found
          </h1>

          <p className="mb-6 text-gray-600">
            Sorry, we couldn&apos;t find the page you&apos;re looking for. The
            page might have been moved, deleted, or you might have mistyped the
            URL.
          </p>

          <div className="space-y-3">
            <Button asChild className="w-full">
              <Link href="/dashboard">
                <Home className="mr-2 h-4 w-4" />
                Go to Dashboard
              </Link>
            </Button>

            <Button
              variant="outline"
              onClick={() => window.history.back()}
              className="w-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go Back
            </Button>
          </div>

          <div className="mt-6 border-t border-gray-200 pt-6">
            <p className="mb-3 text-sm text-gray-500">
              Need help finding what you&apos;re looking for?
            </p>
            <div className="flex justify-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/knowledge">
                  <Search className="mr-2 h-4 w-4" />
                  Search Help
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
