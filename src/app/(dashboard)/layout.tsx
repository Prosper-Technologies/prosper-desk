import PrivateLayout from "~/components/layout/private-layout";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PrivateLayout>
      {children}
    </PrivateLayout>
  );
}