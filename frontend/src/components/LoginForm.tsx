import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Mail, Eye, EyeOff, ShieldCheck, AlertCircle } from "lucide-react";
import { loginUserRemote, loginVerifyOtpRemote, verifyMfa, setStoredToken } from "@/lib/api";
import { executeRecaptcha, isRecaptchaConfigured } from "@/lib/recaptcha";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function MessageBanner({ type, children }: { type: "success" | "error"; children: React.ReactNode }) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm",
        type === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-red-200 bg-red-50 text-red-800",
      )}
    >
      {type === "success" ? (
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
      )}
      <span>{children}</span>
    </div>
  );
}

export function LoginForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaRequired, setMfaRequired] = useState(false);
  const [userId, setUserId] = useState("");
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpChallengeId, setOtpChallengeId] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const goDashboard = () => {
    navigate("/dashboard", { replace: true });
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!isRecaptchaConfigured()) {
      setMessage({
        type: "error",
        text: "reCAPTCHA is not configured. Set VITE_RECAPTCHA_SITE_KEY in your frontend environment.",
      });
      return;
    }

    let captchaToken: string;
    try {
      captchaToken = await executeRecaptcha("auth");
    } catch {
      setMessage({
        type: "error",
        text: "Security check failed to load. Refresh the page and try again.",
      });
      return;
    }

    try {
      const res = await loginUserRemote(email, password, captchaToken);
      if (res.challengeId && typeof res.challengeId === "string") {
        setOtpRequired(true);
        setOtpChallengeId(res.challengeId);
        setMessage({ type: "success", text: res.message || "OTP sent to your Gmail. Enter it below." });
        return;
      }
      setMessage({ type: "error", text: "Sign-in did not start OTP verification." });
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Sign-in failed.",
      });
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    try {
      const res = await loginVerifyOtpRemote(otpChallengeId, otpCode);
      if (res.mfa_required) {
        setOtpRequired(false);
        setMfaRequired(true);
        setUserId(res.userId);
        setMessage({ type: "success", text: "OTP verified. Enter authenticator app code." });
        return;
      }
      if (res.token && typeof res.token === "string") {
        setStoredToken(res.token);
        goDashboard();
        return;
      }
      setMessage({ type: "error", text: "OTP verification did not return a session token." });
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "OTP verification failed.",
      });
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    try {
      const res = await verifyMfa(userId, mfaCode);
      if (res.token && typeof res.token === "string") {
        setStoredToken(res.token);
        goDashboard();
        return;
      }
      setMessage({ type: "error", text: "Verification did not return a session token." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Verification failed." });
    }
  };

  if (mfaRequired) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Second factor</h2>
          <p className="mt-1 text-sm text-muted-foreground">Enter your TOTP or a recovery code.</p>
        </div>

        {message && <MessageBanner type={message.type}>{message.text}</MessageBanner>}

        <form onSubmit={verify} className="space-y-3">
          <label className="block text-sm font-medium text-foreground">Verification code</label>
          <input
            type="text"
            className="input-enterprise font-mono"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            placeholder="000000 or recovery code"
            required
            autoComplete="one-time-code"
          />
          <Button type="submit" className="w-full">
            Verify and continue
          </Button>
        </form>
      </div>
    );
  }

  if (otpRequired) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Email OTP verification</h2>
          <p className="mt-1 text-sm text-muted-foreground">Enter the 6-digit OTP sent to your registered Gmail.</p>
        </div>
        {message && <MessageBanner type={message.type}>{message.text}</MessageBanner>}
        <form onSubmit={verifyOtp} className="space-y-3">
          <label className="block text-sm font-medium text-foreground">OTP code</label>
          <input
            type="text"
            className="input-enterprise font-mono"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            placeholder="000000"
            maxLength={6}
            required
            autoComplete="one-time-code"
          />
          <Button type="submit" className="w-full">
            Verify OTP
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {message && <MessageBanner type={message.type}>{message.text}</MessageBanner>}

      <form onSubmit={login} className="space-y-3">
      <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground" htmlFor="login-email">
            <Mail className="h-4 w-4 text-primary shrink-0" aria-hidden />
            Email
          </label>
          <input
            id="login-email"
            type="email"
            className="input-enterprise"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-sm font-medium text-foreground" htmlFor="login-password">
            <Lock className="h-4 w-4 text-primary shrink-0" aria-hidden />
            Password
          </label>
          <div className="relative">
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              className="input-enterprise pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>
    </div>
  );
}
