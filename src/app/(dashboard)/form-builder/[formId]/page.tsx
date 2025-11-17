"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { Plus, Trash2, Save, Eye, ArrowLeft, Settings2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import { Badge } from "~/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { api } from "~/trpc/react";
import { toast } from "sonner";

type FieldType =
  | "text"
  | "email"
  | "number"
  | "phone"
  | "textarea"
  | "select"
  | "radio"
  | "checkbox"
  | "rating";

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  description?: string;
  placeholder?: string;
  required: boolean;
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  order: number;
}

interface TicketRule {
  id: string;
  name: string;
  field_id: string;
  operator: "eq" | "neq" | "lt" | "lte" | "gt" | "gte" | "contains";
  value: string | number;
  create_ticket: boolean;
  ticket_subject?: string;
  ticket_priority?: "low" | "medium" | "high" | "urgent";
}

export default function FormBuilderPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const formId = params?.formId as string;
  const isNew = formId === "new";
  const clientIdFromUrl = searchParams?.get("clientId");

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [fields, setFields] = useState<FormField[]>([]);
  const [ticketRules, setTicketRules] = useState<TicketRule[]>([]);
  const [isPublished, setIsPublished] = useState(false);
  const [allowMultipleSubmissions, setAllowMultipleSubmissions] =
    useState(true);
  const [collectContactInfo, setCollectContactInfo] = useState(true);
  const [confirmationMessage, setConfirmationMessage] = useState(
    "Thank you for your submission!",
  );

  const { data: form, isLoading } = api.forms.getById.useQuery(
    { id: formId },
    { enabled: !isNew },
  );

  const { data: clients } = api.clients.getAll.useQuery({
    page: 1,
    limit: 50,
  });

  const createMutation = api.forms.create.useMutation({
    onSuccess: () => {
      toast.success("Form created successfully");
      router.push("/form-builder");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = api.forms.update.useMutation({
    onSuccess: () => {
      toast.success("Form updated successfully");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const publishMutation = api.forms.publish.useMutation({
    onSuccess: () => {
      toast.success(
        `Form ${isPublished ? "unpublished" : "published"} successfully`,
      );
      setIsPublished(!isPublished);
    },
  });

  useEffect(() => {
    if (form) {
      setName(form.name);
      setSlug(form.slug);
      setDescription(form.description || "");
      setClientId(form.client_id || "");
      setFields((form.fields as FormField[]) || []);
      setTicketRules((form.ticket_rules as TicketRule[]) || []);
      setIsPublished(form.is_published);

      const settings = form.settings as any;
      setAllowMultipleSubmissions(settings?.allow_multiple_submissions ?? true);
      setCollectContactInfo(settings?.collect_contact_info ?? true);
      setConfirmationMessage(
        settings?.confirmation_message || "Thank you for your submission!",
      );
    }
  }, [form]);

  // Auto-generate slug from name
  useEffect(() => {
    if (isNew && name && !slug) {
      const generatedSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      setSlug(generatedSlug);
    }
  }, [name, slug, isNew]);

  // Set clientId from URL parameter when creating new form
  useEffect(() => {
    if (isNew && clientIdFromUrl && !clientId) {
      setClientId(clientIdFromUrl);
    }
  }, [isNew, clientIdFromUrl, clientId]);

  const addField = () => {
    const newField: FormField = {
      id: crypto.randomUUID(),
      type: "text",
      label: `Field ${fields.length + 1}`,
      required: false,
      order: fields.length,
    };
    setFields([...fields, newField]);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const removeField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
  };

  const addTicketRule = () => {
    if (fields.length === 0) {
      toast.error("Please add at least one field before creating rules");
      return;
    }

    const newRule: TicketRule = {
      id: crypto.randomUUID(),
      name: `Rule ${ticketRules.length + 1}`,
      field_id: fields[0]!.id,
      operator: "eq",
      value: "",
      create_ticket: true,
      ticket_priority: "medium",
    };
    setTicketRules([...ticketRules, newRule]);
  };

  const updateTicketRule = (id: string, updates: Partial<TicketRule>) => {
    setTicketRules(
      ticketRules.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    );
  };

  const removeTicketRule = (id: string) => {
    setTicketRules(ticketRules.filter((r) => r.id !== id));
  };

  const handleSave = () => {
    if (!name || !slug) {
      toast.error("Name and slug are required");
      return;
    }

    if (!clientId) {
      toast.error("Please select a client");
      return;
    }

    if (fields.length === 0) {
      toast.error("Please add at least one field");
      return;
    }

    const formData = {
      name,
      slug,
      description,
      client_id: clientId || undefined,
      fields,
      settings: {
        allow_multiple_submissions: allowMultipleSubmissions,
        collect_contact_info: collectContactInfo,
        confirmation_message: confirmationMessage,
      },
      ticket_rules: ticketRules,
    };

    if (isNew) {
      createMutation.mutate(formData);
    } else {
      updateMutation.mutate({ id: formId, ...formData });
    }
  };

  const handlePublish = () => {
    publishMutation.mutate({ id: formId, is_published: !isPublished });
  };

  if (!isNew && isLoading) {
    return (
      <div className="p-6">
        <div className="py-8 text-center">Loading form...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/form-builder")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isNew ? "Create Form" : "Edit Form"}
            </h1>
            <p className="text-muted-foreground">
              {isNew ? "Create a new form" : `Editing: ${form?.name}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {!isNew && (
            <Button variant="outline" onClick={handlePublish}>
              {isPublished ? "Unpublish" : "Publish"}
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {isNew ? "Create" : "Save"}
          </Button>
        </div>
      </div>

      {!isNew && (
        <div className="flex items-center gap-2">
          <Badge variant={isPublished ? "default" : "secondary"}>
            {isPublished ? "Published" : "Draft"}
          </Badge>
        </div>
      )}

      <Tabs defaultValue="design" className="space-y-6">
        <TabsList>
          <TabsTrigger value="design">Design</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="automation">Automation</TabsTrigger>
        </TabsList>

        {/* Design Tab */}
        <TabsContent value="design" className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>
                Set up the basic details of your form
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Form Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Customer Feedback Form"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug *</Label>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="e.g., customer-feedback"
                />
                <p className="text-sm text-muted-foreground">
                  This will be used in the form URL
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this form is for..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="client">Client *</Label>
                <Select value={clientId} onValueChange={setClientId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients?.clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Fields */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Form Fields</CardTitle>
                  <CardDescription>
                    Add and configure form fields
                  </CardDescription>
                </div>
                <Button onClick={addField}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Field
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No fields yet. Click "Add Field" to get started.
                </div>
              ) : (
                fields.map((field, index) => (
                  <Card key={field.id}>
                    <CardContent className="space-y-4 pt-6">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">Field {index + 1}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeField(field.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Field Type</Label>
                          <Select
                            value={field.type}
                            onValueChange={(value: FieldType) =>
                              updateField(field.id, { type: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="number">Number</SelectItem>
                              <SelectItem value="phone">Phone</SelectItem>
                              <SelectItem value="textarea">
                                Text Area
                              </SelectItem>
                              <SelectItem value="select">Select</SelectItem>
                              <SelectItem value="radio">Radio</SelectItem>
                              <SelectItem value="checkbox">Checkbox</SelectItem>
                              <SelectItem value="rating">Rating</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Label</Label>
                          <Input
                            value={field.label}
                            onChange={(e) =>
                              updateField(field.id, { label: e.target.value })
                            }
                            placeholder="e.g., Your Name"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Placeholder</Label>
                          <Input
                            value={field.placeholder || ""}
                            onChange={(e) =>
                              updateField(field.id, {
                                placeholder: e.target.value,
                              })
                            }
                            placeholder="e.g., Enter your name"
                          />
                        </div>

                        <div className="flex items-end space-y-2">
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={field.required}
                              onCheckedChange={(checked) =>
                                updateField(field.id, { required: checked })
                              }
                            />
                            <Label>Required</Label>
                          </div>
                        </div>
                      </div>

                      {(field.type === "select" ||
                        field.type === "radio" ||
                        field.type === "checkbox") && (
                        <div className="space-y-2">
                          <Label>Options (one per line)</Label>
                          <Textarea
                            value={
                              field.options?.map((o) => o.label).join("\n") ||
                              ""
                            }
                            onChange={(e) => {
                              const options = e.target.value
                                .split("\n")
                                .filter((l) => l.trim())
                                .map((label) => ({
                                  label,
                                  value: label
                                    .toLowerCase()
                                    .replace(/\s+/g, "-"),
                                }));
                              updateField(field.id, { options });
                            }}
                            placeholder="Option 1&#10;Option 2&#10;Option 3"
                          />
                        </div>
                      )}

                      {field.type === "rating" && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Min Value</Label>
                            <Input
                              type="number"
                              value={field.min || 1}
                              onChange={(e) =>
                                updateField(field.id, {
                                  min: parseInt(e.target.value),
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Max Value</Label>
                            <Input
                              type="number"
                              value={field.max || 5}
                              onChange={(e) =>
                                updateField(field.id, {
                                  max: parseInt(e.target.value),
                                })
                              }
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Form Settings</CardTitle>
              <CardDescription>Configure form behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Allow Multiple Submissions</Label>
                  <p className="text-sm text-muted-foreground">
                    Users can submit the form multiple times
                  </p>
                </div>
                <Switch
                  checked={allowMultipleSubmissions}
                  onCheckedChange={setAllowMultipleSubmissions}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Collect Contact Information</Label>
                  <p className="text-sm text-muted-foreground">
                    Ask for name and email from anonymous users
                  </p>
                </div>
                <Switch
                  checked={collectContactInfo}
                  onCheckedChange={setCollectContactInfo}
                />
              </div>

              <div className="space-y-2">
                <Label>Confirmation Message</Label>
                <Textarea
                  value={confirmationMessage}
                  onChange={(e) => setConfirmationMessage(e.target.value)}
                  placeholder="Thank you for your submission!"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Ticket Creation Rules</CardTitle>
                  <CardDescription>
                    Automatically create tickets based on form responses
                  </CardDescription>
                </div>
                <Button onClick={addTicketRule} disabled={fields.length === 0}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Rule
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {ticketRules.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No automation rules yet. Add a rule to automatically create
                  tickets.
                </div>
              ) : (
                ticketRules.map((rule, index) => (
                  <Card key={rule.id}>
                    <CardContent className="space-y-4 pt-6">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">Rule {index + 1}</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTicketRule(rule.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 space-y-2">
                          <Label>Rule Name</Label>
                          <Input
                            value={rule.name}
                            onChange={(e) =>
                              updateTicketRule(rule.id, {
                                name: e.target.value,
                              })
                            }
                            placeholder="e.g., Low Rating Alert"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Field</Label>
                          <Select
                            value={rule.field_id}
                            onValueChange={(value) =>
                              updateTicketRule(rule.id, { field_id: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {fields.map((field) => (
                                <SelectItem key={field.id} value={field.id}>
                                  {field.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Operator</Label>
                          <Select
                            value={rule.operator}
                            onValueChange={(value: any) =>
                              updateTicketRule(rule.id, { operator: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="eq">Equals</SelectItem>
                              <SelectItem value="neq">Not Equals</SelectItem>
                              <SelectItem value="lt">Less Than</SelectItem>
                              <SelectItem value="lte">
                                Less Than or Equal
                              </SelectItem>
                              <SelectItem value="gt">Greater Than</SelectItem>
                              <SelectItem value="gte">
                                Greater Than or Equal
                              </SelectItem>
                              <SelectItem value="contains">Contains</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Value</Label>
                          <Input
                            value={rule.value}
                            onChange={(e) =>
                              updateTicketRule(rule.id, {
                                value: e.target.value,
                              })
                            }
                            placeholder="e.g., 3"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Ticket Priority</Label>
                          <Select
                            value={rule.ticket_priority}
                            onValueChange={(value: any) =>
                              updateTicketRule(rule.id, {
                                ticket_priority: value,
                              })
                            }
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

                        <div className="col-span-2 space-y-2">
                          <Label>Ticket Subject Template</Label>
                          <Input
                            value={rule.ticket_subject || ""}
                            onChange={(e) =>
                              updateTicketRule(rule.id, {
                                ticket_subject: e.target.value,
                              })
                            }
                            placeholder="e.g., Low rating from {{customer_name}}"
                          />
                          <p className="text-sm text-muted-foreground">
                            Use for field values
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
