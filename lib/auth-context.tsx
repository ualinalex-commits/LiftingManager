import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type UserRole =
  | 'global_admin'
  | 'company_admin'
  | 'ap'
  | 'supervisor'
  | 'crane_operator'
  | 'slinger'
  | 'subcontractor'
  | null;

type AuthContextType = {
  session: Session | null;
  role: UserRole;
  userId: string | null;
  companyId: string | null;
  siteId: string | null;
  userName: string | null;
  loading: boolean;
  roleError: string | null;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  role: null,
  userId: null,
  companyId: null,
  siteId: null,
  userName: null,
  loading: true,
  roleError: null,
});

async function fetchUserData(userId: string): Promise<{
  role: UserRole;
  companyId: string | null;
  siteId: string | null;
  userName: string | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('users')
    .select('role, company_id, site_id, name')
    .eq('supabase_auth_uid', userId)
    .single();
  console.log('[fetchUserData] userId:', userId, '| data:', data, '| error:', error?.message ?? null);
  return {
    role: (data?.role as UserRole) ?? null,
    companyId: data?.company_id ?? null,
    siteId: data?.site_id ?? null,
    userName: data?.name ?? null,
    error: error?.message ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        const { role: r, companyId: c, siteId: s, userName: n, error: e } = await fetchUserData(session.user.id);
        setRole(r);
        setCompanyId(c);
        setSiteId(s);
        setUserName(n);
        setRoleError(e);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session?.user) {
          const { role: r, companyId: c, siteId: s, userName: n, error: e } = await fetchUserData(session.user.id);
          setRole(r);
          setCompanyId(c);
          setSiteId(s);
          setUserName(n);
          setRoleError(e);
        } else {
          setRole(null);
          setCompanyId(null);
          setSiteId(null);
          setUserName(null);
          setRoleError(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, role, userId: session?.user?.id ?? null, companyId, siteId, userName, loading, roleError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
