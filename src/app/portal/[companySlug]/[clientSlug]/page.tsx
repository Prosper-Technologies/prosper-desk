"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
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
  CheckCircle,
  User,
  Activity,
  ChevronDown,
  ChevronRight,
  Edit2,
  X,
  Save,
} from "lucide-react";
import { Label } from "~/components/ui/label";
import { useSearchParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { api } from "~/trpc/react";
import {
  formatRelativeTime,
  getStatusColor,
  getPriorityColor,
  getInitials,
  cn,
} from "~/lib/utils";
import { createClient } from "~/utils/supabase/client";
import { Input } from "~/components/ui/input";
import { toast } from "sonner";

interface PortalPageProps {
  params: {
    companySlug: string;
    clientSlug: string;
  };
}

type Ticket = {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  external_id: string | null;
  external_type: string | null;
  customer_email: string | null;
  customer_name: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  assignedToMembership?: {
    user: {
      first_name: string;
      last_name: string;
      avatar_url: string | null;
    };
  };
  comments?: Array<{
    id: string;
    content: string;
    created_at: string | Date;
    membership?: {
      user: {
        first_name: string;
        last_name: string;
        avatar_url: string | null;
      };
    };
    customerPortalAccess?: {
      name: string;
      email: string;
    };
  }>;
};

export default function CustomerPortalPage({ params }: PortalPageProps) {
  const router = useRouter();
  const supabase = createClient();
  const searchParams = useSearchParams();
  const ticketId = searchParams?.get("ticket") || null;

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [customerData, setCustomerData] = useState<any>(null);
  const [createTicketOpen, setCreateTicketOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<
    "low" | "medium" | "high" | "urgent"
  >("medium");
  const [isLoading, setIsLoading] = useState(true);
  const [sessionChecked, setSessionChecked] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");

  // Pagination state
  const [page, setPage] = useState(1);
  const [allLoadedTickets, setAllLoadedTickets] = useState<Ticket[]>([]);

  // Modal ticket edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState<
    "low" | "medium" | "high" | "urgent"
  >("medium");
  const [editAssignee, setEditAssignee] = useState<string | null>(null);
  const [newCommentContent, setNewCommentContent] = useState("");

  // Verify session on mount
  const verifySession = api.customerPortal.verifyToken.useMutation({
    onSuccess: (data) => {
      setIsAuthenticated(true);
      setCustomerData(data);
      setIsLoading(false);
    },
    onError: async (error) => {
      setIsLoading(false);
      // If the error is because the user doesn't have portal access,
      // sign them out so they can log in with the correct account
      if (error.message.includes("don't have access")) {
        await supabase.auth.signOut();
      }
      // Stay on the same page - it will show the login form
      setIsAuthenticated(false);
    },
  });

  useEffect(() => {
    if (sessionChecked) return;

    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setIsLoading(false);
        setSessionChecked(true);
        // Stay on the same page - it will show the login form
        return;
      }

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
    data: ticketsData,
    refetch: refetchTickets,
    isLoading: ticketsLoading,
    isFetching,
  } = api.customerPortal.getCustomerTickets.useQuery(
    {
      companySlug: params.companySlug,
      clientSlug: params.clientSlug,
      page,
      limit: 20,
    },
    {
      enabled: isAuthenticated,
    },
  );

  // Resolve ticket mutation
  const resolveTicket = api.customerPortal.resolveTicket.useMutation({
    onSuccess: () => {
      refetchTickets();
      toast.success("Ticket resolved successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to resolve ticket");
    },
  });

  // Accumulate tickets as pages load
  useEffect(() => {
    if (ticketsData && ticketsData.length > 0) {
      setAllLoadedTickets((prev) => {
        // Avoid duplicates
        const newTickets = ticketsData.filter(
          (newTicket: any) => !prev.some((t) => t.id === newTicket.id),
        );
        return [...prev, ...(newTickets as Ticket[])];
      });
    }
  }, [ticketsData]);

  const allTickets = allLoadedTickets;

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

  // Get ticket detail for modal
  const { data: selectedTicket, refetch: refetchTicket } =
    api.customerPortal.getTicketById.useQuery(
      {
        companySlug: params.companySlug,
        clientSlug: params.clientSlug,
        ticketId: ticketId!,
      },
      {
        enabled: isAuthenticated && !!ticketId,
      },
    );

  // Get team members for assignment
  const { data: teamMembers } = api.customerPortal.getTeamMembers.useQuery(
    {
      companySlug: params.companySlug,
      clientSlug: params.clientSlug,
    },
    {
      enabled: isAuthenticated,
    },
  );

  // Mutations for ticket modal
  const updateTicket = api.customerPortal.updateTicket.useMutation({
    onSuccess: () => {
      void refetchTicket();
      void refetchTickets();
      setIsEditing(false);
      toast.success("Ticket updated successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update ticket");
    },
  });

  const resolveTicketMutation = api.customerPortal.resolveTicket.useMutation({
    onSuccess: () => {
      void refetchTicket();
      void refetchTickets();
      toast.success("Ticket resolved successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to resolve ticket");
    },
  });

  const addComment = api.customerPortal.addComment.useMutation({
    onSuccess: () => {
      void refetchTicket();
      setNewCommentContent("");
      toast.success("Comment added successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add comment");
    },
  });

  // Modal handlers
  const handleCloseModal = () => {
    router.push(`/portal/${params.companySlug}/${params.clientSlug}`);
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    if (selectedTicket) {
      setEditSubject(selectedTicket.subject);
      setEditDescription(selectedTicket.description);
      setEditPriority(selectedTicket.priority);
      setEditAssignee(selectedTicket.assigned_to_membership_id || null);
      setIsEditing(true);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    if (!selectedTicket) return;

    updateTicket.mutate({
      companySlug: params.companySlug,
      clientSlug: params.clientSlug,
      ticketId: selectedTicket.id,
      subject: editSubject !== selectedTicket.subject ? editSubject : undefined,
      description:
        editDescription !== selectedTicket.description
          ? editDescription
          : undefined,
      priority:
        editPriority !== selectedTicket.priority ? editPriority : undefined,
      assigned_to_membership_id:
        editAssignee !== selectedTicket.assigned_to_membership_id
          ? editAssignee
          : undefined,
    });
  };

  const handleResolve = () => {
    if (!selectedTicket) return;

    resolveTicketMutation.mutate({
      companySlug: params.companySlug,
      clientSlug: params.clientSlug,
      ticketId: selectedTicket.id,
    });
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newCommentContent.trim()) return;

    addComment.mutate({
      companySlug: params.companySlug,
      clientSlug: params.clientSlug,
      ticketId: selectedTicket.id,
      content: newCommentContent,
    });
  };

  // Filter tickets
  const filteredTickets = useMemo(() => {
    return allTickets.filter((ticket: Ticket) => {
      if (statusFilter !== "all" && ticket.status !== statusFilter)
        return false;
      if (priorityFilter !== "all" && ticket.priority !== priorityFilter)
        return false;
      if (assigneeFilter !== "all") {
        if (
          assigneeFilter === "unassigned" &&
          ticket.assignedToMembership !== undefined &&
          ticket.assignedToMembership !== null
        )
          return false;
        if (
          assigneeFilter !== "unassigned" &&
          (!ticket.assignedToMembership ||
            ticket.assignedToMembership.user.first_name +
              " " +
              ticket.assignedToMembership.user.last_name !==
              assigneeFilter)
        )
          return false;
      }
      return true;
    });
  }, [allTickets, statusFilter, priorityFilter, assigneeFilter]);

  // Get unique assignees
  const assignees = useMemo(() => {
    const uniqueAssignees = new Map<string, string>();
    allTickets.forEach((ticket: Ticket) => {
      if (ticket.assignedToMembership?.user) {
        const name = `${ticket.assignedToMembership.user.first_name} ${ticket.assignedToMembership.user.last_name}`;
        uniqueAssignees.set(name, name);
      }
    });
    return Array.from(uniqueAssignees.values());
  }, [allTickets]);

  // Create ticket mutation
  const createTicket = api.customerPortal.createTicket.useMutation({
    onSuccess: () => {
      setCreateTicketOpen(false);
      setSubject("");
      setDescription("");
      setPriority("medium");
      refetchTickets();
      toast.success("Ticket created successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create ticket");
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push(`/portal/${params.companySlug}/${params.clientSlug}/request-access`);
  };

  // Table columns definition
  const columns = useMemo<ColumnDef<Ticket>[]>(
    () => [
      {
        accessorKey: "subject",
        header: "Subject",
        cell: ({ row }) => (
          <div className="max-w-md">
            <div className="font-medium text-gray-900">
              {row.original.subject}
            </div>
            <div className="text-xs text-gray-500">
              Created {formatRelativeTime(row.original.created_at)}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "customer",
        header: "Created By",
        cell: ({ row }) => {
          const customerName = row.original.customer_name;
          const customerEmail = row.original.customer_email;

          if (!customerName && !customerEmail) {
            return <span className="text-sm text-gray-500">Unknown</span>;
          }

          return (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="bg-green-200 text-xs text-green-700">
                  {customerName
                    ? getInitials(customerName)
                    : customerEmail?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium">
                  {customerName || "Unknown"}
                </span>
                {customerEmail && (
                  <span className="text-xs text-gray-500">{customerEmail}</span>
                )}
              </div>
            </div>
          );
        },
        size: 200,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <div
            className={cn(
              getStatusColor(row.original.status as any),
              "w-fit rounded-sm px-2 py-1 text-xs font-medium",
            )}
          >
            {row.original.status.replace("_", " ")}
          </div>
        ),
        size: 120,
      },
      {
        accessorKey: "priority",
        header: "Priority",
        cell: ({ row }) => (
          <Badge className={getPriorityColor(row.original.priority as any)}>
            {row.original.priority}
          </Badge>
        ),
        size: 100,
      },
      {
        accessorKey: "assignee",
        header: "Assignee",
        cell: ({ row }) => {
          const assignee = row.original.assignedToMembership?.user;
          if (!assignee) {
            return <span className="text-sm text-gray-500">Unassigned</span>;
          }
          return (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={assignee.avatar_url || ""} />
                <AvatarFallback className="text-xs">
                  {getInitials(`${assignee.first_name} ${assignee.last_name}`)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">
                {assignee.first_name} {assignee.last_name}
              </span>
            </div>
          );
        },
        size: 180,
      },
      {
        accessorKey: "comments",
        header: "Comments",
        cell: ({ row }) => (
          <div className="flex items-center gap-1 text-sm text-gray-600">
            <MessageCircle className="h-4 w-4" />
            {row.original.comments?.length || 0}
          </div>
        ),
        size: 100,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const ticket = row.original;
          const canResolve =
            ticket.status !== "resolved" && ticket.status !== "closed";

          return (
            canResolve && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  resolveTicket.mutate({
                    companySlug: params.companySlug,
                    clientSlug: params.clientSlug,
                    ticketId: ticket.id,
                  });
                }}
                disabled={resolveTicket.isPending}
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            )
          );
        },
        size: 80,
      },
    ],
    [params.companySlug, params.clientSlug, resolveTicket],
  );

  const table = useReactTable({
    data: filteredTickets,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // Scroll handler for infinite loading
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      const { scrollTop, scrollHeight, clientHeight } = target;

      // Load more when 200px from bottom
      if (
        scrollHeight - scrollTop - clientHeight < 200 &&
        ticketsData &&
        ticketsData.length === 20 &&
        !isFetching
      ) {
        setPage((prev) => prev + 1);
      }
    },
    [ticketsData, isFetching],
  );

  // Show loading during session verification
  if (
    isLoading ||
    verifySession.isPending ||
    (isAuthenticated && ticketsLoading)
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-gray-600">Loading portal...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to request access page
    if (typeof window !== "undefined") {
      router.push(
        `/portal/${params.companySlug}/${params.clientSlug}/request-access`,
      );
    }
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
                      <Button
                        type="submit"
                        size="sm"
                        disabled={createTicket.isPending}
                      >
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
          {/* Ticket Stats */}
          {slaMetrics && slaMetrics.totalTickets > 0 && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
            </div>
          )}

          {/* Tickets Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Your Support Tickets</CardTitle>

              {/* Filters */}
              {allTickets.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <div className="min-w-[150px] flex-1">
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Status
                    </label>
                    <Select
                      value={statusFilter}
                      onValueChange={setStatusFilter}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="min-w-[150px] flex-1">
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Priority
                    </label>
                    <Select
                      value={priorityFilter}
                      onValueChange={setPriorityFilter}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Priorities</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="min-w-[150px] flex-1">
                    <label className="mb-1 block text-xs font-medium text-gray-600">
                      Assignee
                    </label>
                    <Select
                      value={assigneeFilter}
                      onValueChange={setAssigneeFilter}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Assignees</SelectItem>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {assignees.map((assignee) => (
                          <SelectItem key={assignee} value={assignee}>
                            {assignee}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {!allTickets || allTickets.length === 0 ? (
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
              ) : filteredTickets.length === 0 ? (
                <div className="py-8 text-center">
                  <MessageCircle className="mx-auto mb-3 h-6 w-6 text-gray-400" />
                  <h3 className="mb-2 text-base font-medium text-gray-900">
                    No tickets match your filters
                  </h3>
                  <p className="text-sm text-gray-600">
                    Try adjusting your filters to see more results.
                  </p>
                </div>
              ) : (
                <div
                  id="table-container"
                  onScroll={handleScroll}
                  className="max-h-[600px] overflow-auto"
                >
                  <table className="w-full">
                    <thead className="sticky top-0 z-10 bg-gray-50">
                      {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id}>
                          {headerGroup.headers.map((header) => (
                            <th
                              key={header.id}
                              className="border-b border-gray-200 px-4 py-3 text-left text-xs font-medium text-gray-700"
                              style={{ width: header.getSize() }}
                            >
                              {header.isPlaceholder
                                ? null
                                : flexRender(
                                    header.column.columnDef.header,
                                    header.getContext(),
                                  )}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {table.getRowModel().rows.map((row) => (
                        <tr
                          key={row.id}
                          className="cursor-pointer transition-colors hover:bg-blue-50"
                          onClick={() => {
                            router.push(
                              `/portal/${params.companySlug}/${params.clientSlug}?ticket=${row.original.id}`,
                            );
                          }}
                        >
                          {row.getVisibleCells().map((cell) => (
                            <td
                              key={cell.id}
                              className="px-4 py-3"
                              style={{ width: cell.column.getSize() }}
                            >
                              {flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext(),
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Loading indicator for infinite scroll */}
                  {isFetching && page > 1 && (
                    <div className="flex justify-center py-4">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Ticket Detail Modal */}
      {ticketId && selectedTicket && (
        <Dialog
          open={true}
          onOpenChange={(open) => !open && handleCloseModal()}
        >
          <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
            <DialogHeader>
              <div className="space-y-3">
                <DialogTitle className="pr-8 text-lg font-semibold">
                  {selectedTicket.subject}
                </DialogTitle>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-xs">
                      {selectedTicket.status.replace("_", " ")}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {selectedTicket.priority}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      • {formatRelativeTime(selectedTicket.created_at)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {selectedTicket.canEdit && !isEditing && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleStartEdit}
                      >
                        <Edit2 className="mr-1.5 h-3.5 w-3.5" />
                        <span className="text-xs">Edit</span>
                      </Button>
                    )}
                    {selectedTicket.status !== "resolved" &&
                      selectedTicket.status !== "closed" && (
                        <Button
                          size="sm"
                          onClick={handleResolve}
                          disabled={resolveTicketMutation.isPending}
                        >
                          <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                          <span className="text-xs">Resolve</span>
                        </Button>
                      )}
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4">
              {/* Edit Mode */}
              {isEditing && (
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Edit Ticket</h4>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCancelEdit}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        disabled={updateTicket.isPending}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="edit-subject">Subject</Label>
                      <Input
                        id="edit-subject"
                        value={editSubject}
                        onChange={(e) => setEditSubject(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit-priority">Priority</Label>
                      <Select
                        value={editPriority}
                        onValueChange={(value: any) => setEditPriority(value)}
                      >
                        <SelectTrigger className="mt-1">
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
                    <div>
                      <Label htmlFor="edit-assignee">Assignee</Label>
                      <Select
                        value={editAssignee || "unassigned"}
                        onValueChange={(value) =>
                          setEditAssignee(value === "unassigned" ? null : value)
                        }
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {teamMembers?.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.user
                                ? `${member.user.first_name} ${member.user.last_name}`
                                : "Unknown"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="edit-description">Description</Label>
                      <Textarea
                        id="edit-description"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={6}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Ticket Description */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Description</h4>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {selectedTicket.description}
                </p>
              </div>

              {/* Created By */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Created By</h4>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    {selectedTicket.created_by?.user?.avatar_url && (
                      <AvatarImage
                        src={selectedTicket.created_by.user.avatar_url}
                      />
                    )}
                    <AvatarFallback className="text-xs">
                      {selectedTicket.created_by?.user
                        ? getInitials(
                            `${selectedTicket.created_by.user.first_name} ${selectedTicket.created_by.user.last_name}`,
                          )
                        : selectedTicket.customer_name
                          ? getInitials(selectedTicket.customer_name)
                          : selectedTicket.customer_email
                            ?.charAt(0)
                            .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {selectedTicket.created_by?.user
                          ? `${selectedTicket.created_by.user.first_name} ${selectedTicket.created_by.user.last_name}`
                          : selectedTicket.customer_name || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {selectedTicket.created_by?.user
                          ? selectedTicket.created_by.user.email
                          : selectedTicket.customer_email}
                      </p>
                    </div>
                    {selectedTicket.created_by?.user && (
                      <Badge variant="secondary" className="text-xs">
                        Team
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Assigned To */}
              {selectedTicket.assigned_to && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Assigned To</h4>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarImage
                        src={selectedTicket.assigned_to.user?.avatar_url || ""}
                      />
                      <AvatarFallback className="text-xs">
                        {getInitials(
                          `${selectedTicket.assigned_to.user?.first_name} ${selectedTicket.assigned_to.user?.last_name}`,
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-muted-foreground">
                      {selectedTicket.assigned_to.user?.first_name}{" "}
                      {selectedTicket.assigned_to.user?.last_name}
                    </span>
                  </div>
                </div>
              )}

              {/* Comments Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium">
                  Comments
                  {selectedTicket.comments &&
                    selectedTicket.comments.length > 0 && (
                      <span className="ml-1.5 text-muted-foreground">
                        ({selectedTicket.comments.length})
                      </span>
                    )}
                </h4>

                {/* Comments List */}
                {selectedTicket.comments &&
                selectedTicket.comments.length > 0 ? (
                  <div className="space-y-3">
                    {selectedTicket.comments.map((comment: any) => {
                      const isCustomer = !!comment.customerPortalAccess;
                      const customerName = comment.customerPortalAccess?.name;
                      const customerEmail = comment.customerPortalAccess?.email;

                      return (
                        <div
                          key={comment.id}
                          className="flex gap-3 rounded-lg border p-3"
                        >
                          <Avatar className="h-8 w-8">
                            {!isCustomer && comment.membership?.user && (
                              <AvatarImage
                                src={comment.membership.user.avatar_url || ""}
                              />
                            )}
                            <AvatarFallback className="text-xs">
                              {isCustomer
                                ? customerName
                                  ? getInitials(customerName)
                                  : customerEmail?.charAt(0).toUpperCase()
                                : comment.membership?.user
                                  ? getInitials(
                                      `${comment.membership.user.first_name} ${comment.membership.user.last_name}`,
                                    )
                                  : "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {isCustomer
                                  ? customerName || "Customer"
                                  : comment.membership?.user
                                    ? `${comment.membership.user.first_name} ${comment.membership.user.last_name}`
                                    : "Unknown"}
                              </span>
                              {isCustomer && customerEmail && (
                                <span className="text-xs text-muted-foreground">
                                  ({customerEmail})
                                </span>
                              )}
                              <span className="text-xs text-muted-foreground">
                                • {formatRelativeTime(comment.created_at)}
                              </span>
                            </div>
                            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                              {comment.content}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No comments yet
                  </p>
                )}

                {/* Add Comment Form */}
                <form onSubmit={handleAddComment} className="space-y-2">
                  <Textarea
                    placeholder="Add a comment..."
                    value={newCommentContent}
                    onChange={(e) => setNewCommentContent(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={
                        !newCommentContent.trim() || addComment.isPending
                      }
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Add Comment
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
