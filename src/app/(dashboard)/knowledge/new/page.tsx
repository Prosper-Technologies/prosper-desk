"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { TiptapEditor } from "~/components/ui/tiptap-editor";
import { ArrowLeft, Save, Eye, FileText, Settings } from "lucide-react";
import Link from "next/link";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { api } from "~/trpc/react";
import { toast } from "sonner";

const categories = [
  "Getting Started",
  "Tickets",
  "Team Management",
  "Settings",
  "API",
];

export default function NewArticlePage() {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("");
  const [content, setContent] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [previewMode, setPreviewMode] = useState(false);
  const router = useRouter();

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slug) {
      setSlug(generateSlug(value));
    }
  };

  const createArticle = api.knowledgeBase.create.useMutation({
    onSuccess: (article) => {
      toast.success("Article created successfully!");
      router.push(`/knowledge/${article.slug}` as any);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSave = async (publish = false) => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (!slug.trim()) {
      toast.error("Please enter a URL slug");
      return;
    }

    if (!content.trim()) {
      toast.error("Please add some content");
      return;
    }

    await createArticle.mutateAsync({
      title: title.trim(),
      slug: slug.trim(),
      content: content.trim(),
      isPublished: publish || isPublished,
      isPublic,
      tags: category ? [category] : [],
    });
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
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
                <BreadcrumbLink href="/knowledge">
                  Knowledge Base
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>New Article</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="space-y-6 p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/knowledge">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Knowledge Base
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold">New Article</h1>
              <p className="text-gray-600">
                Create a new knowledge base article
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPreviewMode(!previewMode)}
            >
              <Eye className="mr-2 h-4 w-4" />
              {previewMode ? "Edit" : "Preview"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave(false)}
              disabled={createArticle.isPending}
            >
              <Save className="mr-2 h-4 w-4" />
              {createArticle.isPending ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              size="sm"
              onClick={() => handleSave(true)}
              disabled={createArticle.isPending || !title || !content}
            >
              <FileText className="mr-2 h-4 w-4" />
              {createArticle.isPending ? "Publishing..." : "Publish"}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Main Content */}
          <div className="space-y-6 lg:col-span-3">
            {/* Article Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Article Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="title" className="text-sm font-medium">
                    Title *
                  </label>
                  <Input
                    id="title"
                    placeholder="Enter article title"
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="slug" className="text-sm font-medium">
                    URL Slug *
                  </label>
                  <div className="flex items-center">
                    <span className="mr-2 text-sm text-gray-500">
                      /knowledge/
                    </span>
                    <Input
                      id="slug"
                      placeholder="article-slug"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Category *</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Content Editor */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Content</CardTitle>
              </CardHeader>
              <CardContent>
                {previewMode ? (
                  <div className="min-h-[400px] rounded-lg border border-gray-200 p-4">
                    <h1 className="mb-4 text-lg font-bold">
                      {title || "Untitled Article"}
                    </h1>
                    <TiptapEditor
                      content={content}
                      editable={false}
                      className="border-0"
                    />
                  </div>
                ) : (
                  <TiptapEditor
                    content={content}
                    onChange={setContent}
                    placeholder="Start writing your article..."
                    className="min-h-[400px]"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Publish Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="h-4 w-4" />
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <label htmlFor="published" className="text-sm font-medium">
                    Published
                  </label>
                  <Switch
                    id="published"
                    checked={isPublished}
                    onCheckedChange={setIsPublished}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label htmlFor="public" className="text-sm font-medium">
                    Public Access
                  </label>
                  <Switch
                    id="public"
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                  />
                </div>

                <div className="border-t pt-2">
                  <Badge variant={isPublished ? "default" : "secondary"}>
                    {isPublished ? "Published" : "Draft"}
                  </Badge>
                  {isPublic && (
                    <Badge variant="outline" className="ml-2">
                      Public
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Article Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Article Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Word count:</span>
                  <span>
                    {
                      content
                        .replace(/<[^>]*>/g, "")
                        .split(/\s+/)
                        .filter(Boolean).length
                    }
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Characters:</span>
                  <span>{content.replace(/<[^>]*>/g, "").length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Reading time:</span>
                  <span>
                    {Math.ceil(
                      content
                        .replace(/<[^>]*>/g, "")
                        .split(/\s+/)
                        .filter(Boolean).length / 200,
                    )}{" "}
                    min
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
