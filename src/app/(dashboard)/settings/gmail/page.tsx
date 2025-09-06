"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { SidebarTrigger } from "~/components/ui/sidebar";
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
  Mail,
  CheckCircle,
  XCircle,
  RefreshCw,
  Settings,
  ExternalLink,
  RotateCcw,
  AlertCircle,
  Bell,
} from "lucide-react";
import { api } from "~/trpc/react";

export default function GmailSetupPage() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [syncResult, setRotateCcwResult] = useState<string>("");
  const [processedCode, setProcessedCode] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const { data: integration, refetch: refetchIntegration } =
    api.gmail.getIntegration.useQuery();

  const setupIntegration = api.gmail.setupIntegration.useMutation({
    onSuccess: () => {
      refetchIntegration();
      setIsConnecting(false);
      // Clean up URL
      router.replace("/settings/gmail");
    },
    onError: (error) => {
      console.error("Gmail setup failed:", error);
      setIsConnecting(false);
    },
  });

  const getAuthUrl = api.gmail.getAuthUrl.useQuery(undefined, {
    enabled: false,
  });

  const testConnection = api.gmail.testConnection.useMutation();
  const disableIntegration = api.gmail.disableIntegration.useMutation({
    onSuccess: () => {
      refetchIntegration();
    },
  });

  const syncEmails = api.gmail.syncEmails.useMutation({
    onSuccess: (data) => {
      setRotateCcwResult(
        `Processed ${data.messagesProcessed} messages, created ${data.ticketsCreated} new tickets`,
      );
      refetchIntegration();
    },
  });

  const setupPushNotifications = api.gmail.setupPushNotifications.useMutation({
    onSuccess: (data) => {
      setRotateCcwResult(
        `Push notifications enabled! History ID: ${data.historyId}`,
      );
      refetchIntegration();
    },
  });

  const subscribeToWebhook = api.gmail.subscribeToWebhook.useMutation();
  const unsubscribeFromWebhook = api.gmail.unsubscribeFromWebhook.useMutation();

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams?.get("code");
    const state = searchParams?.get("state");

    // Only process the code once and if it's different from the last processed one
    if (code && code !== processedCode && !setupIntegration.isPending) {
      setProcessedCode(code);
      setIsConnecting(true);
      setupIntegration.mutate({ code, state: state || undefined });
    }
  }, [searchParams, setupIntegration, processedCode]);

  const handleConnect = async () => {
    try {
      const authData = await getAuthUrl.refetch();
      if (authData.data?.authUrl) {
        window.location.href = authData.data.authUrl;
      }
    } catch (error) {
      console.error("Failed to get auth URL:", error);
    }
  };

  const handleTest = () => {
    testConnection.mutate();
  };

  const handleDisable = () => {
    disableIntegration.mutate();
  };

  const handleRotateCcw = () => {
    setRotateCcwResult("");
    syncEmails.mutate();
  };

  const handleSubscribeWebhook = () => {
    subscribeToWebhook.mutate();
  };

  const handleUnsubscribeWebhook = () => {
    unsubscribeFromWebhook.mutate();
  };

  const isConnected = integration?.is_active;

  return (
    <div className="space-y-6">
      {/* Header with Sidebar Trigger and Breadcrumbs */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
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
                <BreadcrumbLink href="/settings">Settings</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Gmail Integration</BreadcrumbPage>
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
              <Mail className="h-5 w-5" />
              Gmail Integration
            </h1>
            <p className="text-gray-600">
              Automatically convert Gmail emails into support tickets
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <Badge className="border-green-200 bg-green-100 text-green-800">
                <CheckCircle className="mr-1 h-3 w-3" />
                Connected
              </Badge>
            ) : (
              <Badge className="border-red-200 bg-red-100 text-red-800">
                <XCircle className="mr-1 h-3 w-3" />
                Not Connected
              </Badge>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-4xl space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Connection Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isConnected ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-green-600">
                        Gmail Connected
                      </p>
                      <p className="text-sm text-gray-600">
                        Account: {integration.email}
                      </p>
                      {integration.last_sync_at && (
                        <p className="text-sm text-gray-500">
                          Last sync:{" "}
                          {new Date(integration.last_sync_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleTest}
                        disabled={testConnection.isPending}
                      >
                        {testConnection.isPending ? (
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="mr-2 h-4 w-4" />
                        )}
                        Test Connection
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            Disconnect
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Disconnect Gmail?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will stop automatic email-to-ticket
                              conversion. Existing tickets won't be affected.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDisable}>
                              Disconnect
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {testConnection.isSuccess && (
                    <div className="rounded-lg bg-green-50 p-3">
                      <p className="text-sm text-green-600">
                        ✓ Connection successful! Messages:{" "}
                        {testConnection.data.messagesTotal}, Threads:{" "}
                        {testConnection.data.threadsTotal}
                      </p>
                    </div>
                  )}

                  {testConnection.error && (
                    <div className="rounded-lg bg-red-50 p-3">
                      <p className="text-sm text-red-600">
                        ✗ Connection failed: {testConnection.error.message}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="py-8 text-center">
                    <Mail className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                    <h3 className="mb-2 text-lg font-medium text-gray-900">
                      Connect Your Gmail Account
                    </h3>
                    <p className="mb-6 text-gray-600">
                      Authorize access to your Gmail account to start converting
                      emails into tickets
                    </p>
                    <Button
                      onClick={handleConnect}
                      disabled={isConnecting || setupIntegration.isPending}
                    >
                      {isConnecting || setupIntegration.isPending ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Connect Gmail
                        </>
                      )}
                    </Button>
                  </div>

                  {setupIntegration.error && (
                    <div className="rounded-lg bg-red-50 p-3">
                      <p className="text-sm text-red-600">
                        Setup failed: {setupIntegration.error.message}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Email RotateCcw Section */}
          {isConnected && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RotateCcw className="h-5 w-5" />
                  Email RotateCcwhronization
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">RotateCcw Recent Emails</p>
                      <p className="text-sm text-gray-600">
                        Convert unread emails from the last 7 days into tickets
                      </p>
                    </div>
                    <Button
                      onClick={handleRotateCcw}
                      disabled={syncEmails.isPending}
                    >
                      {syncEmails.isPending ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          RotateCcwing...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="mr-2 h-4 w-4" />
                          RotateCcw Now
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Enable Real-time Replies</p>
                      <p className="text-sm text-gray-600">
                        Automatically add email replies as ticket comments
                      </p>
                    </div>
                    <Button
                      onClick={() => setupPushNotifications.mutate()}
                      disabled={setupPushNotifications.isPending}
                      variant="outline"
                    >
                      {setupPushNotifications.isPending ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Enabling...
                        </>
                      ) : (
                        <>
                          <Bell className="mr-2 h-4 w-4" />
                          Enable Push Notifications
                        </>
                      )}
                    </Button>
                  </div>

                  {syncResult && (
                    <div className="rounded-lg bg-blue-50 p-3">
                      <p className="text-sm text-blue-600">{syncResult}</p>
                    </div>
                  )}

                  {syncEmails.error && (
                    <div className="rounded-lg bg-red-50 p-3">
                      <p className="text-sm text-red-600">
                        RotateCcw failed: {syncEmails.error.message}
                      </p>
                    </div>
                  )}

                  {setupPushNotifications.error && (
                    <div className="rounded-lg bg-red-50 p-3">
                      <p className="text-sm text-red-600">
                        Push notifications setup failed: {setupPushNotifications.error.message}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Webhook Testing Section */}
          {isConnected && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Webhook Testing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Test Webhook Subscription</p>
                      <p className="text-sm text-gray-600">
                        Subscribe to Gmail push notifications for real-time email processing
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSubscribeWebhook}
                        disabled={subscribeToWebhook.isPending}
                        size="sm"
                      >
                        {subscribeToWebhook.isPending ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Subscribing...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Subscribe to Webhook
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={handleUnsubscribeWebhook}
                        disabled={unsubscribeFromWebhook.isPending}
                        variant="outline"
                        size="sm"
                      >
                        {unsubscribeFromWebhook.isPending ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Unsubscribing...
                          </>
                        ) : (
                          <>
                            <XCircle className="mr-2 h-4 w-4" />
                            Unsubscribe
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {subscribeToWebhook.isSuccess && (
                    <div className="rounded-lg bg-green-50 p-3">
                      <p className="text-sm text-green-600">
                        ✓ Webhook subscription successful! 
                        History ID: {subscribeToWebhook.data.historyId}
                        {subscribeToWebhook.data.expiration && (
                          <>, Expires: {new Date(parseInt(subscribeToWebhook.data.expiration)).toLocaleString()}</>
                        )}
                      </p>
                    </div>
                  )}

                  {subscribeToWebhook.error && (
                    <div className="rounded-lg bg-red-50 p-3">
                      <p className="text-sm text-red-600">
                        ✗ Webhook subscription failed: {subscribeToWebhook.error.message}
                      </p>
                    </div>
                  )}

                  {unsubscribeFromWebhook.isSuccess && (
                    <div className="rounded-lg bg-blue-50 p-3">
                      <p className="text-sm text-blue-600">
                        ✓ Webhook unsubscribed successfully
                      </p>
                    </div>
                  )}

                  {unsubscribeFromWebhook.error && (
                    <div className="rounded-lg bg-red-50 p-3">
                      <p className="text-sm text-red-600">
                        ✗ Webhook unsubscribe failed: {unsubscribeFromWebhook.error.message}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* How It Works */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                    <span className="text-sm font-medium text-blue-600">1</span>
                  </div>
                  <div>
                    <p className="font-medium">Email Detection</p>
                    <p className="text-sm text-gray-600">
                      We monitor your Gmail for new unread emails
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                    <span className="text-sm font-medium text-blue-600">2</span>
                  </div>
                  <div>
                    <p className="font-medium">Ticket Creation</p>
                    <p className="text-sm text-gray-600">
                      Each email thread becomes a support ticket automatically
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                    <span className="text-sm font-medium text-blue-600">3</span>
                  </div>
                  <div>
                    <p className="font-medium">Reply RotateCcw</p>
                    <p className="text-sm text-gray-600">
                      Email replies become ticket comments automatically
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-lg bg-yellow-50 p-4">
                <div className="flex gap-2">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-yellow-600" />
                  <div>
                    <p className="font-medium text-yellow-800">
                      Setup Requirements
                    </p>
                    <ul className="mt-1 space-y-1 text-sm text-yellow-700">
                      <li>
                        • You need admin access to configure Gmail integration
                      </li>
                      <li>
                        • The Gmail account must have appropriate permissions
                      </li>
                      <li>
                        • Manual sync is available, automatic sync coming soon
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
