"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  LifeBuoy,
  Plus,
  Clock,
  MessageCircle,
  AlertCircle,
  CheckCircle,
  User,
  Timer,
  Target,
  Activity,
} from "lucide-react";
import { api } from "~/trpc/react";
import {
  formatRelativeTime,
  getStatusColor,
  getPriorityColor,
  getInitials,
} from "~/lib/utils";

interface PortalPageProps {
  params: {
    companySlug: string;
    clientSlug: string;
  };
}

export default function CustomerPortalPage({ params }: PortalPageProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [customerData, setCustomerData] = useState<any>(null);
  const [createTicketOpen, setCreateTicketOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<
    "low" | "medium" | "high" | "urgent"
  >("medium");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [expandedTickets, setExpandedTickets] = useState<Set<string>>(
    new Set(),
  );
  const [newComments, setNewComments] = useState<{
    [ticketId: string]: string;
  }>({});
  const [showTokenPrompt, setShowTokenPrompt] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);

  const searchParams = useSearchParams();

  // Get token from URL or localStorage on mount
  useEffect(() => {
    const urlToken = searchParams.get("token");
    const storageKey = `portal_token_${params.companySlug}_${params.clientSlug}`;
    const storedToken = localStorage.getItem(storageKey);

    if (urlToken) {
      setAccessToken(urlToken);
      localStorage.setItem(storageKey, urlToken);
      // Clean URL by removing token parameter
      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.toString());
    } else if (storedToken) {
      setAccessToken(storedToken);
    } else {
      setShowTokenPrompt(true);
    }
    setIsInitialized(true);
  }, [params.companySlug, params.clientSlug, searchParams]);

  // Verify access token
  const verifyToken = api.customerPortal.verifyToken.useMutation({
    onSuccess: (data) => {
      setIsAuthenticated(true);
      setCustomerData(data);
      setShowTokenPrompt(false);
      setTokenError("");
    },
    onError: (error) => {
      setIsAuthenticated(false);
      setCustomerData(null);
      const storageKey = `portal_token_${params.companySlug}_${params.clientSlug}`;
      localStorage.removeItem(storageKey);
      setTokenError(error.message);
      setShowTokenPrompt(true);
    },
  });

  // Use ref to track if we've already attempted verification for this token
  const verificationAttempted = useRef<string | null>(null);

  // Verify token when we have one
  useEffect(() => {
    if (
      accessToken &&
      !isAuthenticated &&
      !verifyToken.isPending &&
      verificationAttempted.current !== accessToken
    ) {
      verificationAttempted.current = accessToken;
      verifyToken.mutate({
        companySlug: params.companySlug,
        clientSlug: params.clientSlug,
        accessToken,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, isAuthenticated, params.companySlug, params.clientSlug]);

  // Get customer tickets
  const {
    data: tickets,
    refetch: refetchTickets,
    isLoading: ticketsLoading,
  } = api.customerPortal.getCustomerTickets.useQuery(
    {
      companySlug: params.companySlug,
      clientSlug: params.clientSlug,
      accessToken: accessToken || "",
      page: 1,
      limit: 20,
    },
    {
      enabled: isAuthenticated && !!accessToken,
    },
  );

  // Get SLA metrics
  const { data: slaMetrics } = api.customerPortal.getSLAMetrics.useQuery(
    {
      companySlug: params.companySlug,
      clientSlug: params.clientSlug,
      accessToken: accessToken || "",
    },
    {
      enabled: isAuthenticated && !!accessToken,
    },
  );

  // Create ticket mutation
  const createTicket = api.customerPortal.createTicket.useMutation({
    onSuccess: () => {
      setCreateTicketOpen(false);
      setSubject("");
      setDescription("");
      setPriority("medium");
      refetchTickets();
    },
  });

  // Add comment mutation
  const addComment = api.customerPortal.addComment.useMutation({
    onSuccess: (_, variables) => {
      setNewComments((prev) => ({
        ...prev,
        [variables.ticketId]: "",
      }));
      refetchTickets();
    },
  });

  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInput.trim()) return;

    const token = tokenInput.trim();
    setAccessToken(token);
    const storageKey = `portal_token_${params.companySlug}_${params.clientSlug}`;
    localStorage.setItem(storageKey, token);
    setTokenInput("");
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim() || !accessToken) return;

    await createTicket.mutateAsync({
      companySlug: params.companySlug,
      clientSlug: params.clientSlug,
      accessToken: accessToken,
      subject: subject.trim(),
      description: description.trim(),
      priority,
    });
  };

  const toggleTicketExpanded = (ticketId: string) => {
    setExpandedTickets((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(ticketId)) {
        newSet.delete(ticketId);
      } else {
        newSet.add(ticketId);
      }
      return newSet;
    });
  };

  const handleAddComment = async (ticketId: string) => {
    const content = newComments[ticketId]?.trim();
    if (!content || !accessToken) return;

    await addComment.mutateAsync({
      companySlug: params.companySlug,
      clientSlug: params.clientSlug,
      accessToken,
      ticketId,
      content,
    });
  };

  const handleLogout = () => {
    const storageKey = `portal_token_${params.companySlug}_${params.clientSlug}`;
    localStorage.removeItem(storageKey);
    setAccessToken(null);
    setIsAuthenticated(false);
    setCustomerData(null);
    setShowTokenPrompt(true);
    setTokenError("");
  };

  // Token prompt screen
  if (showTokenPrompt) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <LifeBuoy className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Access Portal</CardTitle>
            <p className="text-sm text-gray-600">
              Enter your access token to continue
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTokenSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="token" className="text-sm font-medium">
                  Access Token
                </label>
                <Input
                  id="token"
                  type="text"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Enter your access token"
                  required
                  disabled={verifyToken.isPending}
                  className="font-mono"
                />
                {tokenError && (
                  <p className="text-sm text-red-600">{tokenError}</p>
                )}
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={verifyToken.isPending || !tokenInput.trim()}
              >
                {verifyToken.isPending ? "Verifying..." : "Access Portal"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show loading during initialization, token verification, or initial data loading
  if (
    !isInitialized ||
    verifyToken.isPending ||
    (accessToken && !isAuthenticated && !tokenError) ||
    (isAuthenticated && ticketsLoading)
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <h1 className="mb-2 text-xl font-semibold text-gray-900">
              Access Denied
            </h1>
            <p className="mb-4 text-gray-600">
              Invalid access token. Please check your token and try again.
            </p>
            <Button onClick={() => setShowTokenPrompt(true)}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center">
              <LifeBuoy className="mr-3 h-8 w-8 text-primary" />
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  {customerData?.companyName} Support
                </h1>
                <p className="text-sm text-gray-600">
                  Welcome, {customerData?.customerName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleLogout}>
                Log out
              </Button>
              <Dialog
                open={createTicketOpen}
                onOpenChange={setCreateTicketOpen}
              >
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    New Ticket
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create Support Ticket</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleCreateTicket} className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="subject" className="text-sm font-medium">
                        Subject *
                      </label>
                      <Input
                        id="subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Brief description of your issue"
                        required
                        disabled={createTicket.isPending}
                      />
                    </div>

                    <div className="space-y-2">
                      <label
                        htmlFor="description"
                        className="text-sm font-medium"
                      >
                        Description *
                      </label>
                      <Textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Please describe your issue in detail"
                        required
                        disabled={createTicket.isPending}
                        rows={4}
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="priority" className="text-sm font-medium">
                        Priority
                      </label>
                      <Select
                        value={priority}
                        onValueChange={(value) => setPriority(value as any)}
                        disabled={createTicket.isPending}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {createTicket.error && (
                      <div className="text-sm text-red-600">
                        {createTicket.error.message}
                      </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCreateTicketOpen(false)}
                        disabled={createTicket.isPending}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createTicket.isPending}>
                        {createTicket.isPending
                          ? "Creating..."
                          : "Create Ticket"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-8">
          {/* Welcome Message */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="mb-2 text-lg font-medium text-gray-900">
                    Welcome to our support portal!
                  </h2>
                  <p className="text-gray-600">
                    Here you can view your support tickets, create new ones, and
                    track their progress.
                  </p>
                </div>
                <LifeBuoy className="h-12 w-12 text-primary" />
              </div>
            </CardContent>
          </Card>

          {/* SLA Metrics */}
          {slaMetrics && slaMetrics.totalTickets > 0 && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="rounded-lg bg-blue-100 p-2">
                      <Activity className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">
                        Total Tickets
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {slaMetrics.totalTickets}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="rounded-lg bg-green-100 p-2">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">
                        Resolved
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {slaMetrics.resolvedTickets}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="rounded-lg bg-yellow-100 p-2">
                      <Timer className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">
                        Avg Response
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {slaMetrics.avgResponseTimeHours}h
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <div className="rounded-lg bg-purple-100 p-2">
                      <Target className="h-6 w-6 text-purple-600" />
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">
                        SLA Compliance
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {slaMetrics.responseSLACompliance.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tickets */}
          <Card>
            <CardHeader>
              <CardTitle>Your Support Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              {!tickets || tickets.length === 0 ? (
                <div className="py-12 text-center">
                  <MessageCircle className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                  <h3 className="mb-2 text-lg font-medium text-gray-900">
                    No tickets yet
                  </h3>
                  <p className="mb-4 text-gray-600">
                    You haven&apos;t created any support tickets yet.
                  </p>
                  <Button onClick={() => setCreateTicketOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create your first ticket
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {tickets.map((ticket) => {
                    const isExpanded = expandedTickets.has(ticket.id);
                    const currentComment = newComments[ticket.id] || "";

                    return (
                      <div
                        key={ticket.id}
                        className="rounded-lg border transition-colors"
                      >
                        {/* Ticket Header - Always Visible */}
                        <div
                          className="cursor-pointer p-4 hover:bg-gray-50"
                          onClick={() => toggleTicketExpanded(ticket.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="mb-2 flex items-center gap-2">
                                <h3 className="font-medium text-gray-900">
                                  {ticket.subject}
                                </h3>
                                <Badge
                                  className={getStatusColor(ticket.status)}
                                >
                                  {ticket.status.replace("_", " ")}
                                </Badge>
                                <Badge
                                  className={getPriorityColor(ticket.priority)}
                                >
                                  {ticket.priority}
                                </Badge>
                              </div>
                              <p
                                className={`text-sm text-gray-600 ${!isExpanded ? "line-clamp-2" : ""}`}
                              >
                                {ticket.description}
                              </p>
                              <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Created{" "}
                                  {formatRelativeTime(ticket.created_at)}
                                </div>
                                {ticket.assignedToMembership?.user && (
                                  <div className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {
                                      ticket.assignedToMembership.user
                                        .first_name
                                    }{" "}
                                    {ticket.assignedToMembership.user.last_name}
                                  </div>
                                )}
                                <div className="flex items-center gap-1">
                                  <MessageCircle className="h-3 w-3" />
                                  {ticket.comments?.length || 0} comments
                                </div>
                              </div>
                            </div>
                            <div className="ml-4 text-gray-400">
                              {isExpanded ? "▼" : "▶"}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Content */}
                        {isExpanded && (
                          <div className="border-t bg-gray-50/50">
                            {/* Comments */}
                            {ticket.comments && ticket.comments.length > 0 && (
                              <div className="space-y-3 p-4">
                                <h4 className="text-sm font-medium text-gray-700">
                                  Comments
                                </h4>
                                {ticket.comments.map((comment) => (
                                  <div key={comment.id} className="flex gap-3">
                                    <Avatar className="h-6 w-6">
                                      <AvatarImage
                                        src={
                                          comment.membership?.user
                                            ?.avatar_url || ""
                                        }
                                      />
                                      <AvatarFallback className="text-xs">
                                        {comment.membership?.user
                                          ? getInitials(
                                              `${comment.membership.user.first_name} ${comment.membership.user.last_name}`,
                                            )
                                          : comment.customerPortalAccess
                                            ? getInitials(
                                                comment.customerPortalAccess
                                                  .name,
                                              )
                                            : "C"}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 text-sm">
                                        <span className="font-medium">
                                          {comment.membership?.user
                                            ? `${comment.membership.user.first_name} ${comment.membership.user.last_name}`
                                            : comment.customerPortalAccess
                                              ? comment.customerPortalAccess
                                                  .name
                                              : "You"}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                          {formatRelativeTime(
                                            comment.created_at,
                                          )}
                                        </span>
                                      </div>
                                      <p className="mt-1 text-sm text-gray-700">
                                        {comment.content}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Add Comment Form */}
                            <div className="border-t p-4">
                              <div className="flex gap-3">
                                <Avatar className="h-6 w-6">
                                  <AvatarFallback className="text-xs">
                                    {getInitials(
                                      customerData?.customerName || "C",
                                    )}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 space-y-2">
                                  <Textarea
                                    placeholder="Add a comment..."
                                    value={currentComment}
                                    onChange={(e) =>
                                      setNewComments((prev) => ({
                                        ...prev,
                                        [ticket.id]: e.target.value,
                                      }))
                                    }
                                    rows={3}
                                    className="resize-none"
                                  />
                                  <div className="flex justify-end">
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        handleAddComment(ticket.id)
                                      }
                                      disabled={
                                        !currentComment.trim() ||
                                        addComment.isPending
                                      }
                                    >
                                      {addComment.isPending
                                        ? "Adding..."
                                        : "Add Comment"}
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
