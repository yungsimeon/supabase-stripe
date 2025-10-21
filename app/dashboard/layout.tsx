import { requireUser, getUserOrganizations } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const organizations = await getUserOrganizations(user.id);

  if (organizations.length === 0) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader user={user} organizations={organizations} />
      <div className="flex">
        <DashboardSidebar organizations={organizations} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
