"use client";

import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import {
  Home,
  ArrowLeft,
  FileQuestion,
  Search
} from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <FileQuestion className="h-4 w-4 text-blue-600" />
          </div>

          <h1 className="text-lg font-bold text-gray-900 mb-2">
            Page Not Found
          </h1>

          <p className="text-gray-600 mb-6">
            Sorry, we couldn't find the page you're looking for. The page might have been moved, deleted, or you might have mistyped the URL.
          </p>

          <div className="space-y-3">
            <Button asChild className="w-full">
              <Link href="/dashboard">
                <Home className="h-4 w-4 mr-2" />
                Go to Dashboard
              </Link>
            </Button>

            <Button variant="outline" onClick={() => window.history.back()} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-3">
              Need help finding what you're looking for?
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/knowledge">
                  <Search className="h-4 w-4 mr-2" />
                  Search Help
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
