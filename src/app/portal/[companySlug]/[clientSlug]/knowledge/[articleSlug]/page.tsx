"use client";

import { useParams } from "next/navigation";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  BookOpen,
  ArrowLeft,
  Calendar,
  Eye,
  Clock,
  Loader,
  User,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { formatRelativeTime } from "~/lib/utils";
import { TiptapEditor } from "~/components/ui/tiptap-editor";

interface ArticlePortalPageProps {
  params: {
    companySlug: string;
    clientSlug: string;
    articleSlug: string;
  };
}

export default function ArticlePortalPage({ params }: ArticlePortalPageProps) {
  const {
    data: article,
    isLoading,
    error,
  } = api.knowledgeBase.getBySlug.useQuery({
    companySlug: params.companySlug,
    articleSlug: params.articleSlug,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-gray-600">Loading article...</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="mb-2 text-lg font-bold">Article not found</h2>
          <p className="mb-4 text-gray-600">
            The article you're looking for doesn't exist or is no longer
            available.
          </p>
          <Button asChild>
            <Link
              href={`/portal/${params.companySlug}/${params.clientSlug}/knowledge`}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Knowledge Base
            </Link>
          </Button>
        </div>
      </div>
    );
  }

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
                <p className="text-xs text-gray-600">{article.title}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link
                href={`/portal/${params.companySlug}/${params.clientSlug}/knowledge`}
              >
                <ArrowLeft className="mr-2 h-3 w-3" />
                Back to Articles
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Article Header */}
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {article.title}
            </h1>

            {/* Article Meta */}
            <div className="flex items-center gap-6 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>Updated {formatRelativeTime(article.updated_at)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span>{article.view_count} views</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>
                  {Math.ceil(
                    article.content
                      .replace(/<[^>]*>/g, "")
                      .split(/\s+/)
                      .filter(Boolean).length / 200,
                  )}{" "}
                  min read
                </span>
              </div>
            </div>

            {/* Tags */}
            {article.tags &&
              Array.isArray(article.tags) &&
              article.tags.length > 0 && (
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-gray-500" />
                  <div className="flex flex-wrap gap-1">
                    {article.tags.map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
          </div>

          {/* Article Content */}
          <Card>
            <CardContent className="p-8">
              <div className="prose prose-gray max-w-none">
                <TiptapEditor
                  content={article.content}
                  editable={false}
                  className="border-0 focus:ring-0"
                />
              </div>
            </CardContent>
          </Card>

          {/* Article Footer */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <p>
                    Was this article helpful? Let us know by creating a support
                    ticket.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={`/portal/${params.companySlug}/${params.clientSlug}`}
                    >
                      Contact Support
                    </Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link
                      href={`/portal/${params.companySlug}/${params.clientSlug}/knowledge`}
                    >
                      <ArrowLeft className="mr-2 h-3 w-3" />
                      Back to Articles
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
