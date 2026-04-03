/**
 * Password strength meter — segmented bar + entropy + criteria checklist.
 */

import { StrengthResult } from "@/lib/passwordStrength";
import { CheckCircle2, XCircle, ShieldCheck, ShieldAlert } from "lucide-react";

interface PasswordStrengthMeterProps {
  result: StrengthResult | null;
  password: string;
}

const CRITERIA_LABELS: Record<string, string> = {
  minLength: "Minimum 12 characters",
  hasUppercase: "Uppercase letter (A–Z)",
  hasLowercase: "Lowercase letter (a–z)",
  hasNumber: "Number (0–9)",
  hasSpecial: "Special character (!@#$%...)",
  notCommon: "Not a commonly used password",
  notSimilarToUsername: "Not similar to username",
  noSequential: "No sequential patterns (12345, abcde)",
};

const STRENGTH_COLORS: Record<string, string> = {
  "Very Weak": "bg-[hsl(var(--strength-very-weak))]",
  Weak: "bg-[hsl(var(--strength-weak))]",
  Moderate: "bg-[hsl(var(--strength-moderate))]",
  Strong: "bg-[hsl(var(--strength-strong))]",
  "Very Strong": "bg-[hsl(var(--strength-very-strong))]",
};

const STRENGTH_TEXT_COLORS: Record<string, string> = {
  "Very Weak": "text-[hsl(var(--strength-very-weak))]",
  Weak: "text-[hsl(var(--strength-weak))]",
  Moderate: "text-[hsl(var(--strength-moderate))]",
  Strong: "text-[hsl(var(--strength-strong))]",
  "Very Strong": "text-[hsl(var(--strength-very-strong))]",
};

const STRENGTH_SCORE_MAP: Record<string, number> = {
  "Very Weak": 1,
  Weak: 2,
  Moderate: 3,
  Strong: 4,
  "Very Strong": 5,
};

const BAR_LABELS = ["Very weak", "Weak", "OK", "Strong", "Very strong"];

export function PasswordStrengthMeter({ result, password }: PasswordStrengthMeterProps) {
  if (!password) return null;
  if (!result) return null;

  const filledBars = STRENGTH_SCORE_MAP[result.level] ?? 0;
  const barColor = STRENGTH_COLORS[result.level] ?? "bg-muted";
  const textColor = STRENGTH_TEXT_COLORS[result.level] ?? "text-muted-foreground";
  const scorePercent = Math.min(100, Math.round((filledBars / 5) * 100));

  return (
    <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-300">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Password strength</p>
          <span className="text-xs tabular-nums text-muted-foreground">{scorePercent}/100</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          {result.level === "Very Strong" || result.level === "Strong" ? (
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          ) : (
            <ShieldAlert className={`h-4 w-4 shrink-0 ${textColor}`} aria-hidden />
          )}
          <span className={`min-w-0 flex-1 text-sm font-semibold ${textColor}`}>{result.level}</span>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">
            ~{Math.round(result.entropy)} bits
          </span>
        </div>

        {/* 5-segment meter (assignment: visual bars) */}
        <div className="flex gap-1.5" role="meter" aria-valuenow={scorePercent} aria-valuemin={0} aria-valuemax={100}>
          {[1, 2, 3, 4, 5].map((bar) => (
            <div key={bar} className="flex flex-1 flex-col gap-1">
              <div
                className={`h-2.5 rounded-md transition-all duration-300 sm:h-3 ${
                  bar <= filledBars ? barColor : "bg-muted"
                }`}
              />
              <span className="hidden text-center text-[9px] font-medium text-muted-foreground sm:block">
                {BAR_LABELS[bar - 1]}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground sm:hidden">
          Segments: {BAR_LABELS.slice(0, filledBars).join(" → ") || "—"}
        </p>
      </div>

      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Security criteria
        </p>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {Object.entries(CRITERIA_LABELS).map(([key, label]) => {
            const passed = result.criteria[key as keyof typeof result.criteria];
            return (
              <div key={key} className="flex items-center gap-2">
                {passed ? (
                  <CheckCircle2 size={12} className="shrink-0 text-[hsl(var(--strength-strong))]" />
                ) : (
                  <XCircle size={12} className="shrink-0 text-[hsl(var(--strength-very-weak))]" />
                )}
                <span
                  className={`text-[11px] ${
                    passed ? "text-[hsl(var(--strength-strong))]" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
