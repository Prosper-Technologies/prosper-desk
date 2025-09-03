"use client";

import { useState } from "react";
import { Check, ChevronDown, Building } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Badge } from "~/components/ui/badge";
import { useCompany } from "~/contexts/company-context";
import { api } from "~/trpc/react";

export function CompanySwitcher() {
  const { currentCompanyId, setCurrentCompanyId } = useCompany();
  const [isOpen, setIsOpen] = useState(false);

  const { data: memberships, isLoading } = api.auth.getUserMemberships.useQuery();

  if (isLoading || !memberships || memberships.length <= 1) {
    // Don't show switcher if user only has one company or loading
    return null;
  }

  const currentMembership = memberships.find(
    (m) => m.company.id === currentCompanyId
  ) || memberships[0];

  const handleCompanySwitch = (membership: typeof memberships[0]) => {
    setCurrentCompanyId(membership.company.id);
    setIsOpen(false);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between bg-background"
        >
          <div className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            <div className="text-left">
              <div className="text-sm font-medium">
                {currentMembership.company.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {currentMembership.role}
              </div>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel>Switch Organization</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {memberships.map((membership) => (
          <DropdownMenuItem
            key={membership.id}
            onClick={() => handleCompanySwitch(membership)}
            className="flex items-center justify-between p-3"
          >
            <div className="flex items-center gap-3">
              <Building className="h-4 w-4" />
              <div>
                <div className="text-sm font-medium">
                  {membership.company.name}
                </div>
                <div className="text-xs text-muted-foreground">
                  {membership.company.slug}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {membership.role}
              </Badge>
              {membership.company.id === currentCompanyId && (
                <Check className="h-4 w-4" />
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
