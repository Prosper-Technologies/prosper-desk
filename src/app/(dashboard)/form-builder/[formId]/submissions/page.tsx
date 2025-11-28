"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Download, ExternalLink, Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { api } from "~/trpc/react";
import { formatRelativeTime } from "~/lib/utils";
import { toast } from "sonner";

export default function FormSubmissionsPage() {
  const router = useRouter();
  const params = useParams();
  const formId = params?.formId as string;

  const [page, setPage] = useState(1);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [createTicketDialogOpen, setCreateTicketDialogOpen] = useState(false);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketPriority, setTicketPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");

  const { data: form } = api.forms.getById.useQuery({ id: formId });

  const { data, isLoading, refetch } = api.forms.getSubmissions.useQuery({
    form_id: formId,
    page,
    limit: 25,
  });

  const { data: exportData } = api.forms.exportSubmissions.useQuery(
    { form_id: formId },
    { enabled: false }
  );

  const createTicketMutation = api.forms.createTicketFromSubmission.useMutation({
    onSuccess: () => {
      toast.success("Ticket created successfully");
      setCreateTicketDialogOpen(false);
      setSelectedSubmission(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const submissions = data?.submissions || [];
  const totalPages = data?.totalPages || 1;

  const handleExportCSV = async () => {
    const result = await api.forms.exportSubmissions.useQuery({ form_id: formId });
    if (result.data) {
      const blob = new Blob([result.data.csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.data.filename;
      a.click();
      window.URL.revokeObjectURL(url);
    }
  };

  const handleCreateTicket = () => {
    if (!selectedSubmission) return;

    createTicketMutation.mutate({
      submission_id: selectedSubmission.id,
      subject: ticketSubject,
      priority: ticketPriority,
    });
  };

  const openCreateTicketDialog = (submission: any) => {
    setSelectedSubmission(submission);
    setTicketSubject(`Form submission from ${submission.submitted_by_name}`);
    setCreateTicketDialogOpen(true);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/form-builder")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Form Submissions</h1>
            <p className="text-muted-foreground">{form?.name}</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleExportCSV}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Submissions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Submissions ({data?.total || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading submissions...
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No submissions yet
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Submitted By</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Submitted At</TableHead>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission: any) => (
                    <TableRow key={submission.id}>
                      <TableCell className="font-medium">
                        {submission.submitted_by_name}
                      </TableCell>
                      <TableCell>{submission.submitted_by_email}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatRelativeTime(new Date(submission.submitted_at))}
                      </TableCell>
                      <TableCell>
                        {submission.ticket ? (
                          <Button
                            variant="link"
                            className="p-0 h-auto"
                            onClick={() =>
                              router.push(`/tickets?id=${submission.ticket.id}`)
                            }
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            {submission.ticket.subject}
                          </Button>
                        ) : (
                          <Badge variant="secondary">No Ticket</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedSubmission(submission)}
                          >
                            View Details
                          </Button>
                          {!submission.ticket && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openCreateTicketDialog(submission)}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Create Ticket
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* View Submission Details Dialog */}
      <Dialog
        open={!!selectedSubmission && !createTicketDialogOpen}
        onOpenChange={(open) => !open && setSelectedSubmission(null)}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Submission Details</DialogTitle>
            <DialogDescription>
              Submitted by {selectedSubmission?.submitted_by_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedSubmission && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Email</Label>
                    <div className="text-sm">{selectedSubmission.submitted_by_email}</div>
                  </div>
                  <div>
                    <Label>Submitted At</Label>
                    <div className="text-sm">
                      {new Date(selectedSubmission.submitted_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-4">Form Responses</h4>
                  <div className="space-y-3">
                    {Object.entries(selectedSubmission.data as Record<string, any>).map(
                      ([fieldId, value]) => {
                        const field = (form?.fields as any[])?.find(
                          (f) => f.id === fieldId
                        );
                        return (
                          <div key={fieldId} className="space-y-1">
                            <Label>{field?.label || fieldId}</Label>
                            <div className="text-sm bg-muted p-2 rounded">
                              {Array.isArray(value) ? value.join(", ") : String(value)}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>

                {selectedSubmission.ticket && (
                  <div className="border-t pt-4">
                    <Label>Linked Ticket</Label>
                    <Button
                      variant="link"
                      className="p-0 h-auto"
                      onClick={() =>
                        router.push(`/tickets?id=${selectedSubmission.ticket.id}`)
                      }
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {selectedSubmission.ticket.subject}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            {selectedSubmission && !selectedSubmission.ticket && (
              <Button onClick={() => openCreateTicketDialog(selectedSubmission)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Ticket
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Ticket Dialog */}
      <Dialog open={createTicketDialogOpen} onOpenChange={setCreateTicketDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Ticket from Submission</DialogTitle>
            <DialogDescription>
              Create a support ticket from this form submission
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ticket-subject">Ticket Subject</Label>
              <Input
                id="ticket-subject"
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="Enter ticket subject"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ticket-priority">Priority</Label>
              <Select value={ticketPriority} onValueChange={(value: any) => setTicketPriority(value)}>
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
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateTicketDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTicket}
              disabled={createTicketMutation.isPending}
            >
              Create Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
