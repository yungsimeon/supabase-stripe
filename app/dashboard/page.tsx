import { requireUser, getUserOrganizations } from "@/lib/auth/helpers";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const user = await requireUser();
  const organizations = await getUserOrganizations(user.id);

  if (organizations.length === 0) {
    redirect("/onboarding");
  }

  // Redirect to the first organization's dashboard
  redirect(`/dashboard/${organizations[0].organization.slug}`);
}
