import { DashboardNav } from "@/components/dashboard/dashboard-nav";

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <DashboardNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 pb-24 sm:max-w-5xl sm:px-6 sm:py-8 sm:pb-8">
        {children}
      </main>
    </div>
  );
}
