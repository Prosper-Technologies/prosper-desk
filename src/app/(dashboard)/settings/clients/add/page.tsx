"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Switch } from "~/components/ui/switch";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import {
  ArrowLeft,
  Building,
  Globe,
  Shield,
  AlertCircle,
  Check,
} from "lucide-react";
import { api } from "~/trpc/react";

export default function AddClientPage() {
  const { data: company, isLoading: companyLoading } =
    api.company.getSettings.useQuery();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [emailDomain, setEmailDomain] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [portalEnabled, setPortalEnabled] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const router = useRouter();

  const createClient = api.clients.create.useMutation({
    onSuccess: (client) => {
      setSuccess(`${client.name} has been created successfully!`);
      setTimeout(() => {
        router.push(`/settings/clients/${client.id}`);
      }, 2000);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  // Auto-generate slug from name
  const handleNameChange = (value: string) => {
    setName(value);
    if (!slug || slug === generateSlug(name)) {
      setSlug(generateSlug(value));
    }
  };

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name.trim() || !slug.trim()) {
      setError("Name and slug are required");
      return;
    }

    await createClient.mutateAsync({
      name: name.trim(),
      slug: slug.trim(),
      email_domains: emailDomain.split(",").map((domain) => domain.trim()),
      description: description.trim() || undefined,
      logo_url: logoUrl.trim() || undefined,
      portal_enabled: portalEnabled,
    });
  };

  if (success) {
    return (
      <div className="space-y-6">
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
                <BreadcrumbPage>Add Client</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <div className="p-4">
          <Card className="mx-auto max-w-md">
            <CardContent className="pt-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="mb-2 text-lg font-medium text-gray-900">
                Success!
              </h3>
              <p className="mb-4 text-gray-600">{success}</p>
              <Button asChild className="w-full">
                <Link href="/settings">Return to Settings</Link>
              </Button>
            </CardContent>
          </Card>
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
              <BreadcrumbPage>Add Client</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="space-y-6 p-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/settings">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Settings
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-bold">
              <Building />
              Add Client
            </h1>
            <p className="text-sm text-gray-600">
              Create a new client organization for ticket management
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Client Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Information */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-sm font-medium">
                      Client Name *
                    </label>
                    <Input
                      id="name"
                      placeholder="Acme Corporation"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      disabled={createClient.isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="slug" className="text-sm font-medium">
                      URL Slug *
                    </label>
                    <div className="relative">
                      <Input
                        id="slug"
                        placeholder="acme-corp"
                        value={slug}
                        onChange={(e) => setSlug(generateSlug(e.target.value))}
                        disabled={createClient.isPending}
                      />
                    </div>
                    <p className="text-xs text-gray-500">
                      Used in the portal URL: /portal/
                      {company?.slug || "company"}/{slug}
                    </p>
                  </div>
                </div>

                {/* Email Domain */}
                <div className="space-y-2">
                  <label htmlFor="emailDomain" className="text-sm font-medium">
                    Email Domains (Optional)
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
                    <Input
                      id="emailDomain"
                      placeholder="@acmecorp.com"
                      value={emailDomain}
                      onChange={(e) => setEmailDomain(e.target.value)}
                      disabled={createClient.isPending}
                      className="pl-10"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Use comma to separate multiple email domains. Restrict portal access to users with this email domain
                  </p>
                </div>

                {/* Logo URL */}
                <div className="space-y-2">
                  <label htmlFor="logoUrl" className="text-sm font-medium">
                    Logo URL (Optional)
                  </label>
                  <Input
                    id="logoUrl"
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    disabled={createClient.isPending}
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <label htmlFor="description" className="text-sm font-medium">
                    Description (Optional)
                  </label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the client..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={createClient.isPending}
                    rows={3}
                  />
                </div>

                {/* Portal Settings */}
                <div className="rounded-lg bg-blue-50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Globe className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-medium text-blue-900">
                          Enable Customer Portal
                        </p>
                        <p className="text-sm text-blue-700">
                          Allow customers to access tickets via web portal
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={portalEnabled}
                      onCheckedChange={setPortalEnabled}
                      disabled={createClient.isPending}
                    />
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    asChild
                    disabled={createClient.isPending}
                  >
                    <Link href="/settings">Cancel</Link>
                  </Button>
                  <Button type="submit" disabled={createClient.isPending}>
                    {createClient.isPending ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                        Creating Client...
                      </>
                    ) : (
                      <>
                        <Building className="mr-2 h-4 w-4" />
                        Create Client
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
