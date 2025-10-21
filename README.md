# Multi-Tenant SaaS Starter with Supabase + Stripe

A production-ready multi-tenant SaaS starter built with Next.js, Supabase, and Stripe. Features organizations, role-based access control, subscription billing, per-seat pricing, and metered usage tracking.

## 🚀 Features

### Core Functionality

- **Multi-tenant Architecture**: Organizations with isolated data and billing
- **Authentication**: Supabase Auth with email magic links and Google OAuth
- **Role-based Access Control**: Owner, Admin, and Member roles with strict RLS policies
- **Server-side Rendering**: Full SSR support with proper session management

### Billing & Subscriptions

- **Base Subscriptions**: Monthly plans (Starter, Pro, Enterprise)
- **Per-seat Billing**: Automatic billing based on active member count
- **Metered Usage**: Track and bill for usage-based features (e.g., API calls)
- **Self-serve Portal**: Stripe Customer Portal for subscription management
- **Webhook Handling**: Robust webhook processing with signature verification

### Security & Access Control

- **Row Level Security (RLS)**: Strict database-level access control
- **Organization Context**: All routes enforce organization membership
- **Service Role Isolation**: Server operations use service role, client uses anon key
- **Middleware Protection**: Automatic route protection and session management

## 🛠 Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, RLS)
- **Payments**: Stripe (Subscriptions, Webhooks, Customer Portal)
- **Deployment**: Vercel-ready with Edge Runtime support

## 📋 Prerequisites

- Node.js 18+
- Supabase account and project
- Stripe account with API keys
- Domain for production deployment

## 🚀 Quick Start

### 1. Clone and Install

\`\`\`bash
git clone <your-repo>
cd supabase-stripe
npm install
\`\`\`

### 2. Environment Setup

Copy the environment template:
\`\`\`bash
cp env.example .env.local
\`\`\`

Fill in your environment variables:

\`\`\`env

# Supabase Configuration

NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Stripe Configuration

STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Stripe Price IDs (create these in your Stripe dashboard)

STRIPE_STARTER_PRICE_ID=price_starter_plan
STRIPE_PRO_PRICE_ID=price_pro_plan
STRIPE_ENTERPRISE_PRICE_ID=price_enterprise_plan
STRIPE_PER_SEAT_PRICE_ID=price_per_seat
STRIPE_METERED_USAGE_PRICE_ID=price_metered_usage

# App Configuration

NEXT_PUBLIC_APP_URL=http://localhost:3000
\`\`\`

### 3. Database Setup

Run the SQL schema in your Supabase SQL editor:

\`\`\`sql
-- Copy and paste the contents of lib/database/schema.sql
\`\`\`

### 4. Stripe Configuration

#### Create Products and Prices

1. **Base Subscription Plans**:

   - Starter Plan: $29/month
   - Pro Plan: $99/month
   - Enterprise Plan: $299/month

2. **Per-seat Add-on**:

   - Price per seat (e.g., $10/seat/month)

3. **Metered Usage**:
   - API calls or other usage-based dimension

#### Configure Webhooks

Add webhook endpoint: \`https://yourdomain.com/api/webhooks/stripe\`

Events to listen for:

- \`customer.subscription.created\`
- \`customer.subscription.updated\`
- \`customer.subscription.deleted\`
- \`invoice.finalized\`
- \`invoice.payment_failed\`
- \`checkout.session.completed\`

### 5. Run Development Server

\`\`\`bash
npm run dev
\`\`\`

Visit \`http://localhost:3000\` to see your SaaS application!

## 📁 Project Structure

\`\`\`
├── app/ # Next.js App Router
│ ├── api/ # API routes
│ │ ├── billing/ # Billing endpoints
│ │ ├── organizations/ # Organization management
│ │ ├── usage/ # Usage tracking
│ │ └── webhooks/ # Stripe webhooks
│ ├── auth/ # Authentication pages
│ ├── dashboard/ # Dashboard pages
│ └── login/ # Login page
├── components/ # React components
│ └── dashboard/ # Dashboard components
├── lib/ # Utility libraries
│ ├── auth/ # Authentication helpers
│ ├── database/ # Database types and schema
│ ├── stripe/ # Stripe integration
│ ├── supabase/ # Supabase client setup
│ └── usage/ # Usage tracking utilities
└── middleware.ts # Next.js middleware
\`\`\`

## 🔧 Key Components

### Authentication Flow

1. **Login**: Email magic link or Google OAuth
2. **Session Management**: Server-side session handling with middleware
3. **Organization Context**: Automatic organization membership verification

### Billing Flow

1. **Organization Creation**: Automatic Stripe customer creation
2. **Subscription Management**: Self-serve via Stripe Customer Portal
3. **Usage Tracking**: Server-side usage recording with idempotency
4. **Webhook Processing**: Real-time subscription status updates

### Access Control

1. **RLS Policies**: Database-level organization isolation
2. **Route Protection**: Middleware enforces authentication
3. **Role Verification**: Server-side role checking for sensitive operations

## 📊 Usage Tracking

Track usage with the built-in usage tracker:

\`\`\`typescript
import { createUsageTracker, UsageDimensions } from '@/lib/usage/tracker'

const tracker = createUsageTracker(organizationId)

// Track API calls
await tracker.trackUsage(
UsageDimensions.API_CALLS,
1,
new Date(),
'unique-idempotency-key'
)

// Get current month usage
const usage = await tracker.getCurrentMonthUsage(UsageDimensions.API_CALLS)
\`\`\`

## 🔒 Security Features

- **Row Level Security**: All tables have strict RLS policies
- **Service Role Isolation**: Server operations use service role key
- **Webhook Verification**: Stripe webhook signature verification
- **Input Validation**: Server-side validation for all API endpoints
- **Rate Limiting**: Built-in protection against abuse

## 🚀 Deployment

### Vercel Deployment

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Environment Variables for Production

Update \`NEXT_PUBLIC_APP_URL\` to your production domain and ensure all Stripe webhook URLs point to your production endpoint.

## 🧪 Testing

The starter includes example usage patterns and can be extended with:

- Unit tests for utility functions
- Integration tests for API routes
- E2E tests for critical user flows

## 📈 Monitoring & Analytics

Consider adding:

- Error tracking (Sentry)
- Analytics (PostHog, Mixpanel)
- Logging (LogRocket, DataDog)
- Uptime monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For questions and support:

1. Check the documentation
2. Review the example code
3. Open an issue on GitHub

## 🔄 Updates

This starter is actively maintained. Check for updates regularly and follow the changelog for breaking changes.

---

**Ready to build your SaaS?** 🚀

This starter provides everything you need to launch a production-ready multi-tenant SaaS application. Customize the branding, add your specific features, and you're ready to go!
