"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  ArrowLeft,
  Globe,
  Shield,
  Link as LinkIcon,
  Clock,
  Target,
  Activity,
  Users,
  Edit,
  Plus,
  AlertTriangle,
  Loader,
  Trash2,
} from "lucide-react";
import { api } from "~/trpc/react";
import { formatRelativeTime } from "~/lib/utils";
import { toast } from "sonner";

export default function ClientDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params?.clientId as string;
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteFormDialogOpen, setDeleteFormDialogOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { data: client, isLoading: clientLoading } =
    api.clients.getById.useQuery({
      id: clientId,
    });

  const { data: company } = api.company.getSettings.useQuery();

  const deleteMutation = api.clients.delete.useMutation({
    onSuccess: () => {
      toast.success("Client deleted successfully");
      router.push("/settings");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete client");
    },
  });

  const { data: formsData, refetch: refetchForms } = api.forms.getAll.useQuery({
    client_id: clientId,
    page: 1,
    limit: 50,
  });

  const deleteFormMutation = api.forms.delete.useMutation({
    onSuccess: () => {
      toast.success("Form deleted successfully");
      refetchForms();
      setDeleteFormDialogOpen(false);
      setFormToDelete(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete form");
    },
  });

  const handleDeleteForm = (formId: string, formName: string) => {
    setFormToDelete({ id: formId, name: formName });
    setDeleteFormDialogOpen(true);
  };

  const confirmDeleteForm = () => {
    if (formToDelete) {
      deleteFormMutation.mutate({ id: formToDelete.id });
    }
  };

  const openFormInNewTab = (formSlug: string) => {
    if (!company?.slug || !client?.slug) return;
    const url = `${window.location.origin}/forms/${company.slug}/${client.slug}/${formSlug}`;
    window.open(url, "_blank");
  };

  const { data: slaPolicies, isLoading: slaLoading } =
    api.sla.getByClient.useQuery({
      clientId: clientId,
    });

  const { data: tickets } = api.ticket.getAll.useQuery({
    clientId: clientId,
    page: 1,
    limit: 10,
  });

  if (clientLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-bold">Client not found</h2>
          <p className="text-gray-600">
            The client you&apos;re looking for doesn&apos;t exist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/settings">Settings</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{client.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="space-y-6 p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/settings">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>

            <Avatar className="h-16 w-16">
              <AvatarImage src={client.logo_url || undefined} />
              <AvatarFallback className="text-lg">
                {client.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>

            <div>
              <div className="mb-2 flex items-center gap-2">
                <h1 className="text-xl font-bold">{client.name}</h1>
                <Badge variant={client.is_active ? "default" : "secondary"}>
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
                  <LinkIcon className="h-3 w-3" />/{client.slug}
                </div>
                {client.email_domains &&
                  Array.isArray(client.email_domains) && (
                    <div className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      {client.email_domains.join(", ")}
                    </div>
                  )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/settings/clients/${client.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit Client
              </Link>
            </Button>
            {client.portal_enabled && (
              <Button
                onClick={() => {
                  const portalUrl = `${window.location.origin}/portal/${client.company?.slug}/${client.slug}`;
                  window.open(portalUrl, "_blank");
                }}
              >
                <Globe className="mr-2 h-4 w-4" />
                View Portal
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(true)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sla">SLA Policies</TabsTrigger>
            <TabsTrigger value="portal">Portal Access</TabsTrigger>
            <TabsTrigger value="forms">Forms</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Total Tickets</p>
                      <p className="text-lg font-bold">
                        {client.tickets.length || 0}
                      </p>
                    </div>
                    <Activity className="h-4 w-4 text-blue-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Open Tickets</p>
                      <p className="text-lg font-bold">
                        {client.tickets.filter(
                          (ticket) => ticket.status !== "closed",
                        ).length || 0}
                      </p>
                    </div>
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Portal Users</p>
                      <p className="text-lg font-bold">
                        {client.portalAccess.length || 0}
                      </p>
                    </div>
                    <Users className="h-4 w-4 text-green-500" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Avg Response Time</p>
                      <p className="text-lg font-bold">2.4h</p>
                    </div>
                    <Clock className="h-4 w-4 text-purple-500" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Client Information */}
            <Card>
              <CardHeader>
                <CardTitle>Client Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Name
                    </label>
                    <p className="text-sm">{client.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Slug
                    </label>
                    <p className="text-sm">/{client.slug}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Email Domain
                    </label>
                    <p className="text-sm">
                      {client.email_domains?.join(", ") || "Not restricted"}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Status
                    </label>
                    <p className="text-sm">
                      <Badge
                        variant={client.is_active ? "default" : "secondary"}
                      >
                        {client.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Portal Access
                    </label>
                    <p className="text-sm">
                      <Badge
                        variant={
                          client.portal_enabled ? "default" : "secondary"
                        }
                      >
                        {client.portal_enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Created
                    </label>
                    <p className="text-sm">
                      {formatRelativeTime(client.created_at)}
                    </p>
                  </div>
                </div>

                {client.description && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">
                      Description
                    </label>
                    <p className="mt-1 text-sm text-gray-700">
                      {client.description}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Tickets */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Tickets</CardTitle>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/tickets?client=${client.id}`}>View All</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {tickets?.tickets && tickets.tickets.length > 0 ? (
                  <div className="space-y-3">
                    {tickets.tickets.slice(0, 5).map((ticket) => (
                      <div
                        key={ticket.id}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant="outline">
                            #{ticket.id.slice(-8)}
                          </Badge>
                          <div>
                            <p className="font-medium">{ticket.subject}</p>
                            <p className="text-sm text-gray-600">
                              {formatRelativeTime(ticket.created_at)}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline">{ticket.status}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-gray-600">
                    No tickets yet
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SLA Policies Tab */}
          <TabsContent value="sla" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">SLA Policies</h2>
                <p className="text-gray-600">
                  Manage service level agreements for this client
                </p>
              </div>
              <Button asChild>
                <Link href={`/settings/clients/${client.id}/sla/add`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add SLA Policy
                </Link>
              </Button>
            </div>

            {slaLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="h-4 w-4 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              </div>
            ) : slaPolicies && slaPolicies.length > 0 ? (
              <div className="space-y-4">
                {slaPolicies.map((sla) => (
                  <Card key={sla.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium">{sla.name}</h3>
                            <Badge variant="outline">{sla.priority}</Badge>
                            {sla.is_default && (
                              <Badge variant="default">Default</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-6 text-sm text-gray-600">
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              Response:{" "}
                              {Math.floor(sla.response_time_minutes / 60)}h{" "}
                              {sla.response_time_minutes % 60}m
                            </div>
                            <div className="flex items-center gap-1">
                              <Target className="h-4 w-4" />
                              Resolution:{" "}
                              {Math.floor(
                                sla.resolution_time_minutes / 60,
                              )}h {sla.resolution_time_minutes % 60}m
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link
                              href={
                                `/settings/clients/${client.id}/sla/${sla.id}/edit` as any
                              }
                            >
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <Target className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                  <h3 className="mb-2 text-lg font-medium">
                    No SLA policies yet
                  </h3>
                  <p className="mb-4 text-gray-600">
                    Set up service level agreements to manage response and
                    resolution times.
                  </p>
                  <Button asChild>
                    <Link href={`/settings/clients/${client.id}/sla/add`}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create First SLA Policy
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Portal Access Tab */}
          <TabsContent value="portal" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Portal Access</h2>
                <p className="text-gray-600">
                  Manage customer portal access for this client
                </p>
              </div>
              <Button asChild>
                <Link href={`/settings/clients/${client.id}/portal`}>
                  <Users className="mr-2 h-4 w-4" />
                  Manage Portal Access
                </Link>
              </Button>
            </div>

            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <Globe className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                  <h3 className="mb-2 text-lg font-medium">
                    Portal Management
                  </h3>
                  <p className="mb-4 text-gray-600">
                    Click the button above to manage portal access, magic links,
                    and user permissions.
                  </p>
                  {client.portal_enabled && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        const portalUrl = `${window.location.origin}/portal/${client.company?.slug}/${client.slug}`;
                        window.open(portalUrl, "_blank");
                      }}
                    >
                      <Globe className="mr-2 h-4 w-4" />
                      View Portal
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Forms Tab */}
          <TabsContent value="forms" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Forms</h2>
                <p className="text-gray-600">
                  Manage custom forms for this client
                </p>
              </div>
              <Button asChild>
                <Link href={`/form-builder/new?clientId=${client.id}`}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Form
                </Link>
              </Button>
            </div>

            <Card>
              <CardContent className="p-6">
                {!formsData?.forms || formsData.forms.length === 0 ? (
                  <div className="py-8 text-center">
                    <Activity className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                    <h3 className="mb-2 text-lg font-medium">No forms yet</h3>
                    <p className="mb-4 text-gray-600">
                      Create custom forms to collect data from this client
                    </p>
                    <Button asChild>
                      <Link href={`/form-builder/new?clientId=${client.id}`}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create First Form
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formsData.forms.map((form: any) => (
                      <div
                        key={form.id}
                        className="flex items-center justify-between border-b pb-4 last:border-0"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{form.name}</h4>
                            {form.is_published ? (
                              <Badge variant="default">Published</Badge>
                            ) : (
                              <Badge variant="secondary">Draft</Badge>
                            )}
                          </div>
                          {form.description && (
                            <p className="mt-1 text-sm text-gray-600">
                              {form.description}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-gray-500">
                            Created{" "}
                            {formatRelativeTime(new Date(form.created_at))}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/form-builder/${form.id}`}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </Link>
                          </Button>
                          {form.is_published && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openFormInNewTab(form.slug)}
                              title="View published form"
                            >
                              <Globe className="mr-2 h-4 w-4" />
                              View Form
                            </Button>
                          )}
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/form-builder/${form.id}/submissions`}>
                              View Submissions
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteForm(form.id, form.name)}
                            className="text-destructive hover:text-destructive"
                            title="Delete form"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Client Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the client &quot;{client.name}&quot;
              and all associated data including tickets, forms, and portal
              access. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate({ id: clientId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Form Confirmation Dialog */}
      <AlertDialog
        open={deleteFormDialogOpen}
        onOpenChange={setDeleteFormDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Form?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the form &quot;{formToDelete?.name}
              &quot; and all its submissions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setFormToDelete(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteForm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
