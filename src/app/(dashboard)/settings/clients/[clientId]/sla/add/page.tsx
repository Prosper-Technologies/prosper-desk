"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import { Switch } from "~/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb"
import {
  ArrowLeft,
  Save,
  Clock,
  Target,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Minus,
} from "lucide-react"
import { api } from "~/trpc/react"
import { toast } from "sonner"

const priorityOptions = [
  { value: "low", label: "Low", icon: Minus, color: "text-gray-500" },
  {
    value: "medium",
    label: "Medium",
    icon: CheckCircle,
    color: "text-blue-500",
  },
  {
    value: "high",
    label: "High",
    icon: AlertTriangle,
    color: "text-orange-500",
  },
  { value: "urgent", label: "Urgent", icon: XCircle, color: "text-red-500" },
]

export default function AddSLAPolicyPage() {
  const router = useRouter()
  const params = useParams()
  const clientId = params?.clientId as string

  const [formData, setFormData] = useState({
    name: "",
    priority: "medium" as "low" | "medium" | "high" | "urgent",
    responseTimeHours: 4,
    responseTimeMinutes: 0,
    resolutionTimeHours: 24,
    resolutionTimeMinutes: 0,
    isDefault: false,
  })

  const { data: client, isLoading: clientLoading } =
    api.clients.getById.useQuery({
      id: clientId,
    })

  const createSLA = api.sla.create.useMutation({
    onSuccess: () => {
      toast.success("SLA policy created successfully", {
        description: "SLA policy created successfully",
      })
      router.push(`/settings/clients/${clientId}`)
    },
    onError: (error) => {
      toast.error(error.message, {
        description: error.message,
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const responseTimeMinutes =
      formData.responseTimeHours * 60 + formData.responseTimeMinutes
    const resolutionTimeMinutes =
      formData.resolutionTimeHours * 60 + formData.resolutionTimeMinutes

    createSLA.mutate({
      clientId,
      name: formData.name,
      priority: formData.priority,
      responseTimeMinutes,
      resolutionTimeMinutes,
      isDefault: formData.isDefault,
    })
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]:
        name.includes("Hours") || name.includes("Minutes")
          ? parseInt(value) || 0
          : value,
    }))
  }

  const handlePriorityChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      priority: value as "low" | "medium" | "high" | "urgent",
    }))
  }

  const handleSwitchChange = (checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      isDefault: checked,
    }))
  }

  if (clientLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-4 w-4 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-bold">Client not found</h2>
          <p className="text-gray-600">
            The client you&apos;re looking for doesn&apos;t exist.
          </p>
        </div>
      </div>
    )
  }

  const selectedPriority = priorityOptions.find(
    (p) => p.value === formData.priority
  )

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
              <BreadcrumbLink href="/settings">Settings</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/settings/clients/${client.id}`}>
                {client.name}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Add SLA Policy</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="space-y-6 p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/settings/clients/${client.id}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>

            <div>
              <h1 className="text-xl font-bold">Add SLA Policy</h1>
              <p className="text-gray-600">
                Create a service level agreement for {client.name}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Policy Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Policy Name *</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g., Standard Support SLA"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Priority Level *</Label>
                <Select
                  value={formData.priority}
                  onValueChange={handlePriorityChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority">
                      {selectedPriority && (
                        <div className="flex items-center gap-2">
                          <selectedPriority.icon
                            className={`h-4 w-4 ${selectedPriority.color}`}
                          />
                          {selectedPriority.label}
                        </div>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <option.icon className={`h-4 w-4 ${option.color}`} />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Default Policy</Label>
                  <p className="text-sm text-gray-600">
                    Use this as the default SLA policy for this client
                  </p>
                </div>
                <Switch
                  checked={formData.isDefault}
                  onCheckedChange={handleSwitchChange}
                />
              </div>
            </CardContent>
          </Card>

          {/* Response Time */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Response Time
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Maximum time allowed for the first response to a ticket
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="responseTimeHours">Hours</Label>
                  <Input
                    id="responseTimeHours"
                    name="responseTimeHours"
                    type="number"
                    min="0"
                    max="72"
                    value={formData.responseTimeHours}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="responseTimeMinutes">Minutes</Label>
                  <Input
                    id="responseTimeMinutes"
                    name="responseTimeMinutes"
                    type="number"
                    min="0"
                    max="59"
                    value={formData.responseTimeMinutes}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="text-sm text-gray-500">
                Total response time: {formData.responseTimeHours}h{" "}
                {formData.responseTimeMinutes}m
              </div>
            </CardContent>
          </Card>

          {/* Resolution Time */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Resolution Time
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                Maximum time allowed to fully resolve a ticket
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="resolutionTimeHours">Hours</Label>
                  <Input
                    id="resolutionTimeHours"
                    name="resolutionTimeHours"
                    type="number"
                    min="0"
                    max="168"
                    value={formData.resolutionTimeHours}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resolutionTimeMinutes">Minutes</Label>
                  <Input
                    id="resolutionTimeMinutes"
                    name="resolutionTimeMinutes"
                    type="number"
                    min="0"
                    max="59"
                    value={formData.resolutionTimeMinutes}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="text-sm text-gray-500">
                Total resolution time: {formData.resolutionTimeHours}h{" "}
                {formData.resolutionTimeMinutes}m
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button
              type="submit"
              disabled={createSLA.isPending}
              className="flex-1 md:flex-initial"
            >
              <Save className="mr-2 h-4 w-4" />
              {createSLA.isPending ? "Creating..." : "Create SLA Policy"}
            </Button>

            <Button variant="outline" asChild>
              <Link href={`/settings/clients/${client.id}`}>Cancel</Link>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
