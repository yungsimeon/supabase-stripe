"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Organization {
  id: string;
  name: string;
  slug: string;
  subscription_status: string | null;
  subscription_plan: string | null;
  seat_count: number;
}

interface DashboardSidebarProps {
  organizations: Array<{
    organization: Organization;
    role: string;
  }>;
}

export default function DashboardSidebar({
  organizations,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const currentSlug = pathname.split("/")[2];

  const navigation = [
    { name: "Overview", href: `/dashboard/${currentSlug}`, icon: "📊" },
    { name: "Billing", href: `/dashboard/${currentSlug}/billing`, icon: "💳" },
    { name: "Members", href: `/dashboard/${currentSlug}/members`, icon: "👥" },
    { name: "Usage", href: `/dashboard/${currentSlug}/usage`, icon: "📈" },
    { name: "Analytics", href: `/dashboard/analytics`, icon: "🔬" },
    {
      name: "Settings",
      href: `/dashboard/${currentSlug}/settings`,
      icon: "⚙️",
    },
  ];

  return (
    <div className="w-64 bg-white shadow-sm">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Organizations
        </h2>
        <div className="space-y-2">
          {organizations.map(({ organization, role }) => (
            <Link
              key={organization.id}
              href={`/dashboard/${organization.slug}`}
              className={`block p-3 rounded-lg text-sm transition-colors ${
                currentSlug === organization.slug
                  ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <div className="font-medium">{organization.name}</div>
              <div className="text-xs text-gray-500 capitalize">{role}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-200 p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-3">Navigation</h3>
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? "bg-indigo-100 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <span className="mr-3">{item.icon}</span>
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
