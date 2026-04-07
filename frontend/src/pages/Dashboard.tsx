import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Shield,
  LogOut,
  Settings,
  LayoutDashboard,
  User,
  Mail,
  KeyRound,
  ChevronRight,
  CalendarClock,
  Lock,
  AlertTriangle,
} from "lucide-react";
import {
  fetchSession,
  requestLogout,
  clearStoredToken,
  getStoredToken,
  setStoredToken,
  changePassword,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MfaSetup } from "@/components/MfaSetup";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export interface SessionUser {
  id: string;
  email: string;
  username: string | null;
  mfa_enabled: boolean;
  is_admin?: boolean;
  password_changed_at?: string;
  password_age_days?: number;
  password_max_age_days?: number;
  password_rotation_recommended?: boolean;
  days_until_password_rotation_suggested?: number;
}

export interface SecurityPolicy {
  max_failed_login_attempts: number;
  lockout_minutes: number;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [policy, setPolicy] = useState<SecurityPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [pwSubmitting, setPwSubmitting] = useState(false);

  const loadUser = useCallback(async () => {
    const data = await fetchSession();
    setUser(data.user as SessionUser);
    if (data.security_policy) {
      setPolicy(data.security_policy as SecurityPolicy);
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

  const logout = async () => {
    try {
      await requestLogout();
    } finally {
      clearStoredToken();
      navigate("/", { replace: true });
    }
  };

  const submitChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPw !== confirmPw) {
      setPwMsg({ type: "err", text: "New password and confirmation do not match." });
      return;
    }
    setPwSubmitting(true);
    try {
      const result = (await changePassword(currentPw, newPw)) as { message?: string; token?: string };
      if (result.token) {
        setStoredToken(result.token);
      }
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setPwMsg({ type: "ok", text: "Password updated. Your password age timer has been reset." });
      await loadUser();
    } catch (err) {
      setPwMsg({
        type: "err",
        text: err instanceof Error ? err.message : "Could not change password.",
      });
    } finally {
      setPwSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-grid-subtle flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading your dashboard…</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (showMfaSetup) {
    return (
      <div className="bg-grid-subtle min-h-screen">
        <header className="border-b border-border/80 bg-background/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
            <Link to="/dashboard" className="flex items-center gap-2 text-sm font-medium text-primary">
              <ChevronRight className="h-4 w-4 rotate-180" aria-hidden />
              Back to dashboard
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-lg px-4 py-10">
          <Card>
            <CardContent className="pt-6">
              <MfaSetup
                userId={user.id}
                onComplete={async () => {
                  setShowMfaSetup(false);
                  await loadUser();
                }}
                onCancel={() => setShowMfaSetup(false)}
              />
            </CardContent>
          </Card>
        </main>
      </div>
    );
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
              <p className="text-[11px] text-muted-foreground">Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user.is_admin && (
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin">
                  Admin Panel
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" asChild>
              <Link to="/">
                Home
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
              <LayoutDashboard className="h-3.5 w-3.5 text-primary" aria-hidden />
              Overview
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Welcome back{user.username ? `, ${user.username}` : ""}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your account overview and security settings.
            </p>
          </div>
        </div>

        {user.password_rotation_recommended && (
          <Alert className="mb-6 border-amber-300 bg-amber-50 text-amber-950">
            <AlertTriangle className="h-4 w-4 text-amber-800" />
            <AlertTitle className="text-amber-950">Password rotation recommended</AlertTitle>
            <AlertDescription className="text-amber-900">
              Your password is <strong>{user.password_age_days ?? 0}</strong> days old. Policy suggests changing
              it at least every <strong>{user.password_max_age_days ?? 30}</strong> days. Update it below to stay in
              line with good practice.
            </AlertDescription>
          </Alert>
        )}

        {!user.password_rotation_recommended &&
          typeof user.days_until_password_rotation_suggested === "number" && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <p>
                Last password change tracked for expiry policy. Next suggested change in about{" "}
                <span className="font-medium text-foreground">
                  {user.days_until_password_rotation_suggested}
                </span>{" "}
                day(s) (policy: {user.password_max_age_days ?? 30}-day rotation window).
              </p>
            </div>
          )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border bg-card shadow-md shadow-slate-900/8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="h-5 w-5 text-primary" aria-hidden />
                Profile
              </CardTitle>
              <CardDescription>Identity linked to this session.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 px-4 py-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Email</p>
                  <p className="text-sm font-medium text-foreground">{user.email}</p>
                </div>
              </div>
              {user.username && (
                <div className="flex items-start gap-3 rounded-md border border-border bg-muted/30 px-4 py-3">
                  <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Username</p>
                    <p className="text-sm font-medium text-foreground">{user.username}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-md shadow-slate-900/8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <KeyRound className="h-5 w-5 text-primary" aria-hidden />
                Security
              </CardTitle>
              <CardDescription>Authentication and two-factor status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-md border border-border px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Two-factor authentication</p>
                  <p className="text-xs text-muted-foreground">TOTP with authenticator app</p>
                </div>
                <span
                  className={cn(
                    "rounded-md px-2 py-1 text-xs font-medium",
                    user.mfa_enabled
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-900",
                  )}
                >
                  {user.mfa_enabled ? "Enabled" : "Not enabled"}
                </span>
              </div>
              <Separator />
              {!user.mfa_enabled ? (
                <Button className="w-full" onClick={() => setShowMfaSetup(true)}>
                  <Settings className="h-4 w-4" aria-hidden />
                  Enable two-factor authentication
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">
                  MFA is active. Keep your recovery codes in a safe place. To change MFA, contact support or use
                  your organisation’s account recovery process.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Card className="border-border bg-card shadow-md shadow-slate-900/8 md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lock className="h-5 w-5 text-primary" aria-hidden />
                Change password
              </CardTitle>
              <CardDescription>
                Updates your hash server-side and resets the password-age clock for the{" "}
                {user.password_max_age_days ?? 30}-day rotation reminder.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitChangePassword} className="mx-auto max-w-md space-y-3">
                {pwMsg && (
                  <p
                    className={cn(
                      "text-sm",
                      pwMsg.type === "ok" ? "text-emerald-700" : "text-red-700",
                    )}
                  >
                    {pwMsg.text}
                  </p>
                )}
                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor="dash-cur-pw">
                    Current password
                  </label>
                  <input
                    id="dash-cur-pw"
                    type="password"
                    className="input-enterprise mt-1"
                    value={currentPw}
                    onChange={(e) => setCurrentPw(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor="dash-new-pw">
                    New password
                  </label>
                  <input
                    id="dash-new-pw"
                    type="password"
                    className="input-enterprise mt-1"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground" htmlFor="dash-confirm-pw">
                    Confirm new password
                  </label>
                  <input
                    id="dash-confirm-pw"
                    type="password"
                    className="input-enterprise mt-1"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
                <Button type="submit" disabled={pwSubmitting}>
                  {pwSubmitting ? "Updating…" : "Update password"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {policy && (
            <Card className="border-border bg-card shadow-md shadow-slate-900/8 md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Security policy (demo)</CardTitle>
                <CardDescription>Account protection settings enforced on sign-in.</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ul className="list-inside list-disc space-y-1">
                  <li>
                    Up to <strong className="text-foreground">{policy.max_failed_login_attempts}</strong> wrong
                    password attempts before the account is temporarily locked.
                  </li>
                  <li>
                    Lockout lasts about <strong className="text-foreground">{policy.lockout_minutes}</strong>{" "}
                    minutes; successes reset the failure counter.
                  </li>
                  <li>
                    Password strength on registration uses an entropy meter and criteria checklist; rotation is
                    recommended after {user.password_max_age_days ?? 30} days.
                  </li>
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
