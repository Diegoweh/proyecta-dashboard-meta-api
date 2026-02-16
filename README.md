# Proyecta Dashboard - Meta Marketing API Analytics

An internal dashboard for viewing and analyzing Meta Marketing API data. Built with Next.js 16, TypeScript, Supabase, and Prisma.

## Features

- **Authentication & Authorization**: Supabase Auth with role-based access (Admin/Viewer)
- **Meta API Integration**: Fetch accounts, campaigns, adsets, ads, and insights
- **Dashboard**: Overview metrics, time series charts, and campaign performance
- **Admin Panel**: Trigger manual syncs and view sync history
- **Data Export**: Export campaign data to CSV
- **Secure**: RLS policies, server-only Meta API calls, encrypted token storage
- **Scheduled Sync**: Support for automated data synchronization

## Tech Stack

- **Framework**: Next.js 16+ (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Auth**: Supabase Auth
- **UI**: TailwindCSS + shadcn/ui
- **Charts**: Recharts
- **Data Fetching**: TanStack Query
- **Validation**: Zod
- **Deployment**: Vercel

## Prerequisites

1. **Supabase Project**
   - Create a project at https://supabase.com
   - Get your project URL and API keys

2. **Meta Marketing API**
   - Create a Meta App at https://developers.facebook.com
   - Generate a system user access token OR long-lived user access token
   - Grant permissions: `ads_read`, `ads_management`, `business_management`
   - Get your App ID and App Secret (optional)

## Setup Instructions

### 1. Clone and Install

```bash
cd proyecta-dashboard
npm install
```

### 2. Environment Variables

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Fill in the following variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database Connection
DATABASE_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres?schema=public&pgbouncer=true"
DIRECT_URL="postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres?schema=public"

# Meta Marketing API
META_ACCESS_TOKEN=your-meta-access-token
META_APP_ID=your-app-id
META_APP_SECRET=your-app-secret

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

**Finding Supabase Database URL:**
1. Go to your Supabase project
2. Click "Settings" → "Database"
3. Find the connection string under "Connection string"
4. Replace `[password]` with your database password

**Getting Meta Access Token:**
1. Go to Meta Business Suite → Business Settings
2. System Users → Create System User
3. Assign Ad Account access
4. Generate Token with required permissions
5. Save the token securely

### 3. Database Setup

#### Apply Prisma Schema

```bash
npm run prisma:generate
npm run prisma:push
```

This creates all necessary tables in your Supabase database.

#### Apply Row Level Security Policies

Run the SQL in `supabase/rls-policies.sql` in your Supabase SQL Editor:

1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the contents of `supabase/rls-policies.sql`
3. Click "Run"

This enables RLS and creates security policies for all tables.

#### Create First Admin User

1. Sign up through the app at `/auth/signup`
2. Run the following SQL in Supabase SQL Editor (replace email):

```sql
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "ADMIN"}'::jsonb
WHERE email = 'your-admin@example.com';
```

Or use the helper script:
```bash
# Edit supabase/seed-admin.sql with your email
# Then run it in Supabase SQL Editor
```

### 4. Run Development Server

```bash
npm run dev
```

Open http://localhost:3000 and sign in with your admin account.

### 5. First Sync

1. Navigate to `/admin`
2. Click "Run Sync" to fetch data from Meta API
3. Wait for sync to complete
4. View your data on the dashboard

## Project Structure

```
proyecta-dashboard/
├── app/
│   ├── actions/           # Server actions (auth, sync, dashboard)
│   ├── admin/             # Admin pages
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Main dashboard pages
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page (redirects)
│   ├── providers.tsx      # React Query provider
│   └── globals.css        # Global styles
├── components/
│   ├── admin/             # Admin-specific components
│   ├── dashboard/         # Dashboard components
│   ├── ui/                # shadcn/ui components
│   └── nav.tsx            # Navigation component
├── lib/
│   ├── meta/
│   │   ├── client.ts      # Meta API client
│   │   └── sync.ts        # Sync engine
│   ├── supabase/          # Supabase clients
│   ├── auth.ts            # Auth helpers
│   ├── export.ts          # CSV export utility
│   ├── prisma.ts          # Prisma client
│   ├── types.ts           # TypeScript types
│   └── utils.ts           # Utility functions
├── prisma/
│   └── schema.prisma      # Database schema
├── supabase/
│   ├── rls-policies.sql   # RLS policies
│   └── seed-admin.sql     # Admin user seeder
├── .env.example           # Environment variables template
├── middleware.ts          # Auth middleware
└── README.md              # This file
```

## Scheduling Automated Syncs

### Option 1: GitHub Actions (Recommended)

Create `.github/workflows/sync.yml`:

```yaml
name: Meta API Sync

on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
  workflow_dispatch:       # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Sync
        run: |
          curl -X POST https://your-app.vercel.app/api/sync \
            -H "Authorization: Bearer ${{ secrets.SYNC_SECRET }}"
```

Then create the API route at `app/api/sync/route.ts`:

```typescript
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.SYNC_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const result = await runMetaSync({}, 'cron');
  return Response.json(result);
}
```

### Option 2: Supabase Cron

Create a Supabase Edge Function and schedule it:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule sync every 6 hours
SELECT cron.schedule(
  'meta-sync-job',
  '0 */6 * * *',
  $$ SELECT net.http_post(
    url:='https://your-app.vercel.app/api/sync',
    headers:='{"Authorization": "Bearer your-secret"}'::jsonb
  ) $$
);
```

### Option 3: Vercel Cron Jobs

Add to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/sync",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

## Deployment

### Vercel Deployment

1. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin your-repo-url
   git push -u origin main
   ```

2. **Deploy to Vercel**
   - Go to https://vercel.com
   - Import your repository
   - Add environment variables from `.env`
   - Deploy

3. **Update Environment**
   - Set `NEXT_PUBLIC_APP_URL` to your Vercel URL
   - Redeploy if needed

### Post-Deployment

1. Create your first admin user (see step 3 above)
2. Run your first sync from `/admin`
3. Set up automated syncs (see scheduling section)

## Usage

### Admin Users

- View dashboard metrics and charts
- Access campaign performance tables
- Trigger manual syncs
- View sync history
- Export data to CSV

### Viewer Users

- View dashboard metrics and charts
- Access campaign performance tables
- Export data to CSV
- **Cannot** trigger syncs or access admin panel

## API Rate Limits

The Meta API has rate limits. The client handles:
- **Automatic retries** with exponential backoff
- **Pagination** for large datasets
- **Error handling** for rate limit errors (429, code 17)

Best practices:
- Run syncs during off-peak hours
- Use incremental syncs when possible
- Monitor sync logs for rate limit warnings

## Data Model

### Tables

- **MetaAccount**: Ad accounts
- **MetaCampaign**: Campaigns
- **MetaAdset**: Ad sets
- **MetaAd**: Individual ads
- **MetaInsightDaily**: Daily metrics at ad level
- **SyncRun**: Sync job history

### Insights Grain

Insights are stored at the **ad + date** level (most granular). You can aggregate up to:
- Adset level: `GROUP BY adsetId, date`
- Campaign level: `GROUP BY campaignId, date`
- Account level: `GROUP BY accountId, date`

## Security

- **RLS Policies**: All tables protected with Row Level Security
- **Server-Only API Calls**: Meta tokens never exposed to browser
- **Role-Based Access**: Admin vs Viewer roles
- **Middleware**: Auth checks on protected routes
- **Environment Variables**: Sensitive data in server-side env vars

## Testing

Run basic tests:

```bash
npm test
```

Test coverage:
- Meta API client (mocked)
- Sync engine logic
- CSV export utility

## Troubleshooting

### "Invalid access token"

- Check your Meta access token is valid
- Regenerate token if expired
- Verify token has correct permissions

### "Cannot connect to database"

- Check Supabase connection string
- Verify database password
- Ensure IP allowlist is configured (or disabled)

### "Forbidden: Admin access required"

- Verify user role in Supabase:
  ```sql
  SELECT email, raw_user_meta_data->>'role'
  FROM auth.users
  WHERE email = 'your-email';
  ```
- Update role using seed-admin.sql

### Sync fails with rate limit errors

- Wait 1-2 hours before retrying
- Reduce sync frequency
- Contact Meta support for rate limit increase

## Known Limitations

1. **Single Token**: Currently uses one global Meta access token
   - Future: Per-account token storage (schema supports it)

2. **Manual Sync Only**: No automatic scheduling built-in
   - Use GitHub Actions, Supabase Cron, or Vercel Cron

3. **Basic Filtering**: Limited date range and account filtering
   - Future: Campaign/adset/ad drill-down filters

4. **No Real-time Updates**: Dashboard shows cached data
   - Data refreshes on page load or manual sync

## Future Enhancements

- [ ] Per-account OAuth flow
- [ ] Advanced filtering (date range picker, multi-select)
- [ ] Adset and ad drill-down pages
- [ ] Email notifications for sync failures
- [ ] Performance comparison (week-over-week, etc.)
- [ ] Custom metric calculations
- [ ] User management UI (promote/demote roles)

## Support

For issues or questions:
1. Check this README
2. Review Supabase logs
3. Check Vercel deployment logs
4. Review Meta API documentation

## License

Internal use only. Not for redistribution.

---

Built with ❤️ for Proyecta by Claude Code
