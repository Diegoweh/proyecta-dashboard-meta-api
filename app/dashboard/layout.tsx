import { requireAuth } from '@/lib/auth';
import { Nav } from '@/components/nav';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  return (
    <div className="min-h-screen bg-muted/40">
      <Nav userRole={user.role} />
      <main className="container mx-auto p-6">{children}</main>
    </div>
  );
}
