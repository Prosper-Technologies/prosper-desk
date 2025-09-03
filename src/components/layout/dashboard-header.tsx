import { ReactNode } from "react";
import { SidebarTrigger } from "~/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface DashboardHeaderProps {
  breadcrumbs: BreadcrumbItem[];
  showSidebarTrigger?: boolean;
  className?: string;
  children?: ReactNode;
}

export function DashboardHeader({
  breadcrumbs,
  showSidebarTrigger = false,
  className = "",
  children,
}: DashboardHeaderProps) {
  const baseClassName = "flex h-16 shrink-0 items-center gap-2";
  const defaultBorder = "border-b";
  const defaultPadding = "px-4";
  const backgroundStyle = showSidebarTrigger
    ? "bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60"
    : "";

  const headerClassName = `${baseClassName} ${defaultBorder} ${defaultPadding} ${backgroundStyle} ${className}`.trim();

  return (
    <header className={headerClassName}>
      {showSidebarTrigger && (
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <div className="h-6 w-px bg-gray-200" />
        </div>
      )}
      
      <Breadcrumb>
        <BreadcrumbList>
          {breadcrumbs.map((breadcrumb, index) => (
            <div key={index} className="flex items-center">
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {breadcrumb.href ? (
                  <BreadcrumbLink href={breadcrumb.href}>
                    {breadcrumb.label}
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage>{breadcrumb.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </div>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      
      {children}
    </header>
  );
}