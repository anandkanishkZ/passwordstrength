import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Shield,
  LogOut,
  ChevronRight,
  Users,
  Mail,
  User,
  Calendar,
  ShieldCheck,
} from "lucide-react";
import {
  fetchSession,
  requestLogout,
  clearStoredToken,
  getStoredToken,
  setStoredToken,
  fetchAdminUsers,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface AdminUser {
  id: string;
  email: string;
  username: string | null;
  mfa_enabled: boolean;
  created_at: string;
  updated_at: string;
  is_admin: boolean;
}

const AdminPanel = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ is_admin?: boolean } | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const data = await fetchSession();
    setUser(data.user);
    if (!data.user.is_admin) {
      navigate("/dashboard", { replace: true });
      return;
    }
  }, [navigate]);

  const loadUsers = useCallback(async () => {
    try {
      const data = await fetchAdminUsers();
      setUsers(data.users);
    } catch (error) {
      console.error("Failed to load users:", error);
    }
  }, []);

  useEffect(() => {
    if (!getStoredToken()) {
      navigate("/", { replace: true });
      return;
    }
    loadUser()
      .catch(() => {
        clearStoredToken();
        navigate("/", { replace: true });
      })
      .finally(() => setLoading(false));
  }, [navigate, loadUser]);

  useEffect(() => {
    if (user?.is_admin) {
      loadUsers();
    }
  }, [user, loadUsers]);

  const logout = async () => {
    try {
      await requestLogout();
    } finally {
      clearStoredToken();
      navigate("/", { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="bg-grid-subtle flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading admin panel…</p>
      </div>
    );
  }

  if (!user?.is_admin) {
    return null;
  }

  return (
    <div className="bg-grid-subtle min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
              <Shield className="h-4 w-4 text-primary" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-foreground">Secure Guardian Gate</p>
              <p className="text-[11px] text-muted-foreground">Admin Panel</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard">
                <ChevronRight className="h-4 w-4 rotate-180" aria-hidden />
                Back to Dashboard
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-1 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              <Users className="h-3.5 w-3.5 text-primary" aria-hidden />
              Administration
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              User Management
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              View and manage all registered users.
            </p>
          </div>
        </div>

        <Card className="border-border bg-card shadow-md shadow-slate-900/8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5 text-primary" aria-hidden />
              Registered Users ({users.length})
            </CardTitle>
            <CardDescription>All users in the system.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground">{u.email}</p>
                        {u.is_admin && (
                          <Badge variant="secondary" className="text-xs">
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            Admin
                          </Badge>
                        )}
                      </div>
                      {u.username && (
                        <p className="text-xs text-muted-foreground">@{u.username}</p>
                      )}
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {u.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Joined {new Date(u.created_at).toLocaleDateString()}
                        </span>
                        <span className={cn(
                          "flex items-center gap-1",
                          u.mfa_enabled ? "text-emerald-600" : "text-amber-600"
                        )}>
                          <Shield className="h-3 w-3" />
                          MFA {u.mfa_enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminPanel;