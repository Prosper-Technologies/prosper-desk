"use client";

import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { TiptapEditor } from "~/components/ui/tiptap-editor";
import {
  ArrowLeft,
  Calendar,
  Eye,
  Edit,
  User,
  Clock,
  Tag,
  Globe,
  Lock,
  Loader,
} from "lucide-react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { formatRelativeTime } from "~/lib/utils";

export default function ArticleViewPage() {
  const params = useParams();
  const slug = params?.slug as string;

  // Use the internal getBySlugInternal endpoint for dashboard views
  const { data: article, isLoading, error } = api.knowledgeBase.getBySlugInternal.useQuery(
    { slug },
    { enabled: !!slug }
  );

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <Loader className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-gray-600">Loading article...</p>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-bold">Article not found</h2>
          <p className="text-gray-600 mb-4">
            The article you're looking for doesn't exist.
          </p>
          <Button asChild>
            <Link href="/knowledge">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Knowledge Base
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Sidebar Trigger and Breadcrumbs */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="h-6 w-px bg-gray-200" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/knowledge">Knowledge Base</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{article.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="max-w-4xl mx-auto space-y-6 p-4">
        {/* Article Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/knowledge">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Knowledge Base
                </Link>
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={article.is_published ? "default" : "secondary"}>
                {article.is_published ? "Published" : "Draft"}
              </Badge>
              <Badge variant="outline">
                {article.is_public ? (
                  <><Globe className="mr-1 h-3 w-3" />Public</>
                ) : (
                  <><Lock className="mr-1 h-3 w-3" />Private</>
                )}
              </Badge>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">{article.title}</h1>
          </div>

          <Button variant="outline" asChild>
            <Link href={`/knowledge/${article.slug}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Article
            </Link>
          </Button>
        </div>

        {/* Article Meta */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>Author</span>
                </div>
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
                      article.content.replace(/<[^>]*>/g, "").split(/\s+/).filter(Boolean).length / 200
                    )} min read
                  </span>
                </div>
              </div>
            </div>

            {/* Tags */}
            {article.tags && Array.isArray(article.tags) && article.tags.length > 0 && (
              <div className="mt-4 pt-4 border-t">
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
              </div>
            )}
          </CardContent>
        </Card>

        {/* Article Content */}
        <Card>
          <CardContent className="p-6">
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
                  This article was created on {article.created_at.toLocaleDateString()} 
                  and last updated on {article.updated_at.toLocaleDateString()}.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <Link href={`/knowledge/${article.slug}/edit`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}