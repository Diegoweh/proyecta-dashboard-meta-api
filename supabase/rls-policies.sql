-- Row Level Security Policies for Proyecta Dashboard
-- Run this after Prisma migrations are applied

-- Enable RLS on all tables
ALTER TABLE "MetaAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MetaCampaign" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MetaAdset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MetaAd" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MetaInsightDaily" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SyncRun" ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT COALESCE(
      (auth.jwt() -> 'user_metadata' ->> 'role') = 'ADMIN',
      false
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is authenticated
CREATE OR REPLACE FUNCTION is_authenticated()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth.uid() IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- MetaAccount policies
-- All authenticated users can view accounts
CREATE POLICY "Authenticated users can view meta accounts"
  ON "MetaAccount"
  FOR SELECT
  TO authenticated
  USING (is_authenticated());

-- Only admins can insert/update/delete accounts
CREATE POLICY "Admins can insert meta accounts"
  ON "MetaAccount"
  FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update meta accounts"
  ON "MetaAccount"
  FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete meta accounts"
  ON "MetaAccount"
  FOR DELETE
  TO authenticated
  USING (is_admin());

-- MetaCampaign policies
CREATE POLICY "Authenticated users can view campaigns"
  ON "MetaCampaign"
  FOR SELECT
  TO authenticated
  USING (is_authenticated());

CREATE POLICY "Admins can manage campaigns"
  ON "MetaCampaign"
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- MetaAdset policies
CREATE POLICY "Authenticated users can view adsets"
  ON "MetaAdset"
  FOR SELECT
  TO authenticated
  USING (is_authenticated());

CREATE POLICY "Admins can manage adsets"
  ON "MetaAdset"
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- MetaAd policies
CREATE POLICY "Authenticated users can view ads"
  ON "MetaAd"
  FOR SELECT
  TO authenticated
  USING (is_authenticated());

CREATE POLICY "Admins can manage ads"
  ON "MetaAd"
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- MetaInsightDaily policies
CREATE POLICY "Authenticated users can view insights"
  ON "MetaInsightDaily"
  FOR SELECT
  TO authenticated
  USING (is_authenticated());

CREATE POLICY "Admins can manage insights"
  ON "MetaInsightDaily"
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- SyncRun policies
CREATE POLICY "Authenticated users can view sync runs"
  ON "SyncRun"
  FOR SELECT
  TO authenticated
  USING (is_authenticated());

CREATE POLICY "Admins can manage sync runs"
  ON "SyncRun"
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Grant usage on schema to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Note: To set a user as admin, run:
-- UPDATE auth.users
-- SET raw_user_meta_data = raw_user_meta_data || '{"role": "ADMIN"}'::jsonb
-- WHERE email = 'admin@example.com';
