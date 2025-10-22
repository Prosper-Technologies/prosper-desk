"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { AlertCircle, LifeBuoy, Mail, Check, KeyRound } from "lucide-react";
import { api } from "~/trpc/react";
import { createClient } from "~/utils/supabase/client";

export default function RequestAccessPage() {
  const params = useParams();
  const router = useRouter();
  const companySlug = params?.companySlug as string;
  const clientSlug = params?.clientSlug as string;

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");

  const supabase = createClient();

  const requestOTP = api.customerPortal.requestOTP.useMutation({
    onSuccess: () => {
      setStep("otp");
      setError("");
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const verifyOTP = api.customerPortal.verifyOTP.useMutation({
    onSuccess: async () => {
      // Redirect to portal - session is already set by Supabase
      router.push(`/portal/${companySlug}/${clientSlug}`);
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setError("");
    requestOTP.mutate({
      companySlug,
      clientSlug,
      email: email.trim(),
    });
  };

  const handleOTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError("Please enter a 6-digit code");
      return;
    }

    setError("");

    try {
      // Verify OTP with Supabase client (this sets the session in the browser)
      const { error: otpError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: otp,
        type: "email",
      });

      if (otpError) {
        setError("Invalid or expired verification code.");
        return;
      }

      // Validate portal access on backend
      verifyOTP.mutate({
        companySlug,
        clientSlug,
        email: email.trim(),
      });
    } catch (err) {
      setError("An error occurred. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          {/* Header */}
          <div className="mb-6 text-center">
            <LifeBuoy className="mx-auto mb-4 h-12 w-12 text-primary" />
            <h1 className="mb-2 text-lg font-bold text-gray-900">
              {step === "email"
                ? "Request Portal Access"
                : "Enter Verification Code"}
            </h1>
            <p className="text-gray-600">
              {step === "email"
                ? "Enter your email to receive a verification code"
                : `We sent a 6-digit code to ${email}`}
            </p>
          </div>

          {/* Email Step */}
          {step === "email" && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email Address
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  disabled={requestOTP.isPending}
                  autoFocus
                />
                <p className="text-xs text-gray-500">
                  You must have been granted access by the support team
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={requestOTP.isPending || !email.trim()}
              >
                {requestOTP.isPending
                  ? "Sending Code..."
                  : "Send Verification Code"}
              </Button>
            </form>
          )}

          {/* OTP Step */}
          {step === "otp" && (
            <div className="space-y-4">
              <form onSubmit={handleOTPSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="otp" className="text-sm font-medium">
                    Verification Code
                  </label>
                  <Input
                    id="otp"
                    type="text"
                    value={otp}
                    onChange={(e) => {
                      const value = e.target.value
                        .replace(/\D/g, "")
                        .slice(0, 6);
                      setOtp(value);
                    }}
                    placeholder="000000"
                    required
                    disabled={verifyOTP.isPending}
                    autoFocus
                    className="text-center text-2xl tracking-widest"
                    maxLength={6}
                  />
                  <p className="text-xs text-gray-500">
                    Enter the 6-digit code from your email
                  </p>
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={verifyOTP.isPending || otp.length !== 6}
                >
                  {verifyOTP.isPending
                    ? "Verifying..."
                    : "Verify & Access Portal"}
                </Button>
              </form>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-600" />
                  <h4 className="text-sm font-medium text-blue-800">
                    Check your inbox
                  </h4>
                </div>
                <ul className="space-y-1 text-xs text-blue-700">
                  <li>• The code expires in 1 hour for security</li>
                  <li>• Check your spam folder if you don't see it</li>
                </ul>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setStep("email");
                  setOtp("");
                  setError("");
                }}
              >
                Use Different Email
              </Button>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 border-t pt-4 text-center">
            <p className="text-xs text-gray-500">
              Need help? Contact support for assistance
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
