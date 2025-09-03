"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { AlertCircle, LifeBuoy, CheckCircle } from "lucide-react";
import { api } from "~/trpc/react";

interface AuthPageProps {
  params: {
    companySlug: string;
    clientSlug: string;
  };
}

export default function CustomerPortalAuthPage({ params }: AuthPageProps) {
  const [accessToken, setAccessToken] = useState("");
  const [step, setStep] = useState<"token" | "verifying" | "success" | "error">("token");
  const [errorMessage, setErrorMessage] = useState("");

  const searchParams = useSearchParams();
  const router = useRouter();
  const urlToken = searchParams.get("token");

  // Verify token mutation
  const verifyToken = api.customerPortal.verifyToken.useMutation({
    onSuccess: (_result) => {
      setStep("success");
      // Store token in localStorage before redirecting
      const storageKey = `portal_token_${params.companySlug}_${params.clientSlug}`;
      localStorage.setItem(storageKey, accessToken);
      // Redirect to portal after 1 second
      setTimeout(() => {
        router.push(`/portal/${params.companySlug}/${params.clientSlug}?token=${encodeURIComponent(accessToken)}`);
      }, 1000);
    },
    onError: (error) => {
      setErrorMessage(error.message);
      setStep("error");
    },
  });

  // Handle token verification if token is in URL
  useEffect(() => {
    if (urlToken && step === "token") {
      setAccessToken(urlToken);
      setStep("verifying");
      verifyToken.mutate({
        companySlug: params.companySlug,
        clientSlug: params.clientSlug,
        accessToken: urlToken,
      });
    }
  }, [urlToken, params.companySlug, params.clientSlug, step, verifyToken]);

  const handleVerifyToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken.trim()) return;

    setStep("verifying");
    await verifyToken.mutateAsync({
      companySlug: params.companySlug,
      clientSlug: params.clientSlug,
      accessToken: accessToken.trim(),
    });
  };

  const handleTryAgain = () => {
    setStep("token");
    setErrorMessage("");
    setAccessToken("");
  };

  const handleLogout = () => {
    const storageKey = `portal_token_${params.companySlug}_${params.clientSlug}`;
    localStorage.removeItem(storageKey);
    setStep("token");
    setAccessToken("");
    setErrorMessage("");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6">
          {/* Header */}
          <div className="text-center mb-6">
            <LifeBuoy className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="text-lg font-bold text-gray-900 mb-2">
              Portal Access
            </h1>
            <p className="text-gray-600">
              Enter your access token to access the support portal
            </p>
          </div>

          {/* Token input */}
          {step === "token" && (
            <form onSubmit={handleVerifyToken} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="accessToken" className="text-sm font-medium">
                  Access Token
                </label>
                <Input
                  id="accessToken"
                  type="text"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="Enter your access token"
                  required
                  disabled={verifyToken.isPending}
                  className="font-mono text-sm"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={verifyToken.isPending || !accessToken.trim()}
              >
                {verifyToken.isPending ? "Verifying..." : "Access Portal"}
              </Button>
            </form>
          )}

          {/* Verifying */}
          {step === "verifying" && (
            <div className="text-center space-y-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Verifying access...
                </h3>
                <p className="text-gray-600">
                  Please wait while we verify your access token
                </p>
              </div>
            </div>
          )}

          {/* Success */}
          {step === "success" && (
            <div className="text-center space-y-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Access granted!
                </h3>
                <p className="text-gray-600">
                  Redirecting you to the portal...
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {step === "error" && (
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Access Error
                </h3>
                <p className="text-gray-600 mb-4">
                  {errorMessage}
                </p>
              </div>
              <Button onClick={handleTryAgain} className="w-full">
                Try Again
              </Button>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 pt-4 border-t flex items-center justify-between">
            <p className="text-xs text-gray-500">Need help? Contact support for assistance</p>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Log out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
