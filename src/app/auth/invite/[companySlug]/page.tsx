"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Label } from "~/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Eye, EyeOff, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { api } from "~/trpc/react"

export default function InvitePage() {
  const router = useRouter()
  const [step, setStep] = useState<"code" | "password">("code")
  const [invitationCode, setInvitationCode] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [invitation, setInvitation] = useState<any>(null)

  // Validate invitation code
  const validateCodeQuery = api.user.validateInvitationCode.useQuery(
    { code: invitationCode },
    {
      enabled: false, // Don't auto-run, we'll trigger manually
      onSuccess: (data) => {
        if (data.isValid && data.invitation) {
          setInvitation(data.invitation)
          setStep("password")
        }
      },
    }
  )

  // Accept invitation
  const acceptInvitationMutation = api.user.acceptInvitation.useMutation({
    onSuccess: () => {
      // Redirect to login or dashboard
      router.push("/dashboard")
    },
  })

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (invitationCode.length === 6) {
      validateCodeQuery.refetch()
    }
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === confirmPassword && password.length >= 8) {
      acceptInvitationMutation.mutate({
        code: invitationCode,
        password,
      })
    }
  }

  const formatInvitationCode = (value: string) => {
    // Only allow numbers and limit to 6 digits
    const cleaned = value.replace(/\D/g, "").slice(0, 6)
    return cleaned
  }

  const isCodeValid = invitationCode.length === 6
  const isPasswordValid = password.length >= 8 && password === confirmPassword

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            Accept Invitation
          </h1>
          <p className="mt-2 text-gray-600">
            Join your team and start collaborating
          </p>
        </div>

        {step === "code" ? (
          <Card>
            <CardHeader>
              <CardTitle>Enter Invitation Code</CardTitle>
              <CardDescription>
                Enter the 6-digit code from your invitation email
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="invitationCode">Invitation Code</Label>
                  <Input
                    id="invitationCode"
                    type="text"
                    value={invitationCode}
                    onChange={(e) =>
                      setInvitationCode(formatInvitationCode(e.target.value))
                    }
                    placeholder="000000"
                    className="text-center font-mono text-2xl tracking-widest"
                    maxLength={6}
                    autoFocus
                    disabled={validateCodeQuery.isFetching}
                  />
                  <p className="text-xs text-gray-500">
                    Enter the 6-digit numeric code from your email
                  </p>
                </div>

                {validateCodeQuery.error && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      {validateCodeQuery.error.message}
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={!isCodeValid || validateCodeQuery.isFetching}
                >
                  {validateCodeQuery.isFetching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Validating...
                    </>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Create Your Password</CardTitle>
              <CardDescription>
                {invitation?.companyName && (
                  <>Welcome to {invitation.companyName}! </>
                )}
                Set up your password to complete your account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                {invitation && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                    <div className="flex items-center gap-2 text-green-800">
                      <CheckCircle className="h-4 w-4" />
                      <span className="font-medium">Invitation Verified</span>
                    </div>
                    <p className="mt-1 text-sm text-green-700">
                      Email: {invitation.userEmail}
                    </p>
                    <p className="text-sm text-green-700">
                      Role:{" "}
                      {invitation.role === "admin" ? "Administrator" : "Agent"}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a secure password"
                      disabled={acceptInvitationMutation.isPending}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Password must be at least 8 characters long
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your password"
                    disabled={acceptInvitationMutation.isPending}
                  />
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-red-600">
                      Passwords do not match
                    </p>
                  )}
                </div>

                {acceptInvitationMutation.error && (
                  <Alert variant="destructive">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>
                      {acceptInvitationMutation.error.message}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep("code")}
                    disabled={acceptInvitationMutation.isPending}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={
                      !isPasswordValid || acceptInvitationMutation.isPending
                    }
                  >
                    {acceptInvitationMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="text-center text-sm text-gray-600">
          <p>Need help? Contact your team administrator.</p>
        </div>
      </div>
    </div>
  )
}
