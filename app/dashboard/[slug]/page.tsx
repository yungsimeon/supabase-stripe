import { requireOrganizationAccess } from "@/lib/auth/helpers";
import { notFound } from "next/navigation";

export default async function OrganizationDashboard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  try {
    const { slug } = await params;
    const { organization, user, userRole } = await requireOrganizationAccess(
      slug
    );

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome to {organization.name}
          </h1>
          <p className="text-gray-600">
            You are logged in as {user.email} with {userRole} role.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900">
              Subscription Status
            </h3>
            <p className="text-2xl font-bold text-indigo-600 mt-2">
              {organization.subscription_status || "No subscription"}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Plan: {organization.subscription_plan || "None"}
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900">Seat Count</h3>
            <p className="text-2xl font-bold text-green-600 mt-2">
              {organization.seat_count}
            </p>
            <p className="text-sm text-gray-500 mt-1">Active members</p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900">Your Role</h3>
            <p className="text-2xl font-bold text-purple-600 mt-2 capitalize">
              {userRole}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Organization access level
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <a
              href={`/dashboard/${organization.slug}/billing`}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <h4 className="font-medium text-gray-900">Billing</h4>
              <p className="text-sm text-gray-500">Manage subscription</p>
            </a>

            <a
              href={`/dashboard/${organization.slug}/members`}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <h4 className="font-medium text-gray-900">Members</h4>
              <p className="text-sm text-gray-500">Manage team</p>
            </a>

            <a
              href={`/dashboard/${organization.slug}/settings`}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <h4 className="font-medium text-gray-900">Settings</h4>
              <p className="text-sm text-gray-500">Organization settings</p>
            </a>

            <a
              href={`/dashboard/${organization.slug}/usage`}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <h4 className="font-medium text-gray-900">Usage</h4>
              <p className="text-sm text-gray-500">View usage metrics</p>
            </a>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    notFound();
  }
}
