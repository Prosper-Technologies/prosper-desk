"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { DashboardHeader } from "~/components/layout/dashboard-header";
import {
  Users,
  Search,
  Plus,
  MoreHorizontal,
  Mail,
  Calendar,
  UserCheck,
  UserX,
  Shield,
  User,
  TestTube,
  Send,
} from "lucide-react";
import { api } from "~/trpc/react";

const getRoleColor = (role: string) => {
  switch (role) {
    case "admin":
      return "bg-red-100 text-red-800 border-red-200";
    case "agent":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "owner":
      return "bg-green-100 text-green-800 border-green-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const getInitials = (firstName: string, lastName: string) => {
  return `${firstName[0]}${lastName[0]}`.toUpperCase();
};

const formatLastSeen = (date: Date) => {
  const now = new Date();
  const diffInHours = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60),
  );

  if (diffInHours < 1) {
    return "Active now";
  } else if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  } else {
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  }
};

export default function TeamPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<
    "all" | "admin" | "agent" | "owner"
  >("all");
  const [testEmailOpen, setTestEmailOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testEmailSuccess, setTestEmailSuccess] = useState("");

  const { data: members, refetch } = api.user.getAll.useQuery();

  const filteredMembers = members?.filter((member) => {
    const matchesSearch =
      member.user.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.user.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === "all" || member.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const deactivateMember = api.user.deactivate.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const updateMember = api.user.update.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleDeactivate = (memberId: string) => {
    deactivateMember.mutate({ id: memberId });
  };

  const handleReactivate = (memberId: string) => {
    updateMember.mutate({ id: memberId, isActive: true });
  };

  const testEmailMutation = api.user.testEmail.useMutation({
    onSuccess: (data) => {
      setTestEmailSuccess(data.message);
      setTimeout(() => {
        setTestEmailOpen(false);
        setTestEmailSuccess("");
        setTestEmail("");
      }, 2000);
    },
  });

  const handleTestEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (testEmail.trim()) {
      testEmailMutation.mutate({ email: testEmail.trim() });
    }
  };

  return (
    <div>
      <DashboardHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Team" },
        ]}
      />

      <div className="space-y-6 p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold">
              <Users className="h-4 w-4" />
              Team Members
            </h1>
            <p className="text-gray-600">
              Manage your support team members and their roles
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={testEmailOpen} onOpenChange={setTestEmailOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <TestTube className="mr-2 h-4 w-4" />
                  Test Email
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Test Email Sending</DialogTitle>
                </DialogHeader>
                {testEmailSuccess ? (
                  <div className="py-8 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                      <Send className="h-6 w-6 text-green-600" />
                    </div>
                    <p className="text-green-600">{testEmailSuccess}</p>
                  </div>
                ) : (
                  <form onSubmit={handleTestEmail} className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="testEmail" className="text-sm font-medium">
                        Email Address
                      </label>
                      <Input
                        id="testEmail"
                        type="email"
                        placeholder="test@useblueos.com"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                        required
                        disabled={testEmailMutation.isPending}
                      />
                      <p className="text-xs text-gray-500">
                        This will send a test invitation email from your useblueos.com domain to verify Resend is working properly.
                      </p>
                    </div>
                    {testEmailMutation.error && (
                      <div className="text-sm text-red-600">
                        {testEmailMutation.error.message}
                      </div>
                    )}
                    <div className="flex justify-end gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setTestEmailOpen(false)}
                        disabled={testEmailMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={testEmailMutation.isPending}>
                        {testEmailMutation.isPending ? (
                          <>
                            <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Send Test Email
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </DialogContent>
            </Dialog>
            <Button asChild size="sm">
              <Link href="/team/add">
                <Plus className="mr-2 h-4 w-4" />
                Add Member
              </Link>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Members</p>
                  <p className="text-lg font-bold">{members?.length}</p>
                </div>
                <Users className="h-4 w-4 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Members</p>
                  <p className="text-lg font-bold">
                    {
                      members?.filter((m) => m.is_active && m.user.last_seen_at)
                        .length
                    }
                  </p>
                </div>
                <UserCheck className="h-4 w-4 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Administrators</p>
                  <p className="text-lg font-bold">
                    {members?.filter((m) => m.role === "admin").length}
                  </p>
                </div>
                <Shield className="h-4 w-4 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
                <Input
                  placeholder="Search team members..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={roleFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRoleFilter("all")}
                >
                  All Roles
                </Button>
                <Button
                  variant={roleFilter === "admin" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRoleFilter("admin")}
                >
                  Admins
                </Button>
                <Button
                  variant={roleFilter === "agent" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setRoleFilter("agent")}
                >
                  Agents
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Team Members List */}
        <Card>
          <CardHeader>
            <CardTitle>Team Members ({filteredMembers?.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredMembers?.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-4 transition-shadow hover:shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={member.user.avatar_url || undefined} />
                      <AvatarFallback>
                        {getInitials(
                          member.user.first_name,
                          member.user.last_name,
                        )}
                      </AvatarFallback>
                    </Avatar>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">
                          {member.user.first_name} {member.user.last_name}
                        </h3>
                        <Badge className={getRoleColor(member.role)}>
                          {member.role}
                        </Badge>
                        {!member.is_active && (
                          <Badge variant="secondary">
                            <UserX className="mr-1 h-3 w-3" />
                            Inactive
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {member.user.email}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Joined {member.joined_at.toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      <p className="text-gray-600">
                        {member.is_active && member.user.last_seen_at
                          ? formatLastSeen(member.user.last_seen_at)
                          : "Offline"}
                      </p>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link href={`/team/${member.id}`}>
                            <User className="mr-2 h-4 w-4" />
                            View Profile
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            window.open(`mailto:${member.user.email}`)
                          }
                        >
                          <Mail className="mr-2 h-4 w-4" />
                          Send Email
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {member.is_active ? (
                          <DropdownMenuItem
                            onClick={() => handleDeactivate(member.id)}
                            className="text-red-600"
                          >
                            <UserX className="mr-2 h-4 w-4" />
                            Deactivate
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => handleReactivate(member.id)}
                            className="text-green-600"
                          >
                            <UserCheck className="mr-2 h-4 w-4" />
                            Reactivate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}

              {filteredMembers?.length === 0 && (
                <div className="py-12 text-center">
                  <Users className="mx-auto mb-4 h-12 w-12 text-gray-400" />
                  <h3 className="mb-2 text-lg font-medium text-gray-900">
                    No team members found
                  </h3>
                  <p className="mb-4 text-gray-600">
                    No team members data available. Connect to your database or
                    API to load team members.
                  </p>
                  <Button asChild>
                    <Link href="/team/add">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Team Member
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
