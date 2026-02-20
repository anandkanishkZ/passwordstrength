/**
 * RegistrationForm.tsx
 * =====================================================================
 * Secure User Registration Form
 * CET324 – Advanced CyberSecurity | University of Sunderland
 *
 * SECURITY ARCHITECTURE:
 * 1. All inputs validated and sanitised before processing
 * 2. Password strength enforced with entropy-based scoring
 * 3. CAPTCHA verified before registration completes
 * 4. bcrypt used to hash password (salt rounds: 12)
 * 5. Plaintext password discarded immediately after hashing
 * 6. No sensitive data logged to console
 * 7. Error messages are generic to prevent username enumeration
 * =====================================================================
 */

import { useState, useRef } from "react";
import { Eye, EyeOff, User, Lock, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { evaluatePasswordStrength, StrengthResult } from "@/lib/passwordStrength";
import { validateUsername, validatePassword, validatePasswordMatch, sanitiseInput } from "@/lib/inputValidation";
import { generateCaptcha, validateCaptcha, CaptchaChallenge } from "@/lib/captcha";
import { registerUser } from "@/lib/secureStorage";
import { PasswordStrengthMeter } from "./PasswordStrengthMeter";
import { CaptchaWidget } from "./CaptchaWidget";

interface FormState {
  username: string;
  password: string;
  confirmPassword: string;
  captchaAnswer: string;
}

interface FormErrors {
  username?: string;
  password?: string;
  confirmPassword?: string;
  captcha?: string;
}

type SubmissionResult =
  | { status: "success"; message: string; hashPreview: string }
  | { status: "error"; message: string }
  | null;

export function RegistrationForm() {
  const [form, setForm] = useState<FormState>({
    username: "",
    password: "",
    confirmPassword: "",
    captchaAnswer: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [strengthResult, setStrengthResult] = useState<StrengthResult | null>(null);
  const [captchaChallenge, setCaptchaChallenge] = useState<CaptchaChallenge>(() => generateCaptcha());
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SubmissionResult>(null);

  const captchaRef = useRef<{ refresh: () => void }>(null);

  const updateField = (field: keyof FormState, value: string) => {
    const sanitised = field === "password" || field === "confirmPassword"
      ? value  // SECURITY: Don't sanitise passwords (special chars are valid)
      : sanitiseInput(value);

    setForm(prev => ({ ...prev, [field]: sanitised }));
    setResult(null);

    // Real-time password strength evaluation
    if (field === "password") {
      if (value.length > 0) {
        setStrengthResult(evaluatePasswordStrength(value, form.username));
      } else {
        setStrengthResult(null);
      }
    }

    // Re-evaluate strength when username changes (similarity check)
    if (field === "username" && form.password) {
      setStrengthResult(evaluatePasswordStrength(form.password, value));
    }

    // Clear field-specific error on input
    if (errors[field as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    // --- STEP 1: Validate all inputs ---
    const usernameCheck = validateUsername(form.username);
    const passwordCheck = validatePassword(form.password);
    const confirmCheck  = validatePasswordMatch(form.password, form.confirmPassword);
    const captchaValid  = validateCaptcha(captchaChallenge, form.captchaAnswer);

    const newErrors: FormErrors = {};
    if (!usernameCheck.valid)  newErrors.username         = usernameCheck.error;
    if (!passwordCheck.valid)  newErrors.password         = passwordCheck.error;
    if (!confirmCheck.valid)   newErrors.confirmPassword  = confirmCheck.error;
    if (!captchaValid)         newErrors.captcha          = "Incorrect answer. A new challenge has been generated.";

    // --- STEP 2: Enforce password strength threshold ---
    if (passwordCheck.valid && strengthResult && strengthResult.score < 40) {
      newErrors.password = "Password is too weak. Please improve it based on the criteria below.";
    }

    // SECURITY: If CAPTCHA fails, regenerate immediately (prevent retry with same challenge)
    if (!captchaValid) {
      const newChallenge = generateCaptcha();
      setCaptchaChallenge(newChallenge);
      setForm(prev => ({ ...prev, captchaAnswer: "" }));
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // --- STEP 3: Hash password and register user ---
    setIsLoading(true);
    try {
      // SECURITY: Password is hashed here; plaintext never stored or logged
      const registrationResult = await registerUser(form.username, form.password);

      if (registrationResult.success) {
        setResult({
          status: "success",
          message: registrationResult.message,
          hashPreview: registrationResult.hashPreview ?? "",
        });
        // SECURITY: Clear sensitive form data on success
        setForm({ username: "", password: "", confirmPassword: "", captchaAnswer: "" });
        setStrengthResult(null);
        // Regenerate CAPTCHA after successful registration
        setCaptchaChallenge(generateCaptcha());
      } else {
        setResult({ status: "error", message: registrationResult.message });
      }
    } catch {
      // SECURITY: Generic error message — no internal details exposed
      setResult({ status: "error", message: "Registration failed. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate aria-label="Secure Registration Form">

      {/* === Global result message === */}
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

      {/* === Username field === */}
      <div className="space-y-1.5">
        <label htmlFor="username" className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <User size={13} className="text-primary" />
          Username
        </label>
        <div className="relative">
          <input
            id="username"
            type="text"
            value={form.username}
            onChange={e => updateField("username", e.target.value)}
            placeholder="e.g. john_doe"
            maxLength={30}
            autoComplete="username"
            aria-describedby={errors.username ? "username-error" : undefined}
            aria-invalid={!!errors.username}
            className={`input-cyber w-full rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground ${
              errors.username ? "border-[hsl(var(--destructive))]" : ""
            }`}
          />
        </div>
        {errors.username && (
          <p id="username-error" role="alert" className="flex items-center gap-1.5 font-mono text-xs text-[hsl(var(--destructive))]">
            <AlertCircle size={11} />
            {errors.username}
          </p>
        )}
        <p className="font-mono text-[10px] text-muted-foreground">
          Letters, numbers, underscores only. 3–30 characters.
        </p>
      </div>

      {/* === Password field === */}
      <div className="space-y-1.5">
        <label htmlFor="password" className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <Lock size={13} className="text-primary" />
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={form.password}
            onChange={e => updateField("password", e.target.value)}
            placeholder="Min. 12 characters"
            maxLength={128}
            autoComplete="new-password"
            aria-describedby={errors.password ? "password-error" : undefined}
            aria-invalid={!!errors.password}
            className={`input-cyber w-full rounded-lg px-4 py-2.5 pr-11 text-sm placeholder:text-muted-foreground ${
              errors.password ? "border-[hsl(var(--destructive))]" : ""
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(p => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" role="alert" className="flex items-center gap-1.5 font-mono text-xs text-[hsl(var(--destructive))]">
            <AlertCircle size={11} />
            {errors.password}
          </p>
        )}

        {/* Real-time strength feedback */}
        <PasswordStrengthMeter result={strengthResult} password={form.password} />
      </div>

      {/* === Confirm password field === */}
      <div className="space-y-1.5">
        <label htmlFor="confirmPassword" className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <Lock size={13} className="text-primary" />
          Confirm Password
        </label>
        <div className="relative">
          <input
            id="confirmPassword"
            type={showConfirm ? "text" : "password"}
            value={form.confirmPassword}
            onChange={e => updateField("confirmPassword", e.target.value)}
            placeholder="Re-enter your password"
            maxLength={128}
            autoComplete="new-password"
            aria-describedby={errors.confirmPassword ? "confirm-error" : undefined}
            aria-invalid={!!errors.confirmPassword}
            className={`input-cyber w-full rounded-lg px-4 py-2.5 pr-11 text-sm placeholder:text-muted-foreground ${
              errors.confirmPassword ? "border-[hsl(var(--destructive))]" : ""
            }`}
          />
          <button
            type="button"
            onClick={() => setShowConfirm(p => !p)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-primary"
            aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
          >
            {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
          </button>
        </div>
        {errors.confirmPassword && (
          <p id="confirm-error" role="alert" className="flex items-center gap-1.5 font-mono text-xs text-[hsl(var(--destructive))]">
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

      {/* === CAPTCHA === */}
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <CaptchaWidget
          value={form.captchaAnswer}
          onChange={val => {
            setForm(prev => ({ ...prev, captchaAnswer: val }));
            if (errors.captcha) setErrors(prev => ({ ...prev, captcha: undefined }));
          }}
          onChallengeChange={setCaptchaChallenge}
          error={errors.captcha}
        />
      </div>

      {/* === Submit button === */}
      <button
        type="submit"
        disabled={isLoading}
        className={`relative w-full overflow-hidden rounded-lg px-6 py-3 font-mono text-sm font-semibold tracking-wide transition-all duration-200
          bg-primary text-primary-foreground
          hover:opacity-90 hover:shadow-[var(--glow-primary)]
          active:scale-[0.98]
          disabled:cursor-not-allowed disabled:opacity-50
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
        `}
        aria-label="Submit registration form"
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={15} className="animate-spin" />
            Hashing & Registering...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <ShieldCheck size={15} />
            Register Securely
          </span>
        )}
      </button>

      <p className="text-center font-mono text-[10px] text-muted-foreground">
        🔒 Password is hashed with bcrypt (12 rounds) · Plaintext never stored
      </p>
    </form>
  );
}
