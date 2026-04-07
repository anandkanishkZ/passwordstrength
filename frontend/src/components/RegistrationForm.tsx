/**
 * RegistrationForm.tsx — Secure User Registration
 *
 * Bot resistance: Google reCAPTCHA v3 (token verified on the server).
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, User, Lock, ShieldCheck, AlertCircle, Loader2, Mail } from "lucide-react";
import { evaluatePasswordStrength, StrengthResult } from "@/lib/passwordStrength";
import { validateUsername, validatePassword, validatePasswordMatch, sanitiseInput } from "@/lib/inputValidation";
import { registerRequestOtpRemote, registerVerifyOtpRemote, setStoredToken } from "@/lib/api";
import { executeRecaptcha, isRecaptchaConfigured } from "@/lib/recaptcha";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";
import { Button } from "@/components/ui/button";

interface FormState {
  email: string;
  gmail: string;
  username: string;
  password: string;
  confirmPassword: string;
  otp: string;
}

interface FormErrors {
  email?: string;
  gmail?: string;
  username?: string;
  password?: string;
  confirmPassword?: string;
  otp?: string;
}

type SubmissionResult =
  | { status: "success"; message: string; hashPreview: string }
  | { status: "error"; message: string }
  | null;

export function RegistrationForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>({
    email: "",
    gmail: "",
    username: "",
    password: "",
    confirmPassword: "",
    otp: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [strengthResult, setStrengthResult] = useState<StrengthResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SubmissionResult>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);

  const updateField = (field: keyof FormState, value: string) => {
    const sanitised =
      field === "password" || field === "confirmPassword" ? value : sanitiseInput(value);

    setForm((prev) => ({ ...prev, [field]: sanitised }));
    setResult(null);

    if (field === "password") {
      if (value.length > 0) {
        setStrengthResult(evaluatePasswordStrength(value, form.username));
      } else {
        setStrengthResult(null);
      }
    }

    if (field === "username" && form.password) {
      setStrengthResult(evaluatePasswordStrength(form.password, value));
    }

    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    const usernameCheck = validateUsername(form.username);
    const passwordCheck = validatePassword(form.password);
    const confirmCheck = validatePasswordMatch(form.password, form.confirmPassword);

    const newErrors: FormErrors = {};
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) newErrors.email = "Enter a valid email.";
    if (!form.gmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.gmail)) newErrors.gmail = "Enter a valid Gmail.";
    if (!usernameCheck.valid) newErrors.username = usernameCheck.error;
    if (!passwordCheck.valid) newErrors.password = passwordCheck.error;
    if (!confirmCheck.valid) newErrors.confirmPassword = confirmCheck.error;

    if (passwordCheck.valid && strengthResult && strengthResult.score < 40) {
      newErrors.password = "Password is too weak. Please improve it based on the criteria below.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (!isRecaptchaConfigured()) {
      setResult({
        status: "error",
        message: "reCAPTCHA is not configured. Set VITE_RECAPTCHA_SITE_KEY in your frontend environment.",
      });
      return;
    }

    setIsLoading(true);
    let captchaToken: string;
    try {
      captchaToken = await executeRecaptcha("auth");
    } catch {
      setResult({
        status: "error",
        message: "Security check failed to load. Refresh the page and try again.",
      });
      setIsLoading(false);
      return;
    }

    try {
      const registrationResult = await registerRequestOtpRemote(
        form.email.trim().toLowerCase(),
        form.gmail.trim().toLowerCase(),
        form.password,
        form.username,
        captchaToken
      );
      setChallengeId(registrationResult.challengeId);
      setResult({
        status: "success",
        message: registrationResult.message || "OTP sent. Verify to complete registration.",
        hashPreview: "",
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Registration failed. Please try again.";
      setResult({ status: "error", message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!challengeId) return;
    if (!/^\d{6}$/.test(form.otp)) {
      setErrors((prev) => ({ ...prev, otp: "Enter a 6-digit OTP." }));
      return;
    }
    setIsLoading(true);
    setResult(null);
    try {
      const registrationResult = await registerVerifyOtpRemote(challengeId, form.otp);
      if (registrationResult.token && typeof registrationResult.token === "string") {
        setStoredToken(registrationResult.token);
        navigate("/dashboard", { replace: true });
        return;
      }
      setResult({ status: "error", message: "Verification did not return a session token." });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "OTP verification failed.";
      setResult({ status: "error", message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate aria-label="Secure Registration Form">
      {result && (
        <div
          role="alert"
          aria-live="polite"
          className={`flex items-start gap-3 rounded-lg border p-4 ${
            result.status === "success"
              ? "border-[hsl(var(--success)/0.4)] bg-[hsl(var(--success)/0.08)] text-[hsl(var(--success))]"
              : "border-[hsl(var(--destructive)/0.4)] bg-[hsl(var(--destructive)/0.08)] text-[hsl(var(--destructive))]"
          }`}
        >
          {result.status === "success" ? (
            <ShieldCheck size={18} className="mt-0.5 shrink-0" />
          ) : (
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold">{result.message}</p>
            {result.status === "success" && result.hashPreview && (
              <div className="mt-2 space-y-1">
                <p className="font-mono text-[11px] text-muted-foreground">
                  Stored hash (bcrypt, {12} rounds):
                </p>
                <code className="block break-all rounded bg-muted/60 px-2 py-1 font-mono text-[11px] text-primary">
                  {result.hashPreview}
                </code>
                <p className="font-mono text-[10px] text-muted-foreground">
                  ↳ Plaintext password has been discarded and is NOT stored.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="email" className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Mail size={15} className="text-primary shrink-0" aria-hidden />
          Email
        </label>
        <input
          id="email"
          type="email"
          value={form.email}
          onChange={(e) => updateField("email", e.target.value)}
          placeholder="you@company.com"
          autoComplete="email"
          aria-describedby={errors.email ? "email-error" : undefined}
          aria-invalid={!!errors.email}
          className={`input-enterprise ${errors.email ? "input-enterprise-error" : ""}`}
        />
        {errors.email && <p id="email-error" role="alert" className="font-mono text-xs text-[hsl(var(--destructive))]">{errors.email}</p>}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="gmail" className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Mail size={15} className="text-primary shrink-0" aria-hidden />
          Gmail (for OTP)
        </label>
        <input
          id="gmail"
          type="email"
          value={form.gmail}
          onChange={(e) => updateField("gmail", e.target.value)}
          placeholder="yourname@gmail.com"
          autoComplete="email"
          aria-describedby={errors.gmail ? "gmail-error" : undefined}
          aria-invalid={!!errors.gmail}
          className={`input-enterprise ${errors.gmail ? "input-enterprise-error" : ""}`}
        />
        {errors.gmail && <p id="gmail-error" role="alert" className="font-mono text-xs text-[hsl(var(--destructive))]">{errors.gmail}</p>}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="username" className="flex items-center gap-2 text-sm font-medium text-foreground">
          <User size={15} className="text-primary shrink-0" aria-hidden />
          Username
        </label>
        <div className="relative">
          <input
            id="username"
            type="text"
            value={form.username}
            onChange={(e) => updateField("username", e.target.value)}
            placeholder="e.g. john_doe"
            maxLength={30}
            autoComplete="username"
            aria-describedby={errors.username ? "username-error" : undefined}
            aria-invalid={!!errors.username}
            className={`input-enterprise ${errors.username ? "input-enterprise-error" : ""}`}
          />
        </div>
        {errors.username && (
          <p
            id="username-error"
            role="alert"
            className="flex items-center gap-1.5 font-mono text-xs text-[hsl(var(--destructive))]"
          >
            <AlertCircle size={11} />
            {errors.username}
          </p>
        )}
        <p className="font-mono text-[10px] text-muted-foreground">
          Letters, numbers, underscores only. 3–30 characters.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Lock size={15} className="text-primary shrink-0" aria-hidden />
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={form.password}
            onChange={(e) => updateField("password", e.target.value)}
            placeholder="Min. 12 characters"
            maxLength={128}
            autoComplete="new-password"
            aria-describedby={errors.password ? "password-error" : undefined}
            aria-invalid={!!errors.password}
            className={`input-enterprise pr-11 ${errors.password ? "input-enterprise-error" : ""}`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((p) => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {errors.password && (
          <p
            id="password-error"
            role="alert"
            className="flex items-center gap-1.5 font-mono text-xs text-[hsl(var(--destructive))]"
          >
            <AlertCircle size={11} />
            {errors.password}
          </p>
        )}
        <PasswordStrengthMeter result={strengthResult} password={form.password} />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirmPassword" className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Lock size={15} className="text-primary shrink-0" aria-hidden />
          Confirm password
        </label>
        <div className="relative">
          <input
            id="confirmPassword"
            type={showConfirm ? "text" : "password"}
            value={form.confirmPassword}
            onChange={(e) => updateField("confirmPassword", e.target.value)}
            placeholder="Re-enter your password"
            maxLength={128}
            autoComplete="new-password"
            aria-describedby={errors.confirmPassword ? "confirm-error" : undefined}
            aria-invalid={!!errors.confirmPassword}
            className={`input-enterprise pr-11 ${errors.confirmPassword ? "input-enterprise-error" : ""}`}
          />
          <button
            type="button"
            onClick={() => setShowConfirm((p) => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary"
            aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
          >
            {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {errors.confirmPassword && (
          <p
            id="confirm-error"
            role="alert"
            className="flex items-center gap-1.5 font-mono text-xs text-[hsl(var(--destructive))]"
          >
            <AlertCircle size={11} />
            {errors.confirmPassword}
          </p>
        )}
        {form.confirmPassword && form.password === form.confirmPassword && !errors.confirmPassword && (
          <p className="flex items-center gap-1.5 font-mono text-xs text-[hsl(var(--success))]">
            <ShieldCheck size={11} /> Passwords match
          </p>
        )}
      </div>

      <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <strong className="font-medium text-foreground">reCAPTCHA v3</strong> runs invisibly—there is no puzzle or
        checkbox. If the script loaded, you will see the small reCAPTCHA badge in the corner of the page.
      </p>

      <Button type="submit" disabled={isLoading || !!challengeId} className="w-full" size="lg" aria-label="Submit registration form">
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Registering…
          </>
        ) : (
          <>
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Create account
          </>
        )}
      </Button>

      {challengeId && (
        <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
          <label htmlFor="register-otp" className="text-sm font-medium text-foreground">
            Enter OTP sent to your Gmail
          </label>
          <input
            id="register-otp"
            type="text"
            value={form.otp}
            onChange={(e) => updateField("otp", e.target.value)}
            placeholder="6-digit OTP"
            maxLength={6}
            className={`input-enterprise font-mono ${errors.otp ? "input-enterprise-error" : ""}`}
            autoComplete="one-time-code"
          />
          {errors.otp && <p role="alert" className="font-mono text-xs text-[hsl(var(--destructive))]">{errors.otp}</p>}
          <Button type="button" onClick={handleVerifyOtp} disabled={isLoading} className="w-full">
            Verify OTP and continue
          </Button>
        </div>
      )}

      <p className="flex items-center justify-center gap-2 text-center text-[11px] text-muted-foreground">
        <ShieldCheck size={12} className="text-primary shrink-0" aria-hidden />
        Passwords hashed with bcrypt (12 rounds). Plaintext is not retained.
      </p>
    </form>
  );
}
