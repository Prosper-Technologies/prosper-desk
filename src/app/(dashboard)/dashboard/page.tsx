"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Ticket,
  Users,
  Clock,
  AlertTriangle,
  TrendingUp,
  Calendar,
  BarChart3,
} from "lucide-react";
import { api } from "~/trpc/react";
import {
  formatRelativeTime,
  getStatusColor,
  getPriorityColor,
  getInitials,
} from "~/lib/utils";
import { DashboardHeader } from "~/components/layout/dashboard-header";

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    endDate: new Date(),
  });
  const [selectedClientId, setSelectedClientId] = useState<string>("all");

  const { data: metrics, isLoading: metricsLoading } =
    api.dashboard.getMetrics.useQuery({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      clientId: selectedClientId === "all" ? undefined : selectedClientId,
    });

  const { data: clients } = api.client.getAll.useQuery({
    page: 1,
    limit: 50,
  });

  const { data: trends, isLoading: trendsLoading } =
    api.dashboard.getTicketTrends.useQuery({
      days: 30,
    });

  const { data: workload, isLoading: workloadLoading } =
    api.dashboard.getAgentWorkload.useQuery();

  if (metricsLoading || trendsLoading || workloadLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="mb-6 h-8 w-48 rounded bg-gray-200"></div>
          <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 rounded-lg bg-gray-200"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const statusData = metrics?.ticketsByStatus || [];
  const priorityData = metrics?.ticketsByPriority || [];
  const slaMetrics = metrics?.slaMetrics || {
    totalWithSLA: 0,
    breachedResponse: 0,
    breachedResolution: 0,
    avgResponseTimeMinutes: 0,
  };

  const slaComplianceRate =
    slaMetrics.totalWithSLA > 0
      ? ((slaMetrics.totalWithSLA - slaMetrics.breachedResolution) /
          slaMetrics.totalWithSLA) *
        100
      : 0;

  return (
    <div>
      <DashboardHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Overview" },
        ]}
      />

      <div className="space-y-6 p-4">
        {/* Title Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">
              Overview of your helpdesk performance
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Select
              value={selectedClientId}
              onValueChange={setSelectedClientId}
            >
              <SelectTrigger className="w-48">
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
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">Last 30 days</span>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Tickets
              </CardTitle>
              <Ticket className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">
                {metrics?.totalTickets || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                +12% from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Open Tickets
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">
                {statusData.find((s) => s.status === "open")?.count || 0}
              </div>
              <p className="text-xs text-muted-foreground">Awaiting response</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                SLA Compliance
              </CardTitle>
              <Clock className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">
                {slaComplianceRate.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground">
                Resolution within SLA
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Avg Response Time
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">
                {Math.round(Number(slaMetrics.avgResponseTimeMinutes) / 60) ||
                  0}
                h
              </div>
              <p className="text-xs text-muted-foreground">
                Average first response
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Ticket Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="mr-2 h-5 w-5" />
                Ticket Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {statusData.map((status) => (
                  <div
                    key={status.status}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(status.status as any)}>
                        {status.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="text-sm font-medium">{status.count}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Priority Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="mr-2 h-5 w-5" />
                Priority Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {priorityData.map((priority) => (
                  <div
                    key={priority.priority}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2">
                      <Badge
                        className={getPriorityColor(priority.priority as any)}
                      >
                        {priority.priority}
                      </Badge>
                    </div>
                    <div className="text-sm font-medium">{priority.count}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Recent Tickets */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Ticket className="mr-2 h-5 w-5" />
                Recent Tickets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics?.recentTickets?.slice(0, 5).map((ticket) => (
                  <div
                    key={ticket.id}
                    className="flex items-start space-x-3 rounded-lg border p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {ticket.subject}
                      </p>
                      <div className="mt-1 flex items-center space-x-2">
                        <Badge className={getStatusColor(ticket.status)}>
                          {ticket.status.replace("_", " ")}
                        </Badge>
                        <Badge className={getPriorityColor(ticket.priority)}>
                          {ticket.priority}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatRelativeTime(ticket.created_at)}
                      </p>
                    </div>
                    {ticket.assignedToMembership?.user && (
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
                    )}
                  </div>
                ))}
                {(!metrics?.recentTickets ||
                  metrics.recentTickets.length === 0) && (
                  <div className="py-8 text-center text-gray-500">
                    <Ticket className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                      No tickets yet
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Get started by creating your first ticket.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Agent Workload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="mr-2 h-5 w-5" />
                Agent Workload
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workload?.slice(0, 5).map((agent) => (
                  <div
                    key={agent.agentId}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={agent.avatarUrl || undefined} />
                        <AvatarFallback className="text-xs">
                          {getInitials(`${agent.firstName} ${agent.lastName}`)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">
                          {agent.firstName} {agent.lastName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {agent.totalTickets} total tickets
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        {agent.openTickets} open
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {agent.inProgressTickets} in progress
                      </Badge>
                    </div>
                  </div>
                ))}
                {(!workload || workload.length === 0) && (
                  <div className="py-8 text-center text-gray-500">
                    <Users className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">
                      No agents yet
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">
                      Invite team members to start managing tickets.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
