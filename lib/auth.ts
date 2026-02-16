import { createClient } from './supabase/server';
import { cache } from 'react';

export type UserRole = 'ADMIN' | 'VIEWER';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email!,
      role: (user.user_metadata?.role as UserRole) || 'VIEWER',
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
});

export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireAuth();
  if (user.role !== 'ADMIN') {
    throw new Error('Forbidden: Admin access required');
  }
  return user;
}

export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === 'ADMIN';
}
