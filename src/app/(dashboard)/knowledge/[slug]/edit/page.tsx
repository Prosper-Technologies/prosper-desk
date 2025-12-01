"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Badge } from "~/components/ui/badge";
import { Switch } from "~/components/ui/switch";
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
  Save,
  Eye,
  Globe,
  Lock,
  Tag,
  Loader,
  X,
} from "lucide-react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { toast } from "sonner";

export default function EditArticlePage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;

  const { data: article, isLoading } =
    api.knowledgeBase.getBySlugInternal.useQuery({ slug }, { enabled: !!slug });

  const [title, setTitle] = useState(article?.title || "");
  const [articleSlug, setArticleSlug] = useState(article?.slug || "");
  const [content, setContent] = useState(article?.content || "");
  const [isPublished, setIsPublished] = useState(
    article?.is_published || false,
  );
  const [isPublic, setIsPublic] = useState<boolean>(article?.is_public ?? true);
  const [tags, setTags] = useState<string[]>((article?.tags as string[]) || []);
  const [newTag, setNewTag] = useState("");

  const updateMutation = api.knowledgeBase.update.useMutation({
    onSuccess: () => {
      toast.success("Article updated successfully");
      router.push(`/knowledge/${articleSlug}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Update local state when article data loads
  useState(() => {
    if (article) {
      setTitle(article.title);
      setArticleSlug(article.slug);
      setContent(article.content);
      setIsPublished(article.is_published);
      setIsPublic(article.is_public);
      setTags((article.tags as string[]) || []);
    }
  });

  const handleSave = () => {
    if (!article) return;

    updateMutation.mutate({
      id: article.id,
      title,
      slug: articleSlug,
      content,
      isPublished,
      isPublic,
      tags,
    });
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const generateSlugFromTitle = () => {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
    setArticleSlug(slug);
  };

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

  if (!article) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-bold">Article not found</h2>
          <p className="mb-4 text-gray-600">
            The article you&apos;re looking for doesn&apos;t exist.
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
                <BreadcrumbLink href="/knowledge">
                  Knowledge Base
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href={`/knowledge/${slug}`}>
                  {article.title}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Edit</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 p-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/knowledge/${slug}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Article
                </Link>
              </Button>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Article</h1>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/knowledge/${slug}`}>
                <Eye className="mr-2 h-4 w-4" />
                Preview
              </Link>
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                updateMutation.isPending ||
                !title.trim() ||
                !articleSlug.trim() ||
                !content.trim()
              }
            >
              {updateMutation.isPending ? (
                <Loader className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        </div>

        {/* Article Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Article Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="published"
                  checked={isPublished}
                  onCheckedChange={setIsPublished}
                />
                <Label htmlFor="published">Published</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="public"
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                />
                <Label htmlFor="public">Public</Label>
                {isPublic ? (
                  <Globe className="ml-1 h-3 w-3 text-green-600" />
                ) : (
                  <Lock className="ml-1 h-3 w-3 text-gray-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Title and Slug */}
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <div className="flex gap-2">
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter article title..."
                />
                <Button variant="outline" onClick={generateSlugFromTitle}>
                  Generate Slug
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={articleSlug}
                onChange={(e) => setArticleSlug(e.target.value)}
                placeholder="article-url-slug"
                pattern="[a-z0-9-]+"
              />
              <p className="text-xs text-gray-500">
                Only lowercase letters, numbers, and hyphens allowed
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tags */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Tags
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add a tag..."
                onKeyPress={(e) => e.key === "Enter" && addTag()}
              />
              <Button onClick={addTag} variant="outline">
                Add Tag
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-1 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Content Editor */}
        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
          </CardHeader>
          <CardContent>
            <TiptapEditor
              content={content}
              onChange={setContent}
              className="min-h-[400px]"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
