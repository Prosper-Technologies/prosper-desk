"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, FileText, Eye, Users, Copy, ExternalLink } from "lucide-react"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { api } from "~/trpc/react"
import { formatRelativeTime } from "~/lib/utils"
import { toast } from "sonner"

export default function FormsPage() {
  const router = useRouter()
  const [page, setPage] = useState(1)
  const [clientFilter, setClientFilter] = useState<string>("")
  const [publishedFilter, setPublishedFilter] = useState<string>("")

  const { data, isLoading } = api.forms.getAll.useQuery({
    page,
    limit: 25,
    client_id: clientFilter || undefined,
    is_published:
      publishedFilter === "" ? undefined : publishedFilter === "true",
  })

  const { data: clients } = api.clients.getAll.useQuery({
    page: 1,
    limit: 50,
  })

  const { data: company } = api.company.getSettings.useQuery()

  const forms = data?.forms || []
  const totalPages = data?.totalPages || 1

  const copyFormUrl = (formSlug: string, clientSlug: string) => {
    if (!company?.slug) return
    const url = `${window.location.origin}/forms/${company?.slug}/${clientSlug}/${formSlug}`
    navigator.clipboard.writeText(url)
    toast.success("Link copied!", {
      description: "Form link has been copied to clipboard",
    })
  }

  const openFormInNewTab = (formSlug: string, clientSlug: string) => {
    if (!company?.slug) return
    const url = `${window.location.origin}/forms/${company?.slug}/${clientSlug}/${formSlug}`
    window.open(url, "_blank")
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Forms</h1>
          <p className="text-muted-foreground">
            Create and manage custom forms for data collection
          </p>
        </div>
        <Button onClick={() => router.push("/form-builder/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Create Form
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Select
              value={clientFilter}
              onValueChange={(value) =>
                setClientFilter(value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients?.clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={publishedFilter}
              onValueChange={(value) =>
                setPublishedFilter(value === "all" ? "" : value)
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Forms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Forms</SelectItem>
                <SelectItem value="true">Published</SelectItem>
                <SelectItem value="false">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Forms Table */}
      <Card>
        <CardHeader>
          <CardTitle>Forms</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              Loading forms...
            </div>
          ) : forms.length === 0 ? (
            <div className="py-8 text-center">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No forms yet</h3>
              <p className="mt-2 text-muted-foreground">
                Create your first form to start collecting data
              </p>
              <Button
                onClick={() => router.push("/form-builder/new")}
                className="mt-4"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Form
              </Button>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submissions</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forms.map((form: any) => (
                    <TableRow key={form.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{form.name}</div>
                          {form.description && (
                            <div className="line-clamp-1 text-sm text-muted-foreground">
                              {form.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {form.client ? (
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{form.client.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            All Clients
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {form.is_published ? (
                          <Badge variant="default">Published</Badge>
                        ) : (
                          <Badge variant="secondary">Draft</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="link"
                          className="h-auto p-0"
                          onClick={() =>
                            router.push(`/form-builder/${form.id}/submissions`)
                          }
                        >
                          View Submissions
                        </Button>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatRelativeTime(new Date(form.created_at))}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              router.push(`/form-builder/${form.id}`)
                            }
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {form.is_published && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  copyFormUrl(form.slug, form.client?.slug)
                                }
                                title="Copy form link"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  openFormInNewTab(form.slug, form.client?.slug)
                                }
                                title="Open form in new tab"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
