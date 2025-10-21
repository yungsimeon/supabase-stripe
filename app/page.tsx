import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center min-h-screen text-center">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 mb-6">
              Multi-Tenant SaaS
              <span className="text-indigo-600"> Starter</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Production-ready SaaS starter with Supabase, Stripe, and Next.js.
              Features organizations, role-based access, subscription billing,
              per-seat pricing, and metered usage tracking.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link
                href="/login"
                className="inline-flex items-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                Get Started
              </Link>
              <a
                href="https://github.com/your-repo"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-8 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                View on GitHub
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
              <div className="text-center">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🏢</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Multi-Tenant
                </h3>
                <p className="text-gray-600">
                  Organizations with isolated data, billing, and access control
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">💳</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Stripe Billing
                </h3>
                <p className="text-gray-600">
                  Subscriptions, per-seat pricing, and metered usage tracking
                </p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🔒</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Secure & Scalable
                </h3>
                <p className="text-gray-600">
                  Row-level security, role-based access, and production-ready
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
