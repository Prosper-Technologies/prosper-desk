"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { api } from "~/trpc/react";
import { toast } from "sonner";

export default function PublicFormPage() {
  const params = useParams();
  const router = useRouter();

  const companySlug = params?.companySlug as string;
  const formSlug = params?.formSlug as string;

  const [formData, setFormData] = useState<Record<string, any>>({});
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState("");

  const {
    data: form,
    isLoading,
    error,
  } = api.forms.getPublicBySlug.useQuery({
    company_slug: companySlug,
    form_slug: formSlug,
  });

  const submitMutation = api.forms.submitPublic.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      setSubmissionMessage(data.message);
      setFormData({});
      setContactName("");
      setContactEmail("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    const fields = (form?.fields as any[]) || [];
    for (const field of fields) {
      if (field.required && !formData[field.id]) {
        toast.error(`${field.label} is required`);
        return;
      }
    }

    // Check if contact info is needed
    const settings = form?.settings as any;
    if (settings?.collect_contact_info && (!contactName || !contactEmail)) {
      toast.error("Please provide your name and email");
      return;
    }

    submitMutation.mutate({
      company_slug: companySlug,
      form_slug: formSlug,
      data: formData,
      contact: {
        name: contactName,
        email: contactEmail,
      },
    });
  };

  const renderField = (field: any) => {
    const value = formData[field.id];

    switch (field.type) {
      case "text":
      case "email":
      case "phone":
        return (
          <Input
            type={field.type}
            value={value || ""}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
          />
        );

      case "number":
        return (
          <Input
            type="number"
            value={value || ""}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            min={field.min}
            max={field.max}
          />
        );

      case "textarea":
        return (
          <Textarea
            value={value || ""}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            rows={4}
          />
        );

      case "select":
        return (
          <Select
            value={value || ""}
            onValueChange={(val) => handleFieldChange(field.id, val)}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={field.placeholder || "Select an option"}
              />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option: any) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "radio":
        return (
          <RadioGroup
            value={value || ""}
            onValueChange={(val) => handleFieldChange(field.id, val)}
          >
            {field.options?.map((option: any) => (
              <div key={option.value} className="flex items-center space-x-2">
                <RadioGroupItem
                  value={option.value}
                  id={`${field.id}-${option.value}`}
                />
                <Label htmlFor={`${field.id}-${option.value}`}>
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case "checkbox":
        return (
          <div className="space-y-2">
            {field.options?.map((option: any) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  checked={(value || []).includes(option.value)}
                  onCheckedChange={(checked) => {
                    const currentValues = value || [];
                    const newValues = checked
                      ? [...currentValues, option.value]
                      : currentValues.filter((v: string) => v !== option.value);
                    handleFieldChange(field.id, newValues);
                  }}
                  id={`${field.id}-${option.value}`}
                />
                <Label htmlFor={`${field.id}-${option.value}`}>
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        );

      case "rating":
        const max = field.max || 5;
        const min = field.min || 1;
        return (
          <div className="flex gap-2">
            {Array.from({ length: max - min + 1 }, (_, i) => min + i).map(
              (num) => (
                <Button
                  key={num}
                  type="button"
                  variant={value === num ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleFieldChange(field.id, num)}
                >
                  {num}
                </Button>
              ),
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Form Not Found</CardTitle>
            <CardDescription>
              This form does not exist or is not published.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md text-center">
          <CardContent className="space-y-4 pt-6">
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
            <h2 className="text-2xl font-bold">Thank You!</h2>
            <p className="text-muted-foreground">{submissionMessage}</p>
            <Button onClick={() => setSubmitted(false)}>
              Submit Another Response
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const settings = form.settings as any;
  const fields = (form.fields as any[]) || [];

  return (
    <div className="min-h-screen bg-muted/30 px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">{form.name}</CardTitle>
            {form.description && (
              <CardDescription className="text-base">
                {form.description}
              </CardDescription>
            )}
            <div className="pt-2 text-sm text-muted-foreground">
              Powered by {form.company_name}
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Contact Information (for anonymous users) */}
              {settings?.collect_contact_info && (
                <div className="space-y-4 rounded-lg bg-muted/50 p-4">
                  <h3 className="font-semibold">Contact Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contact-name">Name *</Label>
                      <Input
                        id="contact-name"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder="Your name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact-email">Email *</Label>
                      <Input
                        id="contact-email"
                        type="email"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Form Fields */}
              {fields
                .sort((a, b) => a.order - b.order)
                .map((field) => (
                  <div key={field.id} className="space-y-2">
                    <Label>
                      {field.label}
                      {field.required && (
                        <span className="ml-1 text-destructive">*</span>
                      )}
                    </Label>
                    {field.description && (
                      <p className="text-sm text-muted-foreground">
                        {field.description}
                      </p>
                    )}
                    {renderField(field)}
                  </div>
                ))}

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full"
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
