"use client";

import { useState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
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
  formatDateTime,
  getStatusColor,
  getPriorityColor,
  getInitials,
} from "~/lib/utils";
import { Send, Edit, Save, X, Clock, User } from "lucide-react";

interface TicketDetailDialogProps {
  ticketId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTicketUpdated: () => void;
  agents: Array<{
    id: string;
    user: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
    };
  }>;
}

export default function TicketDetailDialog({
  ticketId,
  open,
  onOpenChange,
  onTicketUpdated,
  agents,
}: TicketDetailDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<
    "open" | "in_progress" | "resolved" | "closed"
  >("open");
  const [editPriority, setEditPriority] = useState<
    "low" | "medium" | "high" | "urgent"
  >("medium");
  const [editAssignedTo, setEditAssignedTo] = useState("unassigned");
  const [newComment, setNewComment] = useState("");
  const [isInternal, setIsInternal] = useState(false);

  const {
    data: ticket,
    isLoading,
    refetch,
  } = api.ticket.getById.useQuery({ id: ticketId }, { enabled: open });

  const updateTicket = api.ticket.update.useMutation({
    onSuccess: () => {
      onTicketUpdated();
      refetch();
      setIsEditing(false);
    },
  });

  const addComment = api.ticket.addComment.useMutation({
    onSuccess: () => {
      setNewComment("");
      refetch();
    },
  });

  useEffect(() => {
    if (ticket) {
      setEditSubject(ticket.subject);
      setEditDescription(ticket.description);
      setEditStatus(ticket.status);
      setEditPriority(ticket.priority);
      setEditAssignedTo(ticket.assigned_to_membership_id || "unassigned");
    }
  }, [ticket]);

  const handleSave = async () => {
    if (!ticket) return;

    await updateTicket.mutateAsync({
      id: ticket.id,
      subject: editSubject !== ticket.subject ? editSubject : undefined,
      description:
        editDescription !== ticket.description ? editDescription : undefined,
      status: editStatus !== ticket.status ? editStatus : undefined,
      priority: editPriority !== ticket.priority ? editPriority : undefined,
      assignedToId:
        editAssignedTo !== (ticket.assigned_to_membership_id || "unassigned")
          ? editAssignedTo === "unassigned"
            ? undefined
            : editAssignedTo
          : undefined,
    });
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    await addComment.mutateAsync({
      ticketId: ticket!.id,
      content: newComment.trim(),
      isInternal,
    });
  };

  if (isLoading || !ticket) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
          <div className="flex items-center justify-center p-8">
            <div className="h-4 w-4 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">{ticket.subject}</DialogTitle>
            <div className="flex items-center space-x-2">
              {isEditing ? (
                <>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={updateTicket.isLoading}
                  >
                    <Save className="mr-1 h-4 w-4" />
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                  >
                    <X className="mr-1 h-4 w-4" />
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="mr-1 h-4 w-4" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 gap-6 p-1 lg:grid-cols-3">
            {/* Main Content */}
            <div className="space-y-6 lg:col-span-2">
              {/* Ticket Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Ticket Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isEditing && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Subject</label>
                      <Input
                        value={editSubject}
                        onChange={(e) => setEditSubject(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    {isEditing ? (
                      <>
                        <label className="text-sm font-medium">Description</label>
                        <Textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          rows={4}
                        />
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm">
                        {ticket.description}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Comments */}
              <Card>
                <CardHeader>
                  <CardTitle>Comments</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ticket.comments?.map((comment) => (
                    <div
                      key={comment.id}
                      className="flex space-x-3 rounded-lg border p-4"
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage
                          src={
                            comment.membership?.user?.avatar_url || undefined
                          }
                        />
                        <AvatarFallback className="text-xs">
                          {comment.membership?.user
                            ? getInitials(
                                `${comment.membership.user.first_name} ${comment.membership.user.last_name}`,
                              )
                            : comment.customerPortalAccess
                              ? getInitials(comment.customerPortalAccess.name)
                              : "C"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">
                            {comment.membership?.user
                              ? `${comment.membership.user.first_name} ${comment.membership.user.last_name}`
                              : comment.customerPortalAccess
                                ? comment.customerPortalAccess.name
                                : "Customer"}
                          </span>
                          {comment.is_internal && (
                            <Badge variant="secondary" className="text-xs">
                              Internal
                            </Badge>
                          )}
                          <span className="text-xs text-gray-500">
                            {formatDateTime(comment.created_at)}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm">
                          {comment.content}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Add Comment */}
                  <form
                    onSubmit={handleAddComment}
                    className="space-y-3 border-t pt-4"
                  >
                    <Textarea
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={3}
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={isInternal}
                          onChange={(e) => setIsInternal(e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm">Internal note</span>
                      </label>
                      <Button
                        type="submit"
                        disabled={!newComment.trim() || addComment.isLoading}
                        size="sm"
                      >
                        <Send className="mr-1 h-4 w-4" />
                        {addComment.isLoading ? "Sending..." : "Send"}
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Customer Info */}
              {ticket.customer_email && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Customer</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {ticket.customer_name && (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-gray-500">
                          Name
                        </label>
                        <p className="text-sm">{ticket.customer_name}</p>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-500">
                        Email
                      </label>
                      <p className="text-sm">{ticket.customer_email}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Status & Priority */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Status & Priority</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-500">
                      Status
                    </label>
                    {isEditing ? (
                      <Select
                        value={editStatus}
                        onValueChange={(value) => setEditStatus(value as any)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in_progress">
                            In Progress
                          </SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge className={getStatusColor(ticket.status)}>
                        {ticket.status.replace("_", " ")}
                      </Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-500">
                      Priority
                    </label>
                    {isEditing ? (
                      <Select
                        value={editPriority}
                        onValueChange={(value) => setEditPriority(value as any)}
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
                    ) : (
                      <Badge className={getPriorityColor(ticket.priority)}>
                        {ticket.priority}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Assignment */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Assignment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-500">
                      Assigned to
                    </label>
                    {isEditing ? (
                      <Select
                        value={editAssignedTo}
                        onValueChange={setEditAssignedTo}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {agents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.user.first_name} {agent.user.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <>
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
                          <div className="flex items-center space-x-2 text-gray-500">
                            <User className="h-4 w-4" />
                            <span className="text-sm">Unassigned</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-500">
                      Created by
                    </label>
                    <div className="flex items-center space-x-2">
                      <Avatar className="h-6 w-6">
                        {ticket.createdByMembership?.user?.avatar_url && (
                          <AvatarImage
                            src={ticket.createdByMembership.user.avatar_url}
                          />
                        )}
                        <AvatarFallback className="text-xs">
                          {ticket.createdByMembership?.user
                            ? getInitials(
                                `${ticket.createdByMembership.user.first_name} ${ticket.createdByMembership.user.last_name}`,
                              )
                            : ticket.customer_name
                              ? getInitials(ticket.customer_name)
                              : ticket.customer_email?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {ticket.createdByMembership?.user
                            ? `${ticket.createdByMembership.user.first_name} ${ticket.createdByMembership.user.last_name}`
                            : ticket.customer_name || ticket.customer_email || "Unknown"}
                        </span>
                        {ticket.createdByMembership?.user && (
                          <Badge variant="secondary" className="text-xs">
                            Team
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Timestamps */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Timestamps</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center space-x-2 text-xs">
                    <Clock className="h-3 w-3 text-gray-400" />
                    <span className="text-gray-500">Created:</span>
                    <span>{formatDateTime(ticket.created_at)}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-xs">
                    <Clock className="h-3 w-3 text-gray-400" />
                    <span className="text-gray-500">Updated:</span>
                    <span>{formatDateTime(ticket.updated_at)}</span>
                  </div>
                  {ticket.first_response_at && (
                    <div className="flex items-center space-x-2 text-xs">
                      <Clock className="h-3 w-3 text-gray-400" />
                      <span className="text-gray-500">First Response:</span>
                      <span>{formatDateTime(ticket.first_response_at)}</span>
                    </div>
                  )}
                  {ticket.resolved_at && (
                    <div className="flex items-center space-x-2 text-xs">
                      <Clock className="h-3 w-3 text-gray-400" />
                      <span className="text-gray-500">Resolved:</span>
                      <span>{formatDateTime(ticket.resolved_at)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
