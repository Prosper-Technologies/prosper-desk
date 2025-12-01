"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Badge } from "~/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
import { SidebarTrigger } from "~/components/ui/sidebar"
import {
  Settings,
  Search,
  Plus,
  MoreHorizontal,
  Building,
  Users,
  Globe,
  Eye,
  Edit,
  Link as LinkIcon,
  Shield,
  Loader,
  Mail,
  Zap,
  Trash2,
} from "lucide-react"
import { api } from "~/trpc/react"
import { toast } from "sonner"

export default function SettingsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [clientToDelete, setClientToDelete] = useState<{
    id: string
    name: string
  } | null>(null)

  const { data: company, isLoading: companyLoading } =
    api.company.getSettings.useQuery()
  const { data, isLoading, refetch } = api.clients.getAll.useQuery({
    page: 1,
    limit: 50,
    search: searchTerm || undefined,
  })

  const deleteMutation = api.clients.delete.useMutation({
    onSuccess: () => {
      toast.success("Client deleted successfully")
      refetch()
      setDeleteDialogOpen(false)
      setClientToDelete(null)
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete client")
    },
  })

  const clients = data?.clients || []

  const handleDeleteClient = (clientId: string, clientName: string) => {
    setClientToDelete({ id: clientId, name: clientName })
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (clientToDelete) {
      deleteMutation.mutate({ id: clientToDelete.id })
    }
  }

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div>
      {/* Header with Sidebar Trigger and Breadcrumbs */}
      <header className="flex h-16 shrink-0 items-center gap-2 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
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
                <BreadcrumbPage>Clients</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <div className="space-y-6 p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold">
              <Settings className="h-4 w-4" />
              Clients
            </h1>
            <p className="text-gray-600">
              Manage your clients and customer portal access
            </p>
          </div>
          <Button asChild size="sm">
            <Link href="/settings/clients/add">
              <Plus className="mr-2 h-4 w-4" />
              Add Client
            </Link>
          </Button>
        </div>

        {/* Quick Access Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Clients</p>
                  <p className="text-lg font-bold">{clients.length}</p>
                </div>
                <Building className="h-4 w-4 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Portals</p>
                  <p className="text-lg font-bold">
                    {clients.filter((c) => c.portal_enabled).length}
                  </p>
                </div>
                <Globe className="h-4 w-4 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Portal Users</p>
                  <p className="text-lg font-bold">
                    {clients.reduce(
                      (total, client) =>
                        total + (client.activePortalUsers || 0),
                      0
                    )}
                  </p>
                </div>
                <Users className="h-4 w-4 text-purple-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-2 border-dashed border-blue-200 bg-blue-50/50">
            <CardContent className="p-4">
              <Link href="/settings/gmail" className="block">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-700">
                      Gmail Integration
                    </p>
                    <p className="text-xs text-blue-600">Email → Tickets</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Mail className="h-4 w-4 text-blue-500" />
                    <Zap className="h-3 w-3 text-yellow-500" />
                  </div>
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
              <Input
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Clients List */}
        <Card>
          <CardHeader>
            <CardTitle>Clients ({filteredClients.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <Loader className="h-4 w-4 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="py-12 text-center">
                <Building className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                <h3 className="mb-2 text-lg font-medium text-gray-900">
                  No clients found
                </h3>
                <p className="mb-4 text-gray-600">
                  {searchTerm
                    ? "No clients match your search criteria."
                    : "Get started by adding your first client."}
                </p>
                {!searchTerm && (
                  <Button asChild>
                    <Link href="/settings/clients/add">
                      <Plus className="mr-2 h-4 w-4" />
                      Add First Client
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-sm"
                  >
                    <Link
                      href={`/settings/clients/${client.id}`}
                      className="flex flex-1 cursor-pointer items-center gap-4"
                    >
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={client.logo_url || undefined} />
                        <AvatarFallback>
                          {client.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{client.name}</h3>
                          <Badge
                            variant={client.is_active ? "default" : "secondary"}
                          >
                            {client.is_active ? "Active" : "Inactive"}
                          </Badge>
                          {client.portal_enabled && (
                            <Badge variant="outline" className="text-green-600">
                              <Globe className="mr-1 h-3 w-3" />
                              Portal Enabled
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <LinkIcon className="h-3 w-3" />
                            /portal/
                            {companyLoading
                              ? "..."
                              : company?.slug || "company"}
                            /{client.slug}
                          </div>
                          {client.email_domains &&
                            client.email_domains.length > 0 && (
                              <div className="flex items-center gap-1">
                                <Shield className="h-3 w-3" />
                                {client.email_domains.join(", ")}
                              </div>
                            )}
                        </div>
                      </div>
                    </Link>

                    <div className="flex items-center gap-4">
                      <div className="text-right text-sm">
                        <p className="font-medium">
                          {client.ticketCount || 0} tickets
                        </p>
                        <p className="text-gray-600">
                          {client.activePortalUsers || 0} portal users
                        </p>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/settings/clients/${client.id}` as any}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link
                              href={
                                `/settings/clients/${client.id}/edit` as any
                              }
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Client
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link
                              href={
                                `/settings/clients/${client.id}/portal` as any
                              }
                            >
                              <Users className="mr-2 h-4 w-4" />
                              Manage Portal Access
                            </Link>
                          </DropdownMenuItem>
                          {client.portal_enabled && (
                            <DropdownMenuItem
                              onClick={() => {
                                const portalUrl = `${window.location.origin}/portal/${company?.slug}/${client.slug}`
                                window.open(portalUrl, "_blank")
                              }}
                            >
                              <Globe className="mr-2 h-4 w-4" />
                              View Portal
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              handleDeleteClient(client.id, client.name)
                            }
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Client
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the client &quot;
                {clientToDelete?.name}&quot; and all associated data including
                tickets, forms, and portal access. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setClientToDelete(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
