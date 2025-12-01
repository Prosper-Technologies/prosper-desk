"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import {
  ArrowLeft,
  UserPlus,
  Mail,
  Shield,
  User,
  Check,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { api } from "~/trpc/react";

export default function AddTeamMemberPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "agent" | "none">("none");
  const [sendInvite, setSendInvite] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  const inviteMember = api.user.invite.useMutation({
    onSuccess: () => {
      setSuccess(`${firstName} ${lastName} has been invited to the team!`);
      // Redirect after success
      setTimeout(() => {
        router.push("/team");
      }, 2000);
    },
    onError: (error) => {
      setError(error.message);
      setIsLoading(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setSuccess("");

    if (!firstName || !lastName || !email || role === "none") {
      setError("Please fill in all required fields");
      setIsLoading(false);
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      setIsLoading(false);
      return;
    }

    try {
      inviteMember.mutate({
        email,
        firstName,
        lastName,
        role: role as "admin" | "agent",
      });
    } catch (err) {
      setError("Failed to add team member. Please try again.");
      setIsLoading(false);
    }
  };

  const getRoleDescription = (roleValue: string) => {
    switch (roleValue) {
      case "admin":
        return "Full access to all features, settings, and team management";
      case "agent":
        return "Can manage tickets, view reports, and access knowledge base";
      default:
        return "";
    }
  };

  if (success) {
    return (
      <div className="space-y-6">
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="/team">Team</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Add Member</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <div className="p-4">
          <Card className="mx-auto max-w-md">
            <CardContent className="pt-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <Check className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="mb-2 text-lg font-medium text-gray-900">
                Success!
              </h3>
              <p className="mb-4 text-gray-600">{success}</p>
              <Button asChild className="w-full">
                <Link href="/team">Return to Team</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/team">Team</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Add Member</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="space-y-6 p-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/team">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Team
            </Link>
          </Button>
          <div>
            <h1 className="flex items-center gap-2 text-lg font-bold">
              <UserPlus />
              Add Team Member
            </h1>
            <p className="text-sm text-gray-600">
              Invite a new member to join your support team
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>Member Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Information */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="firstName" className="text-sm font-medium">
                      First Name *
                    </label>
                    <Input
                      id="firstName"
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="lastName" className="text-sm font-medium">
                      Last Name *
                    </label>
                    <Input
                      id="lastName"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="john.doe@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Role */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Role *</label>
                  <Select
                    value={role}
                    onValueChange={(value: any) => setRole(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-gray-500">Select a role</span>
                      </SelectItem>
                      <SelectItem value="agent">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <div>
                            <div className="font-medium">Agent</div>
                            <div className="text-xs text-gray-500">
                              Handle tickets and customer support
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          <div>
                            <div className="font-medium">Administrator</div>
                            <div className="text-xs text-gray-500">
                              Full access to all features
                            </div>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {role && role !== "none" && (
                    <div className="rounded-lg bg-gray-50 p-3">
                      <p className="text-sm text-gray-600">
                        <strong className="capitalize">{role}:</strong>{" "}
                        {getRoleDescription(role)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Send Invitation */}
                <div className="flex items-center justify-between rounded-lg bg-blue-50 p-4">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-blue-900">
                        Send Invitation Email
                      </p>
                      <p className="text-sm text-blue-700">
                        The new member will receive an email with setup
                        instructions
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={sendInvite}
                    onCheckedChange={setSendInvite}
                    disabled={isLoading}
                  />
                </div>

                {/* Error Message */}
                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    asChild
                    disabled={isLoading}
                  >
                    <Link href="/team">Cancel</Link>
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                        {sendInvite ? "Sending Invite..." : "Adding Member..."}
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        {sendInvite ? "Send Invitation" : "Add Member"}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Role Permissions Info */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">Role Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Shield className="mt-0.5 h-5 w-5 text-red-500" />
                  <div>
                    <h4 className="font-medium text-gray-900">Administrator</h4>
                    <ul className="mt-1 space-y-1 text-sm text-gray-600">
                      <li>• Manage all tickets and customer interactions</li>
                      <li>• Add, edit, and remove team members</li>
                      <li>• Configure system settings and integrations</li>
                      <li>• Access all reports and analytics</li>
                      <li>• Manage knowledge base and company settings</li>
                    </ul>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <User className="mt-0.5 h-5 w-5 text-blue-500" />
                  <div>
                    <h4 className="font-medium text-gray-900">Agent</h4>
                    <ul className="mt-1 space-y-1 text-sm text-gray-600">
                      <li>• Create, update, and resolve tickets</li>
                      <li>• Communicate with customers</li>
                      <li>• Access knowledge base articles</li>
                      <li>• View basic reports and metrics</li>
                      <li>• Update their own profile settings</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
