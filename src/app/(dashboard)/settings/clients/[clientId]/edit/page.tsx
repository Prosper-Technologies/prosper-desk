"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { ArrowLeft, Save, Building, Globe, Shield } from "lucide-react";
import { api } from "~/trpc/react";
import { toast } from "sonner";

export default function EditClientPage() {
  const router = useRouter();
  const params = useParams();
  const clientId = params?.clientId as string;

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    email_domains: "",
    description: "",
    is_active: true,
    portal_enabled: true,
    logo_url: "",
  });

  const { data: client, isLoading } = api.client.getById.useQuery({
    id: clientId,
  });

  const updateClient = api.client.update.useMutation({
    onSuccess: () => {
      toast.success("Client updated successfully", {
        description: "Client updated successfully",
      });
      router.push(`/settings/clients/${clientId}`);
    },
    onError: (error) => {
      toast.error(error.message, {
        description: error.message,
      });
    },
  });

  useEffect(() => {
    if (client) {
      setFormData({
        name: client.name,
        slug: client.slug,
        email_domains: client.email_domains?.join(", ") || "",
        description: client.description || "",
        is_active: client.is_active,
        portal_enabled: client.portal_enabled,
        logo_url: client.logo_url || "",
      });
    }
  }, [client]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateClient.mutate({
      id: clientId,
      ...formData,
      email_domains: formData.email_domains?.split(", ") || [],
      description: formData.description || undefined,
      logo_url: formData.logo_url || undefined,
    });
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
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
              <BreadcrumbLink href={`/settings/clients/${client.id}`}>
                {client.name}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Edit</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="space-y-6 p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/settings/clients/${client.id}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>

            <div>
              <h1 className="text-xl font-bold">Edit Client</h1>
              <p className="text-gray-600">
                Update client information and settings
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Client Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter client name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">Portal Slug *</Label>
                  <Input
                    id="slug"
                    name="slug"
                    value={formData.slug}
                    onChange={handleInputChange}
                    placeholder="client-portal-url"
                    required
                  />
                  <p className="text-xs text-gray-500">
                    This will be used in the portal URL: /portal/{formData.slug}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logo_url">Logo URL</Label>
                <Input
                  id="logo_url"
                  name="logo_url"
                  type="url"
                  value={formData.logo_url}
                  onChange={handleInputChange}
                  placeholder="https://example.com/logo.png"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="Brief description of the client"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email_domain">Restrict Email Domains</Label>
                <Input
                  id="email_domains"
                  name="email_domains"
                  value={formData?.email_domains}
                  onChange={handleInputChange}
                  placeholder="example.com (optional)"
                />
                <p className="text-xs text-gray-500">
                  If specified, only users with emails from this domain can
                  access the portal
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Portal Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Portal Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Client Status</Label>
                  <p className="text-sm text-gray-600">
                    Enable or disable this client
                  </p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    handleSwitchChange("is_active", checked)
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Portal Access</Label>
                  <p className="text-sm text-gray-600">
                    Allow customers to access the support portal
                  </p>
                </div>
                <Switch
                  checked={formData.portal_enabled}
                  onCheckedChange={(checked) =>
                    handleSwitchChange("portal_enabled", checked)
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={updateClient.isPending}
              className="flex-1 md:flex-initial"
            >
              <Save className="mr-2 h-4 w-4" />
              {updateClient.isPending ? "Saving..." : "Save Changes"}
            </Button>

            <Button variant="outline" asChild>
              <Link href={`/settings/clients/${client.id}`}>Cancel</Link>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
