"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { FileText, ExternalLink, Plus, Eye, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { api } from "~/trpc/react";
import { formatRelativeTime, parseTextForLinks } from "~/lib/utils";
import { toast } from "sonner";
import { Download } from "lucide-react";

// Component to render text with clickable links
const TextWithLinks = ({ text }: { text: string }) => {
  const parts = parseTextForLinks(text);

  return (
    <>
      {parts.map((part, index) => {
        if (part.type === 'link') {
          return (
            <a
              key={index}
              href={part.content}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:text-primary/80"
            >
              {part.content}
            </a>
          );
        }
        return <span key={index}>{part.content}</span>;
      })}
    </>
  );
};

export default function PortalFormsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const companySlug = params?.companySlug as string;
  const clientSlug = params?.clientSlug as string;
  const submissionIdFromUrl = searchParams?.get("submissionId");

  const [submissionsPage, setSubmissionsPage] = useState(1);
  const [formFilter, setFormFilter] = useState<string>("all");
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isCreatingTicket, setIsCreatingTicket] = useState(false);
  const [ticketSubject, setTicketSubject] = useState("");
  const [ticketPriority, setTicketPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [activeTab, setActiveTab] = useState(submissionIdFromUrl ? "submissions" : "forms");

  // Get available forms
  const { data: forms, isLoading: formsLoading } =
    api.customerPortal.getForms.useQuery({
      companySlug,
      clientSlug,
    });

  // Get user's submissions
  const { data: submissionsData, isLoading: submissionsLoading } =
    api.customerPortal.getFormSubmissions.useQuery({
      companySlug,
      clientSlug,
      page: submissionsPage,
      limit: 10,
      formId: formFilter !== "all" ? formFilter : undefined,
    });

  const { data: company } = api.company.getSettings.useQuery();

  const submissions = submissionsData?.submissions || [];

  // Reset page when form filter changes
  useEffect(() => {
    setSubmissionsPage(1);
  }, [formFilter]);

  // Auto-open submission detail when navigating from ticket
  useEffect(() => {
    if (submissionIdFromUrl && submissions.length > 0 && !selectedSubmission) {
      const submission = submissions.find((s: any) => s.id === submissionIdFromUrl);
      if (submission) {
        setSelectedSubmission(submission);
        setIsDetailDialogOpen(true);
        // Clear the URL parameter
        router.replace(`/portal/${companySlug}/${clientSlug}/forms`, { scroll: false });
      }
    }
  }, [submissionIdFromUrl, submissions, selectedSubmission, router, companySlug, clientSlug]);

  const createTicketMutation = api.customerPortal.createTicketFromSubmission.useMutation({
    onSuccess: (ticket) => {
      toast.success("Ticket created successfully");
      setIsCreatingTicket(false);
      setSelectedSubmission(null);
      setTicketSubject("");
      setTicketPriority("medium");
      router.push(`/portal/${companySlug}/${clientSlug}/${ticket.id}`);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create ticket");
    },
  });

  const openForm = (formSlug: string) => {
    if (!company?.slug) return;
    router.push(`/forms/${company?.slug}/${clientSlug}/${formSlug}`);
  };

  const handleCreateTicket = () => {
    if (!selectedSubmission) return;

    createTicketMutation.mutate({
      companySlug,
      clientSlug,
      submissionId: selectedSubmission.id,
      subject: ticketSubject || undefined,
      priority: ticketPriority,
    });
  };

  const utils = api.useUtils();

  const handleDownloadCSV = async () => {
    if (formFilter === "all") return;

    try {
      const selectedForm = forms?.find((f: any) => f.id === formFilter);
      if (!selectedForm) return;

      toast.loading("Generating CSV...");

      // Fetch CSV data using tRPC
      const csvContent = await utils.customerPortal.downloadSubmissionsCSV.fetch({
        companySlug,
        clientSlug,
        formId: formFilter,
      });

      // Create blob and download (BOM is already included in csvContent)
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedForm.name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_submissions.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.dismiss();
      toast.success("CSV downloaded successfully");
    } catch (error) {
      toast.dismiss();
      toast.error("Failed to download CSV");
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Forms</h1>
        <p className="text-muted-foreground">
          Fill out forms and view your submissions
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="forms">Available Forms</TabsTrigger>
          <TabsTrigger value="submissions">My Submissions</TabsTrigger>
        </TabsList>

        {/* Available Forms Tab */}
        <TabsContent value="forms">
          <Card>
            <CardHeader>
              <CardTitle>Available Forms</CardTitle>
              <CardDescription>Click on a form to fill it out</CardDescription>
            </CardHeader>
            <CardContent>
              {formsLoading ? (
                <div className="py-8 text-center text-muted-foreground">
                  Loading forms...
                </div>
              ) : !forms || forms.length === 0 ? (
                <div className="py-8 text-center">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <h3 className="mt-4 text-lg font-semibold">
                    No forms available
                  </h3>
                  <p className="mt-2 text-muted-foreground">
                    There are no forms available for you at this time
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {forms.map((form: any) => (
                    <Card
                      key={form.id}
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => openForm(form.slug)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-lg">
                              {form.name}
                            </CardTitle>
                            {form.description && (
                              <CardDescription>
                                {form.description}
                              </CardDescription>
                            )}
                          </div>
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* My Submissions Tab */}
        <TabsContent value="submissions">
          <Card>
            <CardHeader>
              <CardTitle>My Submissions</CardTitle>
              <CardDescription>View your past form submissions</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Filter */}
              <div className="mb-4 flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="form-filter" className="text-sm font-medium">
                    Filter by form:
                  </Label>
                  <Select value={formFilter} onValueChange={setFormFilter}>
                    <SelectTrigger id="form-filter" className="w-[250px]">
                      <SelectValue placeholder="All forms" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All forms</SelectItem>
                      {forms?.map((form: any) => (
                        <SelectItem key={form.id} value={form.id}>
                          {form.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {formFilter !== "all" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadCSV()}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download CSV
                  </Button>
                )}
              </div>

              {submissionsLoading ? (
                <div className="py-8 text-center text-muted-foreground">
                  Loading submissions...
                </div>
              ) : submissions.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No submissions yet
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Form</TableHead>
                        <TableHead>Submitted At</TableHead>
                        <TableHead>Ticket</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.map((submission: any) => (
                        <TableRow key={submission.id}>
                          <TableCell className="font-medium">
                            {submission.form.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatRelativeTime(
                              new Date(submission.submitted_at),
                            )}
                          </TableCell>
                          <TableCell>
                            {submission.ticket ? (
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="link"
                                  className="h-auto p-0"
                                  onClick={() =>
                                    router.push(
                                      `/portal/${companySlug}/${clientSlug}?ticket=${submission.ticket.id}`,
                                    )
                                  }
                                >
                                  <ExternalLink className="mr-2 h-4 w-4" />
                                  {submission.ticket.subject}
                                </Button>
                                <Badge
                                  variant={
                                    submission.ticket.status === "resolved"
                                      ? "default"
                                      : "secondary"
                                  }
                                >
                                  {submission.ticket.status}
                                </Badge>
                              </div>
                            ) : (
                              <Badge variant="secondary">No Ticket</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedSubmission(submission);
                                  setIsDetailDialogOpen(true);
                                }}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View
                              </Button>
                              {!submission.ticket && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedSubmission(submission);
                                    setTicketSubject(`Form submission: ${submission.form.name}`);
                                    setIsCreatingTicket(true);
                                  }}
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
                  {submissionsData &&
                    submissionsData.totalPages &&
                    submissionsData.totalPages > 1 && (
                      <div className="mt-4 flex items-center justify-between">
                        <div className="text-sm text-muted-foreground">
                          Page {submissionsPage} of {submissionsData.totalPages}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setSubmissionsPage((p) => Math.max(1, p - 1))
                            }
                            disabled={submissionsPage === 1}
                          >
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setSubmissionsPage((p) =>
                                Math.min(submissionsData.totalPages, p + 1),
                              )
                            }
                            disabled={
                              submissionsPage === submissionsData.totalPages
                            }
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
        </TabsContent>
      </Tabs>

      {/* Submission Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <DialogTitle>Submission Details</DialogTitle>
              <span className="text-sm text-muted-foreground">
                {formatRelativeTime(new Date(selectedSubmission?.submitted_at || new Date()))}
              </span>
            </div>
          </DialogHeader>
          {selectedSubmission && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <p className="text-lg font-semibold">{selectedSubmission.form.name}</p>
                {selectedSubmission.external_id && (
                  <div className="text-right text-xs text-muted-foreground space-y-0.5 flex-shrink-0">
                    <p>
                      <span className="font-medium">Ref:</span> {selectedSubmission.external_id}
                    </p>
                    {selectedSubmission.external_type && (
                      <p>
                        <span className="font-medium">Type:</span> {selectedSubmission.external_type}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {selectedSubmission.description && (
                <div className="text-sm text-gray-700 whitespace-pre-wrap border-l-2 border-muted pl-3">
                  <TextWithLinks text={selectedSubmission.description} />
                </div>
              )}

              {selectedSubmission.ticket && (
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Related Ticket</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Button
                      variant="link"
                      className="h-auto p-0"
                      onClick={() => {
                        router.push(`/portal/${companySlug}/${clientSlug}/${selectedSubmission.ticket.id}`);
                        setIsDetailDialogOpen(false);
                      }}
                    >
                      {selectedSubmission.ticket.subject}
                    </Button>
                    <Badge>{selectedSubmission.ticket.status}</Badge>
                  </div>
                </div>
              )}

              <div className="space-y-3 border-t pt-4">
                <h3 className="text-sm font-medium text-gray-500">Form Data</h3>
                {selectedSubmission.form?.fields && (selectedSubmission.form.fields as any[]).map((field: any) => {
                  const value = (selectedSubmission.data as any)?.[field.id];
                  if (!value) return null;
                  return (
                    <div key={field.id} className="space-y-1">
                      <p className="text-sm font-medium text-gray-700">{field.label}</p>
                      <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        {Array.isArray(value)
                          ? value.join(', ')
                          : typeof value === 'object'
                          ? JSON.stringify(value, null, 2)
                          : String(value)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Ticket Dialog */}
      <Dialog open={isCreatingTicket} onOpenChange={setIsCreatingTicket}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Ticket from Submission</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                placeholder="Ticket subject"
              />
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
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
            <Button variant="outline" onClick={() => setIsCreatingTicket(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTicket} disabled={createTicketMutation.isPending}>
              {createTicketMutation.isPending ? "Creating..." : "Create Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
