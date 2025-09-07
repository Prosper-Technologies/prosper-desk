"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import {
  LifeBuoy,
  Search,
  BookOpen,
  Eye,
  Calendar,
  Clock,
  ArrowLeft,
  Loader,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { formatRelativeTime } from "~/lib/utils";

interface KnowledgePortalPageProps {
  params: {
    companySlug: string;
    clientSlug: string;
  };
}

export default function KnowledgePortalPage({ params }: KnowledgePortalPageProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: articles, isLoading } = api.knowledgeBase.getPublished.useQuery({
    companySlug: params.companySlug,
    page: 1,
    limit: 50,
    search: searchTerm || undefined,
  });

  const filteredArticles = articles?.filter((article) =>
    article.title.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center">
              <BookOpen className="mr-2 h-5 w-5 text-primary" />
              <div>
                <h1 className="text-base font-semibold text-gray-900">
                  Knowledge Base
                </h1>
                <p className="text-xs text-gray-600">
                  Find answers to common questions
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/portal/${params.companySlug}/${params.clientSlug}`}>
                <ArrowLeft className="mr-2 h-3 w-3" />
                Back to Portal
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Welcome Section */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="mb-1 text-base font-medium text-gray-900">
                    Welcome to our Knowledge Base
                  </h2>
                  <p className="text-sm text-gray-600">
                    Browse articles and guides to help you get the most out of our service.
                  </p>
                </div>
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
            </CardContent>
          </Card>

          {/* Search */}
          <Card>
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
                <Input
                  placeholder="Search articles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Articles Grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {isLoading ? (
              <div className="col-span-full flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
                  <p className="text-gray-600">Loading articles...</p>
                </div>
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="col-span-full">
                <Card>
                  <CardContent className="py-12 text-center">
                    <BookOpen className="mx-auto mb-4 h-6 w-6 text-gray-400" />
                    <h3 className="mb-2 text-lg font-medium text-gray-900">
                      {searchTerm ? "No articles found" : "No articles available"}
                    </h3>
                    <p className="text-gray-600">
                      {searchTerm
                        ? "Try adjusting your search terms."
                        : "Check back later for helpful articles and guides."}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              filteredArticles.map((article) => (
                <Card
                  key={article.id}
                  className="transition-shadow hover:shadow-md"
                >
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base leading-tight">
                      <Link
                        href={`/portal/${params.companySlug}/${params.clientSlug}/knowledge/${article.slug}`}
                        className="transition-colors hover:text-blue-600"
                      >
                        {article.title}
                      </Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="mb-4 line-clamp-3 text-sm text-gray-600">
                      {article.content.replace(/<[^>]*>/g, "").substring(0, 200)}...
                    </p>

                    <div className="mb-4 flex items-center justify-between text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {article.view_count} views
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {Math.ceil(
                          article.content.replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).length / 200
                        )} min read
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Calendar className="h-3 w-3" />
                        Updated {formatRelativeTime(article.updated_at)}
                      </div>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/portal/${params.companySlug}/${params.clientSlug}/knowledge/${article.slug}`}>
                          <FileText className="mr-1 h-3 w-3" />
                          Read
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}