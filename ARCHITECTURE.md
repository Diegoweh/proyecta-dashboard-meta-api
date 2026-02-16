# Architecture Overview

## System Design

Proyecta Dashboard is a Next.js application that acts as a data warehouse and analytics platform for Meta Marketing API data.

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Browser   │─────▶│   Next.js    │─────▶│  Supabase   │
│  (Client)   │      │   (Server)   │      │ (Postgres)  │
└─────────────┘      └──────────────┘      └─────────────┘
                            │
                            │
                            ▼
                     ┌──────────────┐
                     │  Meta API    │
                     │  (Facebook)  │
                     └──────────────┘
```

## Data Flow

### 1. Authentication Flow

```
User Login
    ↓
Supabase Auth (Email/Password)
    ↓
JWT Token (with role metadata)
    ↓
Middleware validates token + role
    ↓
Protected pages (Dashboard/Admin)
```

### 2. Data Sync Flow

```
Admin triggers sync
    ↓
Server Action (requireAdmin)
    ↓
Meta Sync Engine
    ├─ Fetch Accounts
    ├─ Fetch Campaigns
    ├─ Fetch Adsets
    ├─ Fetch Ads
    └─ Fetch Insights (daily, by ad)
    ↓
Upsert to Postgres via Prisma
    ↓
Update Sync Run status
```

### 3. Dashboard Query Flow

```
User visits Dashboard
    ↓
Server Component loads
    ↓
Server Actions query Prisma
    ├─ Aggregate metrics
    ├─ Time series data
    └─ Campaign performance
    ↓
Render with React Server Components
    ↓
Client hydrates with React Query
```

## Key Components

### Backend

**Meta API Client** (`lib/meta/client.ts`)
- Handles HTTP requests to Meta Graph API
- Implements retry logic with exponential backoff
- Manages pagination automatically
- Rate limit handling (429 errors, code 17)

**Sync Engine** (`lib/meta/sync.ts`)
- Orchestrates data fetching from Meta API
- Upserts data into Postgres
- Tracks sync runs with status/counts
- Handles errors gracefully

**Server Actions** (`app/actions/`)
- `auth.ts`: Sign in, sign up, sign out
- `sync.ts`: Trigger sync, fetch sync history
- `dashboard.ts`: Query metrics, time series, campaigns

**Database** (Prisma + Supabase)
- Prisma ORM for type-safe queries
- Supabase Postgres for storage
- Row Level Security (RLS) for access control

### Frontend

**Pages** (`app/`)
- `/auth/login` - Authentication
- `/dashboard` - Main metrics overview
- `/dashboard/campaigns` - Campaign performance table
- `/admin` - Sync management (admin-only)

**Components** (`components/`)
- `Nav` - Navigation bar with role-based links
- `MetricCard` - Reusable metric display
- `TimeSeriesChart` - Recharts line chart
- `SyncButton` - Trigger sync with loading state
- `ExportButton` - CSV export utility

**State Management**
- React Server Components for data fetching
- TanStack Query for client-side caching
- Server Actions for mutations

## Database Schema

```
MetaAccount (1) ──< (M) MetaCampaign
                          │
                          │ (1)
                          ▼
                          (M) MetaAdset
                                │
                                │ (1)
                                ▼
                                (M) MetaAd
                                      │
                                      │ (1)
                                      ▼
                                      (M) MetaInsightDaily
```

**Insights Grain**: Ad + Date (most granular)

This allows aggregation up to:
- Adset level: `GROUP BY adsetId, date`
- Campaign level: `GROUP BY campaignId, date`
- Account level: `GROUP BY accountId, date`

## Security Model

### Row Level Security (RLS)

All tables protected with policies:

**Read Access**: All authenticated users
```sql
POLICY "Authenticated users can view data"
  ON table_name
  FOR SELECT
  USING (is_authenticated())
```

**Write Access**: Admin-only
```sql
POLICY "Admins can manage data"
  ON table_name
  FOR ALL
  USING (is_admin())
```

### Server-Only Operations

Meta API calls are **server-only**:
- Access tokens stored in environment variables
- Never exposed to browser
- Server Actions validate user role
- Middleware protects routes

### Role-Based Access Control

Two roles:
1. **ADMIN**: Full access, can trigger syncs
2. **VIEWER**: Read-only dashboard access

Role stored in Supabase `auth.users.raw_user_meta_data.role`

## Performance Optimizations

1. **React Server Components**: Data fetching on server, reducing client JS
2. **Parallel Queries**: `Promise.all()` for independent queries
3. **Indexed Columns**: Database indexes on frequently queried fields
4. **TanStack Query**: Client-side caching with stale-while-revalidate
5. **Prisma Connection Pool**: Efficient database connections

## Deployment Architecture

```
GitHub Repo
    ↓
Vercel (Build & Deploy)
    ├─ Next.js SSR
    ├─ API Routes
    ├─ Static Assets (CDN)
    └─ Edge Functions (Middleware)

External Services:
    ├─ Supabase (Postgres + Auth)
    ├─ Meta API (Data source)
    └─ GitHub Actions (Optional cron)
```

## Sync Strategies

### Manual Sync
- Admin clicks "Run Sync" button
- Immediate execution
- Real-time progress tracking

### Scheduled Sync (Options)

**Option 1: GitHub Actions**
- YAML workflow with cron schedule
- Hits `/api/sync` endpoint
- Runs on GitHub infrastructure

**Option 2: Supabase Cron**
- pg_cron extension
- SQL-based scheduling
- Runs inside Postgres

**Option 3: Vercel Cron**
- `vercel.json` configuration
- Serverless function trigger
- Managed by Vercel

## Error Handling

### Meta API Errors

- **Rate Limits**: Retry with exponential backoff
- **Invalid Token**: Log error, fail sync
- **Network Errors**: Retry up to 3 times
- **Pagination Errors**: Log and continue

### Database Errors

- **Connection Failures**: Retry with timeout
- **Constraint Violations**: Log and skip
- **RLS Policy Violations**: Return 403 error

### Application Errors

- **Auth Failures**: Redirect to login
- **Role Violations**: Return 403 Forbidden
- **Server Errors**: Log to console, show user-friendly message

## Monitoring & Logging

### Sync Monitoring

- **SyncRun table**: Status, duration, counts
- **Console logs**: Progress updates
- **Error field**: Full error messages

### Application Monitoring

- Vercel Analytics (built-in)
- Supabase logs (database queries)
- Browser console (client errors)

## Scalability Considerations

### Current Limits

- Single global Meta access token
- Manual sync only (no auto-scheduling built-in)
- No real-time updates (batch sync model)

### Future Scaling

1. **Multiple Tokens**: Per-account OAuth tokens
2. **Incremental Sync**: Only fetch new/updated data
3. **Parallel Processing**: Sync multiple accounts concurrently
4. **Caching Layer**: Redis for frequently accessed data
5. **Webhook Integration**: Real-time updates from Meta

## Technology Decisions

### Why Prisma?

- Type-safe database queries
- Auto-generated TypeScript types
- Built-in connection pooling
- Migration management
- Great DX with autocomplete

### Why Supabase?

- Postgres with generous free tier
- Built-in auth (no separate service)
- Row Level Security
- Real-time subscriptions (future use)
- Self-hostable (if needed)

### Why Server Actions?

- Simplified data mutations
- No API routes needed
- Type-safe end-to-end
- Progressive enhancement
- Built-in revalidation

### Why TanStack Query?

- Battle-tested caching
- Automatic refetching
- Optimistic updates
- DevTools for debugging
- Works with Server Actions

## Development Workflow

```
1. Update Prisma schema
   ↓
2. Run prisma:push (sync to DB)
   ↓
3. Update types.ts if needed
   ↓
4. Create/update server actions
   ↓
5. Build UI components
   ↓
6. Test locally
   ↓
7. Push to GitHub
   ↓
8. Auto-deploy to Vercel
```

## Testing Strategy

### Unit Tests

- Meta API client (mocked fetch)
- Utility functions (formatting, exports)
- Type validation (Zod schemas)

### Integration Tests

- Server Actions (with test database)
- Sync engine (with test Meta account)
- Auth flow (with Supabase test project)

### E2E Tests (Future)

- User login → Dashboard view
- Admin sync → Data appears
- CSV export → File downloads

## Known Limitations

1. **Single Token**: One Meta access token for all accounts
2. **No Webhooks**: Batch sync model only
3. **Limited Filtering**: Basic date/account filters
4. **No User Management UI**: Must use Supabase SQL
5. **No Alerts**: No email/Slack notifications

## Future Architecture

### Phase 2: OAuth Flow

```
User → Meta OAuth → Access Token
  ↓
Store token per account (encrypted)
  ↓
Sync uses account-specific token
```

### Phase 3: Real-time Updates

```
Meta Webhook
  ↓
Edge Function (Supabase)
  ↓
Update database
  ↓
Broadcast to clients (Realtime)
```

### Phase 4: Multi-tenancy

```
Organizations table
  ├─ Users (many-to-many)
  └─ Accounts (one-to-many)

RLS policies per organization
```

---

**Built with**: Next.js 16, React 19, TypeScript, Prisma, Supabase, TailwindCSS

**Deployed on**: Vercel

**Last Updated**: 2024
