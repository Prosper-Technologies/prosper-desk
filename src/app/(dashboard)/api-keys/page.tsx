"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { DashboardHeader } from "~/components/layout/dashboard-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Key,
  Plus,
  Copy,
  MoreHorizontal,
  Trash2,
  Calendar,
  Shield,
  AlertCircle,
  CheckCircle,
  X,
} from "lucide-react";
import { api } from "~/trpc/react";

export default function ApiKeysPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{
    id: string;
    key: string;
    name: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const {
    data: apiKeys = [],
    isLoading,
    refetch,
  } = api.apiKeys.getAll.useQuery();

  const createApiKey = api.apiKeys.create.useMutation({
    onSuccess: (data) => {
      refetch();
      setShowCreateDialog(false);
      setNewlyCreatedKey({
        id: data.id!,
        key: data.key,
        name: data.name!,
      });
      setNewKeyName("");
    },
  });

  const deleteApiKey = api.apiKeys.delete.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleCreateKey = () => {
    if (!newKeyName.trim()) return;
    createApiKey.mutate({ name: newKeyName.trim() });
  };

  const handleDeleteKey = (keyId: string) => {
    deleteApiKey.mutate({ id: keyId });
  };

  const copyToClipboard = async (text: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(keyId);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const dismissNewKey = () => {
    setNewlyCreatedKey(null);
  };

  return (
    <div className="space-y-6">
      <DashboardHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "API Keys" },
        ]}
        showSidebarTrigger
      />

      <div className="space-y-6 p-4">
        {/* New API Key Alert */}
        {newlyCreatedKey && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <h3 className="font-medium text-green-900">
                      API Key Created Successfully
                    </h3>
                  </div>
                  <p className="text-sm text-green-700">
                    Your new API key "{newlyCreatedKey.name}" has been created.
                    Copy it now - you won't be able to see it again!
                  </p>
                  <div className="flex items-center gap-2 rounded-md bg-green-100 p-3">
                    <code className="flex-1 font-mono text-sm text-green-900">
                      {newlyCreatedKey.key}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        copyToClipboard(newlyCreatedKey.key, newlyCreatedKey.id)
                      }
                      className="border-green-300 text-green-700 hover:bg-green-200"
                    >
                      {copiedKey === newlyCreatedKey.id ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={dismissNewKey}
                  className="text-green-600 hover:text-green-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold">
              <Key className="h-5 w-5" />
              API Keys
            </h1>
            <p className="text-gray-600">
              Manage API keys for programmatic access to your helpdesk
            </p>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create API Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New API Key</DialogTitle>
                <DialogDescription>
                  Give your API key a descriptive name to help you identify its
                  purpose.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="keyName">API Key Name</Label>
                  <Input
                    id="keyName"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g., Mobile App, Integration Server"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateKey}
                  disabled={!newKeyName.trim() || createApiKey.isPending}
                >
                  {createApiKey.isPending ? "Creating..." : "Create API Key"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total API Keys</p>
                  <p className="text-lg font-bold">{apiKeys.length}</p>
                </div>
                <Key className="h-4 w-4 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Keys</p>
                  <p className="text-lg font-bold">
                    {apiKeys.filter((key) => key.is_active).length}
                  </p>
                </div>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Last Used</p>
                  <p className="text-lg font-bold">
                    {apiKeys.some((key) => key.last_used_at)
                      ? "Recently"
                      : "Never"}
                  </p>
                </div>
                <Calendar className="h-4 w-4 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* API Keys List */}
        <Card>
          <CardHeader>
            <CardTitle>API Keys ({apiKeys.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="py-12 text-center">
                <Key className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                <h3 className="mb-2 text-lg font-medium text-gray-900">
                  No API keys yet
                </h3>
                <p className="mb-4 text-gray-600">
                  Create your first API key to start using the API
                </p>
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First API Key
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {apiKeys.map((apiKey) => (
                  <div
                    key={apiKey.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-sm"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{apiKey.name}</h3>
                        <Badge
                          variant={apiKey.is_active ? "default" : "secondary"}
                        >
                          {apiKey.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Shield className="h-3 w-3" />
                          Key: {apiKey.prefix}••••••••••••••••••••••••••••
                        </div>
                        <div className="text-xs text-orange-600">
                          Hidden for security
                        </div>
                      </div>

                      <div className="text-xs text-gray-500">
                        Created:{" "}
                        {new Date(apiKey.created_at).toLocaleDateString()}
                        {apiKey.last_used_at && (
                          <span className="ml-4">
                            Last used:{" "}
                            {new Date(apiKey.last_used_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Key
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Delete API Key?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will
                                permanently delete the API key "{apiKey.name}"
                                and any applications using it will stop working.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteKey(apiKey.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete Key
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* API Documentation Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              API Documentation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                  <span className="text-sm font-medium text-blue-600">1</span>
                </div>
                <div>
                  <p className="font-medium">Authentication</p>
                  <p className="text-sm text-gray-600">
                    Include your API key in the Authorization header: Bearer
                    your-api-key
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                  <span className="text-sm font-medium text-blue-600">2</span>
                </div>
                <div>
                  <p className="font-medium">Base URL</p>
                  <p className="text-sm text-gray-600">
                    All API requests should be made to:{" "}
                    {typeof window !== "undefined"
                      ? window.location.origin
                      : ""}
                    /api/v1
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                  <span className="text-sm font-medium text-blue-600">3</span>
                </div>
                <div>
                  <p className="font-medium">Rate Limits</p>
                  <p className="text-sm text-gray-600">
                    API calls are limited to 1000 requests per hour per API key
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-lg bg-yellow-50 p-4">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 flex-shrink-0 text-yellow-600" />
                <div>
                  <p className="font-medium text-yellow-800">
                    Security Best Practices
                  </p>
                  <ul className="mt-1 space-y-1 text-sm text-yellow-700">
                    <li>
                      • Keep your API keys secure and never share them publicly
                    </li>
                    <li>
                      • Use different keys for different applications or
                      environments
                    </li>
                    <li>• Rotate your keys regularly for enhanced security</li>
                    <li>• Delete unused keys to minimize security risks</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
