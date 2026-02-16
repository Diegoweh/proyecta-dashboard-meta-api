'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { signOut } from '@/app/actions/auth';
import { BarChart3, Home, Settings, LogOut } from 'lucide-react';

interface NavProps {
  userRole: 'ADMIN' | 'VIEWER';
}

export function Nav({ userRole }: NavProps) {
  const pathname = usePathname();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Campaigns', href: '/dashboard/campaigns', icon: BarChart3 },
    ...(userRole === 'ADMIN'
      ? [{ name: 'Admin', href: '/admin', icon: Settings }]
      : []),
  ];

  return (
    <nav className="flex h-16 items-center justify-between border-b px-6">
      <div className="flex items-center gap-8">
        <Link href="/dashboard" className="text-xl font-bold">
          Proyecta Dashboard
        </Link>
        <div className="flex gap-4">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 text-sm font-medium transition-colors hover:text-primary',
                  pathname === item.href
                    ? 'text-foreground'
                    : 'text-muted-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </div>
      </div>
      <form action={signOut}>
        <Button variant="ghost" size="sm" type="submit">
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </form>
    </nav>
  );
}
