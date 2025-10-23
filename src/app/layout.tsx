import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { type Metadata } from "next";

import { TRPCReactProvider } from "~/trpc/react";
import { CompanyProvider } from "~/contexts/company-context";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Prosper Desk - Prosper AI's Helpdesk",
  description: "Prosper AI's ticketing system",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <CompanyProvider>
          <TRPCReactProvider>
            {children}
            <Toaster />
          </TRPCReactProvider>
        </CompanyProvider>
      </body>
    </html>
  );
}
