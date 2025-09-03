"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Ticket,
  Users,
  BookOpen,
  Settings,
  HelpCircle,
  Menu,
  X,
  Building2,
  LogOut
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { createClient } from "~/utils/supabase/client";
import { useRouter } from "next/navigation";
import { CompanySwitcher } from "~/components/company-switcher";

const supabase = createClient();

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Tickets",
    href: "/tickets",
    icon: Ticket,
  },
  {
    name: "Knowledge Base",
    href: "/knowledge-base",
    icon: BookOpen,
  },
  {
    name: "Users",
    href: "/users",
    icon: Users,
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

interface SidebarProps {
  user: any;
  company: any;
}

export default function Sidebar({ user, company }: SidebarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const NavItems = () => (
    <>
      {navigation.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            )}
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <item.icon className="mr-3 h-4 w-4" />
            {item.name}
          </Link>
        );
      })}
    </>
  );

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Building2 className="h-6 w-6 text-primary" />
          <span className="font-semibold text-gray-900">{company?.name || "BlueDesk"}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsMobileMenuOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:border-r lg:border-gray-200 lg:bg-white">
        <div className="flex flex-col flex-1 pt-5 pb-4 overflow-y-auto">
          {/* Logo and company name */}
          <div className="flex items-center flex-shrink-0 px-4 mb-6">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="ml-2 text-lg font-semibold text-gray-900">
              BlueDesk
            </span>
          </div>

          {/* Company Switcher */}
          <div className="px-4 mb-6">
            <CompanySwitcher />
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 space-y-1">
            <NavItems />
          </nav>

          {/* User section */}
          <div className="flex-shrink-0 border-t border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-primary-foreground">
                      {user?.first_name?.[0]}{user?.last_name?.[0]}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.first_name} {user?.last_name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user?.role}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                className="flex-shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Sidebar */}
          <div className="relative flex flex-col w-64 bg-white">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center space-x-3">
                <Building2 className="h-6 w-6 text-primary" />
                <span className="font-semibold text-gray-900">
                  BlueDesk
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Mobile Company Switcher */}
            <div className="px-4 py-4 border-b border-gray-200">
              <CompanySwitcher />
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              <NavItems />
            </nav>

            {/* Mobile user section */}
            <div className="border-t border-gray-200 p-4">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-primary-foreground">
                    {user?.first_name?.[0]}{user?.last_name?.[0]}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {user?.first_name} {user?.last_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {user?.role}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="w-full"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
