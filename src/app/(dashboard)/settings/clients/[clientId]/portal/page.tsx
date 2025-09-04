"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
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
import {
  ArrowLeft,
  Users,
  Plus,
  MoreHorizontal,
  Mail,
  Clock,
  Copy,
  ExternalLink,
  UserX,
  AlertCircle,
  Check,
  Shield,
  RefreshCw,
} from "lucide-react";
import { api } from "~/trpc/react";
import { formatDateTime } from "~/lib/utils";

export default function ClientPortalAccessPage() {
  const params = useParams();
  const clientId = params?.clientId as string;

  const [createAccessOpen, setCreateAccessOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [expiration, setExpiration] = useState<string>("never");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [generatedAccess, setGeneratedAccess] = useState<{
    accessToken: string;
    portalUrl: string;
    message: string;
  } | null>(null);
  const [updateExpOpen, setUpdateExpOpen] = useState<string | null>(null);
  const [updateExpiration, setUpdateExpiration] = useState<string>("never");

  // Get client details
  const { data: client } = api.clients.getById.useQuery({ id: clientId });

  // Get portal access list
  const { data: portalAccess, refetch } = api.clients.getPortalAccess.useQuery({
    clientId,
  });

  // Generate portal access mutation
  const generateAccess = api.clients.generatePortalAccess.useMutation({
    onSuccess: (data) => {
      setGeneratedAccess(data);
      setError("");
      refetch();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  // Revoke access mutation
  const revokeAccess = api.clients.revokePortalAccess.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  // Delete access mutation
  const deleteAccess = api.clients.deletePortalAccess.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  // Regenerate token mutation (reuses generatePortalAccess with existing user data)
  const regenerateToken = api.clients.generatePortalAccess.useMutation({
    onSuccess: (data) => {
      setGeneratedAccess(data);
      setError("");
      refetch();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  // Update expiration mutation
  const updateExpirationMutation =
    api.clients.updatePortalAccessExpiration.useMutation({
      onSuccess: () => {
        setUpdateExpOpen(null);
        setUpdateExpiration("never");
        refetch();
      },
      onError: (err) => {
        setError(err.message);
      },
    });

  const handleGenerateAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !name.trim()) {
      setError("Email and name are required");
      return;
    }

    await generateAccess.mutateAsync({
      clientId,
      email: email.trim(),
      name: name.trim(),
      expiration,
    });
  };

  const handleCloseAccessModal = (open: boolean) => {
    setCreateAccessOpen(open);
    if (!open) {
      setGeneratedAccess(null);
      setEmail("");
      setName("");
      setError("");
      setExpiration("never");
    }
  };

  const handleOpenAccessModal = () => {
    setCreateAccessOpen(true);
  };

  const copyToClipboard = (text: string, type: "token" | "url") => {
    navigator.clipboard.writeText(text);
    setCopiedToken(type);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleRevokeAccess = (accessId: string) => {
    if (
      confirm(
        "Are you sure you want to revoke this access? The user will no longer be able to access the portal with their current link.",
      )
    ) {
      revokeAccess.mutateAsync({ accessId });
    }
  };

  const handleDeleteAccess = (accessId: string) => {
    if (
      confirm(
        "Are you sure you want to permanently delete this access? This action cannot be undone and will completely remove the record from the database.",
      )
    ) {
      deleteAccess.mutateAsync({ accessId });
    }
  };

  const handleRegenerateToken = (access: any) => {
    if (
      confirm(
        "Are you sure you want to regenerate the token? The current token will be invalidated and a new one will be created.",
      )
    ) {
      regenerateToken.mutateAsync({
        clientId,
        email: access.email,
        name: access.name,
        expiration: "never", // Default to never expires for regenerated tokens
      });
    }
  };

  const openUpdateExpiration = (accessId: string) => {
    setUpdateExpOpen(accessId);
    setUpdateExpiration("never");
  };

  const submitUpdateExpiration = () => {
    if (!updateExpOpen) return;
    updateExpirationMutation.mutate({
      accessId: updateExpOpen,
      expiration: updateExpiration,
    });
  };

  const handleCopyTokenUrl = (
    accessToken: string,
    clientSlug: string,
    companySlug: string,
  ) => {
    const portalUrl = `${window.location.origin}/portal/${companySlug}/${clientSlug}/auth?token=${accessToken}`;
    navigator.clipboard.writeText(portalUrl);
    setCopiedToken(accessToken);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  if (!client) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-4 w-4 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
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
              <BreadcrumbPage>Portal Access - {client.name}</BreadcrumbPage>
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
              <Users />
              Portal Access Management
            </h1>
            <p className="text-sm text-gray-600">
              Manage customer portal access for {client.name}
            </p>
          </div>
        </div>

        {/* Client Info */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="mb-2 text-xl font-semibold">{client.name}</h2>
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <span>
                    Portal URL: /portal/{client.company?.slug}/{client.slug}
                  </span>
                  {client.email_domains && (
                    <div className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      Restricted to {client.email_domains.join(", ")}
                    </div>
                  )}
                  <Badge
                    variant={client.portal_enabled ? "default" : "secondary"}
                  >
                    {client.portal_enabled
                      ? "Portal Enabled"
                      : "Portal Disabled"}
                  </Badge>
                </div>
              </div>
              {client.portal_enabled && (
                <Dialog
                  open={createAccessOpen}
                  onOpenChange={handleCloseAccessModal}
                >
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="mr-2 h-4 w-4" />
                      Grant Access
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>
                        {generatedAccess
                          ? "Portal Access Generated!"
                          : "Grant Portal Access"}
                      </DialogTitle>
                    </DialogHeader>

                    {!generatedAccess ? (
                      <form
                        onSubmit={handleGenerateAccess}
                        className="space-y-4"
                      >
                        <div className="space-y-2">
                          <label htmlFor="name" className="text-sm font-medium">
                            Customer Name *
                          </label>
                          <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="John Doe"
                            required
                            disabled={generateAccess.isPending}
                          />
                        </div>

                        <div className="space-y-2">
                          <label
                            htmlFor="email"
                            className="text-sm font-medium"
                          >
                            Email Address *
                          </label>
                          <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="john@example.com"
                            required
                            disabled={generateAccess.isPending}
                          />
                          {client.email_domains && (
                            <p className="text-xs text-gray-500">
                              Must be from domain:{" "}
                              {client.email_domains.join(", ")}
                            </p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <label
                            htmlFor="expiration"
                            className="text-sm font-medium"
                          >
                            Access Expiration
                          </label>
                          <Select
                            value={expiration}
                            onValueChange={setExpiration}
                            disabled={generateAccess.isPending}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select expiration" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1_day">1 Day</SelectItem>
                              <SelectItem value="1_week">1 Week</SelectItem>
                              <SelectItem value="1_month">1 Month</SelectItem>
                              <SelectItem value="1_year">1 Year</SelectItem>
                              <SelectItem value="never">
                                Never Expires
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-gray-500">
                            How long the access token should remain valid
                          </p>
                        </div>

                        {error && (
                          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <p className="text-sm text-red-700">{error}</p>
                          </div>
                        )}

                        <DialogFooter>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => handleCloseAccessModal(false)}
                            disabled={generateAccess.isPending}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            disabled={generateAccess.isPending}
                          >
                            {generateAccess.isPending
                              ? "Generating..."
                              : "Generate Access Token"}
                          </Button>
                        </DialogFooter>
                      </form>
                    ) : (
                      <div className="space-y-6">
                        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
                          <Check className="h-4 w-4 text-green-600" />
                          <p className="text-sm text-green-700">
                            {generatedAccess.message}
                          </p>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">
                              Access Token
                            </label>
                            <div className="flex items-center gap-2">
                              <Input
                                value={generatedAccess.accessToken}
                                readOnly
                                className="font-mono text-sm"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  copyToClipboard(
                                    generatedAccess.accessToken,
                                    "token",
                                  )
                                }
                              >
                                {copiedToken === "token" ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            <p className="text-xs text-gray-500">
                              Share this token with the customer. They will use
                              it to access the portal.
                            </p>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">
                              Portal URL
                            </label>
                            <div className="flex items-center gap-2">
                              <Input
                                value={generatedAccess.portalUrl}
                                readOnly
                                className="text-sm"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  copyToClipboard(
                                    generatedAccess.portalUrl,
                                    "url",
                                  )
                                }
                              >
                                {copiedToken === "url" ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                            <p className="text-xs text-gray-500">
                              Direct link with token included. Customer can
                              click this to access the portal immediately.
                            </p>
                          </div>

                          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                            <h4 className="mb-2 text-sm font-medium text-blue-800">
                              Next Steps:
                            </h4>
                            <ul className="space-y-1 text-xs text-blue-700">
                              <li>
                                • Send the access token or direct URL to the
                                customer
                              </li>
                              <li>
                                • The token provides permanent access to the
                                portal
                              </li>
                              <li>
                                • Customer can bookmark the URL for future
                                access
                              </li>
                              <li>
                                • You can revoke access at any time from this
                                page
                              </li>
                            </ul>
                          </div>
                        </div>

                        <DialogFooter>
                          <Button
                            onClick={() => handleCloseAccessModal(false)}
                            className="w-full"
                          >
                            Done
                          </Button>
                        </DialogFooter>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardContent>
        </Card>

        {!client.portal_enabled && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <div>
                  <h3 className="font-medium text-yellow-800">
                    Portal Disabled
                  </h3>
                  <p className="text-sm text-yellow-700">
                    The customer portal is currently disabled for this client.
                    Enable it in client settings to grant access.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Access List */}
        <Card>
          <CardHeader>
            <CardTitle>Portal Access ({portalAccess?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {!portalAccess || portalAccess.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                <h3 className="mb-2 text-lg font-medium text-gray-900">
                  No portal access granted
                </h3>
                <p className="mb-4 text-gray-600">
                  No customers have been granted access to the portal yet.
                </p>
                {client.portal_enabled && (
                  <Button onClick={handleOpenAccessModal}>
                    <Plus className="mr-2 h-4 w-4" />
                    Grant first access
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {portalAccess.map((access) => (
                  <div
                    key={access.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div>
                        <h3 className="flex items-center gap-2 font-medium">
                          {access.name}
                          <Badge
                            variant={access.is_active ? "default" : "secondary"}
                          >
                            {access.is_active ? "Active" : "Revoked"}
                          </Badge>
                          {access.last_login_at &&
                            new Date(access.last_login_at) < new Date() && (
                              <Badge variant="secondary">Expired</Badge>
                            )}
                        </h3>
                        <div className="mt-1 flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {access.email}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Created {formatDateTime(access.created_at)}
                          </div>
                          {access.expires_at ? (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Expires {formatDateTime(access.expires_at)}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Never expires
                            </div>
                          )}
                          {access.last_login_at && (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Last login {formatDateTime(access.last_login_at)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {access.is_active && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleCopyTokenUrl(
                              access.access_token,
                              client.slug,
                              client.company?.slug || "",
                            )
                          }
                        >
                          {copiedToken === access.access_token ? (
                            <Check className="mr-2 h-4 w-4" />
                          ) : (
                            <Copy className="mr-2 h-4 w-4" />
                          )}
                          {copiedToken === access.access_token
                            ? "Copied!"
                            : "Copy Link"}
                        </Button>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          {access.is_active && (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  handleCopyTokenUrl(
                                    access.access_token,
                                    client.slug,
                                    client.company?.slug || "",
                                  )
                                }
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Copy Token Link
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  const portalUrl = `${window.location.origin}/portal/${client.company?.slug}/${client.slug}/auth?token=${access.access_token}`;
                                  window.open(portalUrl, "_blank");
                                }}
                              >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open Portal
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleRegenerateToken(access)}
                              >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Regenerate Token
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => openUpdateExpiration(access.id)}
                              >
                                <Clock className="mr-2 h-4 w-4" />
                                Update Expiration
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleRevokeAccess(access.id)}
                                className="text-orange-600"
                              >
                                <UserX className="mr-2 h-4 w-4" />
                                Revoke Access
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteAccess(access.id)}
                                className="text-red-600"
                              >
                                <UserX className="mr-2 h-4 w-4" />
                                Delete Permanently
                              </DropdownMenuItem>
                            </>
                          )}
                          {!access.is_active && (
                            <>
                              <DropdownMenuItem
                                onClick={() => handleRegenerateToken(access)}
                              >
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Grant Access Again
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteAccess(access.id)}
                                className="text-red-600"
                              >
                                <UserX className="mr-2 h-4 w-4" />
                                Delete Permanently
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Update Expiration Dialog */}
      <Dialog
        open={!!updateExpOpen}
        onOpenChange={(open) => setUpdateExpOpen(open ? updateExpOpen : null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update access expiration</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Expiration</label>
            <Select
              value={updateExpiration}
              onValueChange={setUpdateExpiration}
              disabled={updateExpirationMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select expiration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1_day">1 Day</SelectItem>
                <SelectItem value="1_week">1 Week</SelectItem>
                <SelectItem value="1_month">1 Month</SelectItem>
                <SelectItem value="1_year">1 Year</SelectItem>
                <SelectItem value="never">Never Expires</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUpdateExpOpen(null)}
              disabled={updateExpirationMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={submitUpdateExpiration}
              disabled={updateExpirationMutation.isPending}
            >
              {updateExpirationMutation.isPending ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
