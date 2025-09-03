"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { api } from "~/trpc/react";

interface CreateTicketDialogProps {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTicketCreated: () => void;
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

export default function CreateTicketDialog({
  children,
  open,
  onOpenChange,
  onTicketCreated,
  agents,
}: CreateTicketDialogProps) {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<
    "low" | "medium" | "high" | "urgent"
  >("medium");
  const [assignedToId, setAssignedToId] = useState<string>("unassigned");
  const [clientId, setClientId] = useState<string>("none");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");

  const createTicket = api.ticket.create.useMutation({
    onSuccess: () => {
      onTicketCreated();
      resetForm();
    },
  });

  const { data: clients } = api.client.getAll.useQuery({
    page: 1,
    limit: 50,
  });

  const resetForm = () => {
    setSubject("");
    setDescription("");
    setPriority("medium");
    setAssignedToId("unassigned");
    setClientId("none");
    setCustomerEmail("");
    setCustomerName("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!subject.trim() || !description.trim()) {
      return;
    }

    await createTicket.mutateAsync({
      subject: subject.trim(),
      description: description.trim(),
      priority,
      assignedToId: assignedToId === "unassigned" ? undefined : assignedToId,
      clientId: clientId === "none" ? undefined : clientId,
      customerEmail: customerEmail || undefined,
      customerName: customerName || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Ticket</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="subject" className="text-sm font-medium">
              Subject *
            </label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief description of the issue"
              required
              disabled={createTicket.isLoading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description *
            </label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of the issue"
              required
              disabled={createTicket.isLoading}
              rows={4}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="priority" className="text-sm font-medium">
                Priority
              </label>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as any)}
                disabled={createTicket.isLoading}
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

            <div className="space-y-2">
              <label htmlFor="assignee" className="text-sm font-medium">
                Assignee
              </label>
              <Select
                value={assignedToId}
                onValueChange={setAssignedToId}
                disabled={createTicket.isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select assignee" />
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
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="client" className="text-sm font-medium">
              Client Organization
            </label>
            <Select
              value={clientId}
              onValueChange={setClientId}
              disabled={createTicket.isLoading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Client</SelectItem>
                {clients?.clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="customerEmail" className="text-sm font-medium">
                Customer Email
              </label>
              <Input
                id="customerEmail"
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="customer@example.com"
                disabled={createTicket.isLoading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="customerName" className="text-sm font-medium">
                Customer Name
              </label>
              <Input
                id="customerName"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Customer Name"
                disabled={createTicket.isLoading}
              />
            </div>
          </div>

          {createTicket.error && (
            <div className="text-sm text-red-600">
              {createTicket.error.message}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createTicket.isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createTicket.isLoading}>
              {createTicket.isLoading ? "Creating..." : "Create Ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
