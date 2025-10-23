"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "~/utils/supabase/client";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { api } from "~/trpc/react";
import { slugify } from "~/lib/utils";

const supabase = createClient();

const STEPS = {
  PROFILE: 1,
  COMPANY: 2,
  COMPLETE: 3,
} as const;

type StepType = typeof STEPS[keyof typeof STEPS];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState<StepType>(STEPS.PROFILE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  // Profile form data
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // Company form data
  const [companyName, setCompanyName] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [companySize, setCompanySize] = useState<
    "1-10" | "11-50" | "51-200" | "201-1000" | "1000+" | ""
  >("");

  const completeOnboarding = api.auth.completeOnboarding.useMutation();

  useEffect(() => {
    // Check if user is authenticated
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);
    };
    getUser();
  }, [router]);

  useEffect(() => {
    // Auto-generate slug from company name
    if (companyName) {
      setCompanySlug(slugify(companyName));
    }
  }, [companyName]);

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError("Please fill in all required fields");
      return;
    }
    setError("");
    setCurrentStep(STEPS.COMPANY);
  };

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim() || !companySlug.trim() || !companySize) {
      setError("Please fill in all required fields");
      return;
    }

    if (!user) {
      setError("User not found");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await completeOnboarding.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        companyName: companyName.trim(),
        companySlug: companySlug.trim(),
        companySize,
        authUserId: user.id,
        email: user.email!,
      });

      setCurrentStep(STEPS.COMPLETE);
    } catch (err: any) {
      setError(err.message || "An error occurred during onboarding");
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = () => {
    router.push("/dashboard");
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {Array.from({ length: 3 }, (_, i) => {
              const stepNumber = i + 1;
              const isActive = stepNumber === currentStep;
              const isCompleted = stepNumber < currentStep;

              return (
                <div
                  key={stepNumber}
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-sm font-medium ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isCompleted
                        ? "bg-green-500 text-white"
                        : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {isCompleted ? "✓" : stepNumber}
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between text-xs text-gray-500">
            <span>Profile</span>
            <span>Company</span>
            <span>Complete</span>
          </div>
        </div>

        {currentStep === STEPS.PROFILE && (
          <Card>
            <CardHeader>
              <CardTitle>Welcome to Prosper Desk!</CardTitle>
              <CardDescription>
                Let&apos;s start by setting up your profile
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="firstName" className="text-sm font-medium">
                    First Name *
                  </label>
                  <Input
                    id="firstName"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="lastName" className="text-sm font-medium">
                    Last Name *
                  </label>
                  <Input
                    id="lastName"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                {error && <div className="text-sm text-red-600">{error}</div>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  Continue
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {currentStep === STEPS.COMPANY && (
          <Card>
            <CardHeader>
              <CardTitle>Setup your company</CardTitle>
              <CardDescription>Tell us about your organization</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCompanySubmit} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="companyName" className="text-sm font-medium">
                    Company Name *
                  </label>
                  <Input
                    id="companyName"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                    disabled={isLoading}
                    placeholder="Acme Corp"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="companySlug" className="text-sm font-medium">
                    Company URL *
                  </label>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">desk.getprosperapp.com/</span>
                    <Input
                      id="companySlug"
                      type="text"
                      value={companySlug}
                      onChange={(e) => setCompanySlug(slugify(e.target.value))}
                      required
                      disabled={isLoading}
                      placeholder="acme-corp"
                      pattern="[a-z0-9-]+"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    This will be your company&apos;s unique URL for the customer
                    portal
                  </p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="companySize" className="text-sm font-medium">
                    Company Size *
                  </label>
                  <Select
                    value={companySize || undefined}
                    onValueChange={(value) => setCompanySize(value as any)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select company size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-10">1-10 employees</SelectItem>
                      <SelectItem value="11-50">11-50 employees</SelectItem>
                      <SelectItem value="51-200">51-200 employees</SelectItem>
                      <SelectItem value="201-1000">
                        201-1000 employees
                      </SelectItem>
                      <SelectItem value="1000+">1000+ employees</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {error && <div className="text-sm text-red-600">{error}</div>}
                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(STEPS.PROFILE)}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isLoading || completeOnboarding.isPending}
                  >
                    {isLoading || completeOnboarding.isPending
                      ? "Creating..."
                      : "Create Company"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {currentStep === STEPS.COMPLETE && (
          <Card>
            <CardHeader>
              <CardTitle>🎉 Welcome to Prosper Desk!</CardTitle>
              <CardDescription>
                Your account has been set up successfully
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-green-50 p-4">
                <div className="text-sm text-green-800">
                  <strong>{companyName}</strong> is now ready to go!
                </div>
                <div className="mt-1 text-xs text-green-600">
                  You can start managing tickets and building your knowledge
                  base.
                </div>
              </div>
              <Button onClick={handleComplete} className="w-full">
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
