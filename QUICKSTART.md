# Quick Start Guide

Get up and running with Proyecta Dashboard in 10 minutes.

## Prerequisites Checklist

- [ ] Supabase account and project created
- [ ] Meta Developer account with app created
- [ ] Meta access token with `ads_read` permission
- [ ] Node.js 18+ installed

## 5-Step Setup

### Step 1: Install Dependencies (2 min)

```bash
cd proyecta-dashboard
npm install
```

### Step 2: Configure Environment (3 min)

Create `.env` file:

```bash
cp .env.example .env
```

Fill in these critical variables:

```env
# Get from Supabase Dashboard → Settings → API
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Get from Supabase Dashboard → Settings → Database → Connection string
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres?schema=public&pgbouncer=true"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres?schema=public"

# Get from Meta Business Suite → Business Settings → System Users
META_ACCESS_TOKEN=your-meta-token-here
```

### Step 3: Setup Database (2 min)

```bash
# Generate Prisma client and push schema to Supabase
npm run prisma:generate
npm run prisma:push
```

Then in **Supabase SQL Editor**, run:

```sql
-- Copy and paste contents of supabase/rls-policies.sql
```

### Step 4: Create Admin User (1 min)

```bash
# Start dev server
npm run dev
```

1. Go to http://localhost:3000
2. Click "Sign up"
3. Create account with your email

Then in **Supabase SQL Editor**:

```sql
-- Replace with your email
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "ADMIN"}'::jsonb
WHERE email = 'your-email@example.com';
```

### Step 5: Run First Sync (2 min)

1. Sign in at http://localhost:3000
2. Navigate to **Admin** page
3. Click **"Run Sync"**
4. Wait for completion (30-60 seconds typically)
5. Go to **Dashboard** to see your data!

## Verification

You should now see:

- ✅ Dashboard with metrics cards
- ✅ Time series chart
- ✅ Campaigns table with data
- ✅ Admin panel with sync history

## Common Issues

### "Invalid access token"

Your Meta token may be expired. Generate a new one:

1. Go to Meta Business Suite
2. System Users → Your User → Generate Token
3. Copy new token to `.env`
4. Restart dev server

### "Cannot connect to database"

Check your DATABASE_URL:

1. Go to Supabase → Settings → Database
2. Copy "Connection string"
3. Replace `[YOUR-PASSWORD]` with actual password
4. Ensure both DATABASE_URL and DIRECT_URL are set

### "Forbidden: Admin access required"

Run the admin promotion SQL again:

```sql
SELECT email, raw_user_meta_data->>'role' as role
FROM auth.users;
-- Check your role, should be "ADMIN"

-- If not, run:
UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data || '{"role": "ADMIN"}'::jsonb
WHERE email = 'your-email@example.com';
```

## Next Steps

1. **Schedule automated syncs** - See README.md "Scheduling Automated Syncs"
2. **Deploy to production** - See README.md "Deployment"
3. **Add more users** - Sign up → promote to VIEWER role
4. **Customize dashboard** - Edit `app/dashboard/page.tsx`

## Getting Help

1. Check full README.md for detailed docs
2. Review ARCHITECTURE.md for system design
3. Check Supabase logs for database errors
4. Check Vercel logs for application errors

## Testing

Run tests to verify everything works:

```bash
npm test
```

Expected output: All tests passing ✓

---

**Total setup time: ~10 minutes**

You now have a fully functional Meta Marketing dashboard!
