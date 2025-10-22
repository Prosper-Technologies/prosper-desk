"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import Link from "next/link";
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
  BookOpen,
} from "lucide-react";
import { api } from "~/trpc/react";
import {
  formatRelativeTime,
  getStatusColor,
  getPriorityColor,
  getInitials,
} from "~/lib/utils";
import { createClient } from "~/utils/supabase/client";
import { Input } from "~/components/ui/input";

interface PortalPageProps {
  params: {
    companySlug: string;
    clientSlug: string;
  };
}

export default function CustomerPortalPage({ params }: PortalPageProps) {
  const router = useRouter();
  const supabase = createClient();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [customerData, setCustomerData] = useState<any>(null);
  const [createTicketOpen, setCreateTicketOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<
    "low" | "medium" | "high" | "urgent"
  >("medium");
  const [expandedTickets, setExpandedTickets] = useState<Set<string>>(
    new Set(),
  );
  const [newComments, setNewComments] = useState<{
    [ticketId: string]: string;
  }>({});
  const [isLoading, setIsLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);

  // Verify session on mount
  const verifySession = api.customerPortal.verifyToken.useMutation({
    onSuccess: (data) => {
      setIsAuthenticated(true);
      setCustomerData(data);
      setIsLoading(false);
    },
    onError: () => {
      // Redirect to request access page if not authenticated
      setIsLoading(false);
      router.push(`/portal/${params.companySlug}/${params.clientSlug}/request-access`);
    },
  });

  useEffect(() => {
    // Prevent multiple checks
    if (sessionChecked) return;

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // No session, redirect to request access
        setIsLoading(false);
        router.push(`/portal/${params.companySlug}/${params.clientSlug}/request-access`);
        return;
      }

      // Verify the session is valid for this portal
      setSessionChecked(true);
      verifySession.mutate({
        companySlug: params.companySlug,
        clientSlug: params.clientSlug,
      });
    };

    checkSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.companySlug, params.clientSlug]);

  // Get customer tickets
  const {
    data: tickets,
    refetch: refetchTickets,
    isLoading: ticketsLoading,
  } = api.customerPortal.getCustomerTickets.useQuery(
    {
      companySlug: params.companySlug,
      clientSlug: params.clientSlug,
      page: 1,
      limit: 20,
    },
    {
      enabled: isAuthenticated,
    },
  );

  // Get SLA metrics
  const { data: slaMetrics } = api.customerPortal.getSLAMetrics.useQuery(
    {
      companySlug: params.companySlug,
      clientSlug: params.clientSlug,
    },
    {
      enabled: isAuthenticated,
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

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) return;

    await createTicket.mutateAsync({
      companySlug: params.companySlug,
      clientSlug: params.clientSlug,
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
    if (!content) return;

    await addComment.mutateAsync({
      companySlug: params.companySlug,
      clientSlug: params.clientSlug,
      ticketId,
      content,
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push(`/portal/${params.companySlug}/${params.clientSlug}/request-access`);
  };

  // Show loading during session verification
  if (isLoading || verifySession.isPending || (isAuthenticated && ticketsLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-gray-600">Loading portal...</p>
        </div>
      </div>
    );
  }

  // Not authenticated (will redirect automatically)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center">
              <LifeBuoy className="mr-2 h-5 w-5 text-primary" />
              <div>
                <h1 className="text-base font-semibold text-gray-900">
                  {customerData?.companyName} Support
                </h1>
                <p className="text-xs text-gray-600">
                  Welcome, {customerData?.customerName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Log out
              </Button>
              <Dialog
                open={createTicketOpen}
                onOpenChange={setCreateTicketOpen}
              >
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-3 w-3" />
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
                        size="sm"
                        onClick={() => setCreateTicketOpen(false)}
                        disabled={createTicket.isPending}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" size="sm" disabled={createTicket.isPending}>
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
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="mb-1 text-base font-medium text-gray-900">
                    Welcome to our support portal!
                  </h2>
                  <p className="text-sm text-gray-600">
                    View tickets, create new ones, and browse our knowledge base for quick answers.
                  </p>
                </div>
                <LifeBuoy className="h-6 w-6 text-primary" />
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Card className="border-2 border-dashed border-blue-200 bg-blue-50/50">
              <CardContent className="p-3">
                <Link
                  href={`/portal/${params.companySlug}/${params.clientSlug}/knowledge`}
                  className="block"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-blue-700">
                        Knowledge Base
                      </p>
                      <p className="text-xs text-blue-600">
                        Find answers to common questions
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <BookOpen className="h-3 w-3 text-blue-500" />
                    </div>
                  </div>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-2 border-dashed border-green-200 bg-green-50/50">
              <CardContent className="p-3">
                <button
                  onClick={() => setCreateTicketOpen(true)}
                  className="block w-full text-left"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-green-700">
                        Create Support Ticket
                      </p>
                      <p className="text-xs text-green-600">
                        Get help with your issues
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Plus className="h-3 w-3 text-green-500" />
                    </div>
                  </div>
                </button>
              </CardContent>
            </Card>
          </div>

          {/* SLA Metrics */}
          {slaMetrics && slaMetrics.totalTickets > 0 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <div className="rounded-lg bg-blue-100 p-1.5">
                      <Activity className="h-3 w-3 text-blue-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-xs font-medium text-gray-600">
                        Total Tickets
                      </p>
                      <p className="text-base font-bold text-gray-900">
                        {slaMetrics.totalTickets}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <div className="rounded-lg bg-green-100 p-1.5">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-xs font-medium text-gray-600">
                        Resolved
                      </p>
                      <p className="text-base font-bold text-gray-900">
                        {slaMetrics.resolvedTickets}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <div className="rounded-lg bg-yellow-100 p-1.5">
                      <Timer className="h-3 w-3 text-yellow-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-xs font-medium text-gray-600">
                        Avg Response
                      </p>
                      <p className="text-base font-bold text-gray-900">
                        {slaMetrics.avgResponseTimeHours}h
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center">
                    <div className="rounded-lg bg-purple-100 p-1.5">
                      <Target className="h-3 w-3 text-purple-600" />
                    </div>
                    <div className="ml-3">
                      <p className="text-xs font-medium text-gray-600">
                        SLA Compliance
                      </p>
                      <p className="text-base font-bold text-gray-900">
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
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your Support Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              {!tickets || tickets.length === 0 ? (
                <div className="py-8 text-center">
                  <MessageCircle className="mx-auto mb-3 h-6 w-6 text-gray-400" />
                  <h3 className="mb-2 text-base font-medium text-gray-900">
                    No tickets yet
                  </h3>
                  <p className="mb-4 text-sm text-gray-600">
                    You haven&apos;t created any support tickets yet.
                  </p>
                  <Button size="sm" onClick={() => setCreateTicketOpen(true)}>
                    <Plus className="mr-2 h-3 w-3" />
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
