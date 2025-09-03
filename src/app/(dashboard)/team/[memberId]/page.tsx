"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
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
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import {
  ArrowLeft,
  User,
  Mail,
  Calendar,
  Shield,
  UserCheck,
  UserX,
  Edit,
  Save,
  X,
} from "lucide-react";
import { api } from "~/trpc/react";

interface UserProfilePageProps {
  params: {
    memberId: string;
  };
}

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

export default function UserProfilePage({ params }: UserProfilePageProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<"admin" | "agent">("agent");
  const router = useRouter();

  const { data: member, isLoading } = api.user.getById.useQuery({
    id: params.memberId,
  });

  const updateMember = api.user.update.useMutation({
    onSuccess: () => {
      setIsEditing(false);
      // Refetch member data
      api.useContext().user.getById.invalidate({ id: params.memberId });
    },
  });

  const deactivateMember = api.user.deactivate.useMutation({
    onSuccess: () => {
      router.push("/team");
    },
  });

  // Initialize form values when member data loads
  useState(() => {
    if (member) {
      setFirstName(member.user.first_name);
      setLastName(member.user.last_name);
      setRole(member.role as "admin" | "agent");
    }
  }, [member]);

  const handleSave = () => {
    updateMember.mutate({
      id: params.memberId,
      firstName,
      lastName,
      role,
    });
  };

  const handleDeactivate = () => {
    if (confirm("Are you sure you want to deactivate this user?")) {
      deactivateMember.mutate({ id: params.memberId });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (!member) {
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
                <BreadcrumbPage>User Not Found</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>

        <div className="p-4">
          <Card className="mx-auto max-w-md">
            <CardContent className="pt-6 text-center">
              <UserX className="mx-auto mb-4 h-12 w-12 text-gray-400" />
              <h3 className="mb-2 text-lg font-medium text-gray-900">
                User Not Found
              </h3>
              <p className="mb-4 text-gray-600">
                The requested team member could not be found.
              </p>
              <Button asChild>
                <Link href="/team">Back to Team</Link>
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
              <BreadcrumbPage>
                {member.user.first_name} {member.user.last_name}
              </BreadcrumbPage>
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
        </div>

        <div className="mx-auto max-w-2xl space-y-6">
          {/* Profile Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  User Profile
                </CardTitle>
                <div className="flex gap-2">
                  {!isEditing ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(false)}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={updateMember.isPending}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        Save
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Avatar and Basic Info */}
                <div className="flex items-start gap-6">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={member.user.avatar_url || undefined} />
                    <AvatarFallback className="text-lg">
                      {getInitials(member.user.first_name, member.user.last_name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">First Name</label>
                        {isEditing ? (
                          <Input
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                          />
                        ) : (
                          <p className="text-sm text-gray-600">
                            {member.user.first_name}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Last Name</label>
                        {isEditing ? (
                          <Input
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                          />
                        ) : (
                          <p className="text-sm text-gray-600">
                            {member.user.last_name}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Email Address</label>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <p className="text-sm text-gray-600">{member.user.email}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Role</label>
                      {isEditing ? (
                        <Select value={role} onValueChange={(value: any) => setRole(value)}>
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="agent">Agent</SelectItem>
                            <SelectItem value="admin">Administrator</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={getRoleColor(member.role)}>
                          {member.role}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Status and Dates */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <div className="flex items-center gap-2">
                      {member.is_active ? (
                        <>
                          <UserCheck className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-600">Active</span>
                        </>
                      ) : (
                        <>
                          <UserX className="h-4 w-4 text-red-500" />
                          <span className="text-sm text-red-600">Inactive</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Joined</label>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {member.joined_at.toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Last Seen</label>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {member.user.last_seen_at
                          ? member.user.last_seen_at.toLocaleDateString()
                          : "Never"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          {member.is_active && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-600">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-red-900">Deactivate User</h4>
                    <p className="text-sm text-red-700">
                      This user will no longer be able to access the system.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeactivate}
                    disabled={deactivateMember.isPending}
                  >
                    <UserX className="mr-2 h-4 w-4" />
                    Deactivate
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}