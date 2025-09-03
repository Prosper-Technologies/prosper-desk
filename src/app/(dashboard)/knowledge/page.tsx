"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { DashboardHeader } from "~/components/layout/dashboard-header";
import {
  BookOpen,
  Search,
  Plus,
  Eye,
  Calendar,
  User,
  FileText,
} from "lucide-react";

// TODO: Replace with actual API calls
const mockArticles: any[] = [];

const categories = [
  "All",
  "Getting Started",
  "Tickets",
  "Team Management",
  "Settings",
];

export default function KnowledgeBasePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const filteredArticles = mockArticles.filter((article) => {
    const matchesSearch =
      article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.excerpt.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || article.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <DashboardHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Knowledge Base" },
        ]}
      />

      <div className="space-y-6 p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold">
              <BookOpen className="h-4 w-4" />
              Knowledge Base
            </h1>
            <p className="text-gray-600">
              Create and manage help articles for your customers
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/knowledge/new">
              <Plus className="mr-2 h-4 w-4" />
              New Article
            </Link>
          </Button>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
                <Input
                  placeholder="Search articles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={
                      selectedCategory === category ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Articles Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredArticles.map((article) => (
            <Card
              key={article.id}
              className="transition-shadow hover:shadow-md"
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <Badge
                    variant={article.isPublished ? "default" : "secondary"}
                    className="mb-2"
                  >
                    {article.category}
                  </Badge>
                  <Badge
                    variant={article.isPublished ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {article.isPublished ? "Published" : "Draft"}
                  </Badge>
                </div>
                <CardTitle className="text-lg leading-tight">
                  <Link
                    href={`/knowledge/${article.slug}`}
                    className="transition-colors hover:text-blue-600"
                  >
                    {article.title}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="mb-4 line-clamp-2 text-sm text-gray-600">
                  {article.excerpt}
                </p>

                <div className="mb-4 flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {article.author}
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {article.views} views
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Calendar className="h-3 w-3" />
                    {article.updatedAt.toLocaleDateString()}
                  </div>
                  <div className="flex gap-1">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/knowledge/${article.slug}`}>
                        <FileText className="mr-1 h-3 w-3" />
                        View
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/knowledge/${article.slug}/edit`}>Edit</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredArticles.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="mx-auto mb-4 h-12 w-12 text-gray-400" />
              <h3 className="mb-2 text-lg font-medium text-gray-900">
                No articles found
              </h3>
              <p className="mb-4 text-gray-600">
                No knowledge base articles available. Connect to your database
                or API to load articles.
              </p>
              <Button asChild>
                <Link href="/knowledge/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Article
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
