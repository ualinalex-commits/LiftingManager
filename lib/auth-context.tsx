import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type UserRole = 'global_admin' | 'company_admin' | 'operator' | null;

type AuthContextType = {
  session: Session | null;
  role: UserRole;
  userId: string | null;
  loading: boolean;
  roleError: string | null;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  role: null,
  userId: null,
  loading: true,
  roleError: null,
});

async function fetchRole(userId: string): Promise<{ role: UserRole; error: string | null }> {
  const { data, error } = await supabase
    .from('users')
    .select('role')
    .eq('supabase_auth_uid', userId)
    .single();
  console.log('[fetchRole] userId:', userId, '| data:', data, '| error:', error?.message ?? null);
  return { role: (data?.role as UserRole) ?? null, error: error?.message ?? null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        const { role: r, error: e } = await fetchRole(session.user.id);
        setRole(r);
        setRoleError(e);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          const { role: r, error: e } = await fetchRole(session.user.id);
          setRole(r);
          setRoleError(e);
        } else {
          setRole(null);
          setRoleError(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, role, userId: session?.user?.id ?? null, loading, roleError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
