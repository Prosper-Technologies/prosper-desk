"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search, Eye } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { api } from "~/trpc/react";
import {
  formatRelativeTime,
  getStatusColor,
  getPriorityColor,
  getInitials,
} from "~/lib/utils";
import CreateTicketDialog from "~/components/tickets/create-ticket-dialog";
import TicketDetailDialog from "~/components/tickets/ticket-detail-dialog";

export default function TicketsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [clientFilter, setClientFilter] = useState<string>("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [myTickets, setMyTickets] = useState(false);

  const searchParams = useSearchParams();

  // Check URL parameters for filters
  useEffect(() => {
    const filterParam = searchParams?.get("filter");
    if (filterParam === "my") {
      setMyTickets(true);
    }
  }, [searchParams]);

  const { data, isLoading, refetch } = api.ticket.getAll.useQuery({
    page,
    limit: 25,
    search: search || undefined,
    status: (statusFilter as any) || undefined,
    priority: (priorityFilter as any) || undefined,
    clientId: clientFilter || undefined,
    myTickets,
  });

  const { data: clients } = api.clients.getAll.useQuery({
    page: 1,
    limit: 50,
  });

  const { data: agents } = api.user.getAgents.useQuery();

  const tickets = data?.tickets || [];
  const pagination = data?.pagination;

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1); // Reset to first page when searching
  };

  const handleFilterChange = () => {
    setPage(1); // Reset to first page when filtering
  };

  const handleTicketCreated = () => {
    setCreateDialogOpen(false);
    refetch();
  };

  const handleTicketUpdated = () => {
    refetch();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {myTickets ? "My Tickets" : "Tickets"}
          </h1>
          <p className="text-gray-600">
            {myTickets
              ? "Tickets assigned to or created by you"
              : "Manage and track support tickets"}
          </p>
        </div>
        <CreateTicketDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onTicketCreated={handleTicketCreated}
          agents={agents || []}
        >
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Ticket
          </Button>
        </CreateTicketDialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
                <Input
                  placeholder="Search tickets..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            {!myTickets && (
              <Select
                value={clientFilter}
                onValueChange={(value) => {
                  setClientFilter(value === "all" ? "" : value);
                  handleFilterChange();
                }}
              >
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="All Clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients?.clients?.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value === "all" ? "" : value);
                handleFilterChange();
              }}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={priorityFilter}
              onValueChange={(value) => {
                setPriorityFilter(value === "all" ? "" : value);
                handleFilterChange();
              }}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tickets Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="h4- mx-auto w-4 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <p className="mt-2 text-sm text-gray-600">Loading tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto h-24 w-24 text-gray-400">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No tickets found
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {search || statusFilter || priorityFilter
                  ? "Try adjusting your filters"
                  : "Get started by creating your first ticket"}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    {!myTickets && <TableHead>Client</TableHead>}
                    <TableHead>Assignee</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-[50px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow
                      key={ticket.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => setSelectedTicketId(ticket.id)}
                    >
                      <TableCell>
                        <div>
                          <p className="line-clamp-1 font-medium text-gray-900">
                            {ticket.subject}
                          </p>
                          <p className="mt-1 line-clamp-1 text-sm text-gray-500">
                            {ticket.description}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(ticket.status)}>
                          {ticket.status.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getPriorityColor(ticket.priority)}>
                          {ticket.priority}
                        </Badge>
                      </TableCell>
                      {!myTickets && (
                        <TableCell>
                          {ticket.client ? (
                            <span className="text-sm">
                              {ticket.client.name}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-500">
                              No client
                            </span>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        {ticket.assignedToMembership?.user ? (
                          <div className="flex items-center space-x-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage
                                src={
                                  ticket.assignedToMembership.user.avatar_url ||
                                  undefined
                                }
                              />
                              <AvatarFallback className="text-xs">
                                {getInitials(
                                  `${ticket.assignedToMembership.user.first_name} ${ticket.assignedToMembership.user.last_name}`,
                                )}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">
                              {ticket.assignedToMembership.user.first_name}{" "}
                              {ticket.assignedToMembership.user.last_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">
                            Unassigned
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatRelativeTime(ticket.created_at)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {formatRelativeTime(ticket.updated_at)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTicketId(ticket.id);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
            {pagination.total} tickets
          </p>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === pagination.totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Ticket Detail Dialog */}
      {selectedTicketId && (
        <TicketDetailDialog
          ticketId={selectedTicketId}
          open={!!selectedTicketId}
          onOpenChange={(open) => !open && setSelectedTicketId(null)}
          onTicketUpdated={handleTicketUpdated}
          agents={agents || []}
        />
      )}
    </div>
  );
}
