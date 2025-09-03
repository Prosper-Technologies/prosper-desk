"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "~/utils/supabase/client";
import { AppSidebar } from "~/components/app-sidebar";
import {
  SidebarProvider,
  SidebarInset,
} from "~/components/ui/sidebar";
import { api } from "~/trpc/react";
import { Loader } from "lucide-react";
import { useCompany } from "~/contexts/company-context";

const supabase = createClient();

interface PrivateLayoutProps {
  children: React.ReactNode;
}

export default function PrivateLayout({ children }: PrivateLayoutProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [authUser, setAuthUser] = useState<any>(null);
  const router = useRouter();
  const { currentCompanyId, setCurrentCompanyId } = useCompany();

  const { data: profile, isLoading: isProfileLoading } =
    api.auth.getProfile.useQuery(undefined, {
      enabled: !!authUser,
      retry: false,
    });

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setAuthUser(user);
    };

    checkAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        router.push("/login");
      } else if (session?.user) {
        setAuthUser(session.user);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (authUser && !isProfileLoading) {
      if (!profile) {
        // User exists in auth but not in our database - redirect to onboarding
        router.push("/onboarding");
      } else {
        // Initialize company context if not set or if current company is not valid
        if (profile.memberships?.length > 0) {
          const validCompanyIds = profile.memberships.map((m) => m.company.id);
          if (
            !currentCompanyId ||
            !validCompanyIds.includes(currentCompanyId)
          ) {
            setCurrentCompanyId(profile.memberships[0].company.id);
          }
        }
        setIsLoading(false);
      }
    }
  }, [
    authUser,
    profile,
    isProfileLoading,
    router,
    currentCompanyId,
    setCurrentCompanyId,
  ]);

  if (isLoading || isProfileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader className="h-4 w-4 animate-spin text-gray-600" />
          <p className="mt-2 text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null; // Will redirect to onboarding
  }

  // Get current membership based on selected company
  const currentMembership =
    profile?.memberships?.find((m) => m.company.id === currentCompanyId) ||
    profile?.memberships?.[0];

  return (
    <SidebarProvider>
      <AppSidebar
        user={
          profile
            ? {
                first_name: profile.first_name,
                last_name: profile.last_name,
                email: profile.email,
                avatar_url: profile.avatar_url,
              }
            : undefined
        }
        company={
          currentMembership?.company
            ? {
                name: currentMembership.company.name,
                slug: currentMembership.company.slug,
                logo_url: currentMembership.company.logo_url,
              }
            : undefined
        }
      />
      <SidebarInset>
        <div className="flex flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
