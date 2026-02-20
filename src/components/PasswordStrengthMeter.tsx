/**
 * PasswordStrengthMeter.tsx
 * =====================================================================
 * Real-time Password Strength Feedback Component
 * CET324 – Advanced CyberSecurity | University of Sunderland
 * =====================================================================
 */

import { StrengthResult } from "@/lib/passwordStrength";
import { CheckCircle2, XCircle, ShieldCheck, ShieldAlert } from "lucide-react";

interface PasswordStrengthMeterProps {
  result: StrengthResult | null;
  password: string;
}

const CRITERIA_LABELS: Record<string, string> = {
  minLength:              "Minimum 12 characters",
  hasUppercase:           "Uppercase letter (A–Z)",
  hasLowercase:           "Lowercase letter (a–z)",
  hasNumber:              "Number (0–9)",
  hasSpecial:             "Special character (!@#$%...)",
  notCommon:              "Not a commonly used password",
  notSimilarToUsername:   "Not similar to username",
  noSequential:           "No sequential patterns (12345, abcde)",
};

const STRENGTH_COLORS: Record<string, string> = {
  "Very Weak":   "bg-[hsl(var(--strength-very-weak))]",
  "Weak":        "bg-[hsl(var(--strength-weak))]",
  "Moderate":    "bg-[hsl(var(--strength-moderate))]",
  "Strong":      "bg-[hsl(var(--strength-strong))]",
  "Very Strong": "bg-[hsl(var(--strength-very-strong))]",
};

const STRENGTH_TEXT_COLORS: Record<string, string> = {
  "Very Weak":   "text-[hsl(var(--strength-very-weak))]",
  "Weak":        "text-[hsl(var(--strength-weak))]",
  "Moderate":    "text-[hsl(var(--strength-moderate))]",
  "Strong":      "text-[hsl(var(--strength-strong))]",
  "Very Strong": "text-[hsl(var(--strength-very-strong))]",
};

const STRENGTH_SCORE_MAP: Record<string, number> = {
  "Very Weak":   1,
  "Weak":        2,
  "Moderate":    3,
  "Strong":      4,
  "Very Strong": 5,
};

export function PasswordStrengthMeter({ result, password }: PasswordStrengthMeterProps) {
  if (!password) return null;
  if (!result) return null;

  const filledBars = STRENGTH_SCORE_MAP[result.level] ?? 0;
  const barColor = STRENGTH_COLORS[result.level] ?? "bg-muted";
  const textColor = STRENGTH_TEXT_COLORS[result.level] ?? "text-muted-foreground";

  return (
    <div className="mt-3 space-y-3 animate-in fade-in slide-in-from-top-1 duration-300">
      {/* Strength bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {result.level === "Very Strong" || result.level === "Strong" ? (
              <ShieldCheck size={13} className={textColor} />
            ) : (
              <ShieldAlert size={13} className={textColor} />
            )}
            <span className={`font-mono text-xs font-semibold ${textColor}`}>
              {result.level}
            </span>
          </div>
          <span className="font-mono text-xs text-muted-foreground">
            ~{Math.round(result.entropy)} bits entropy
          </span>
        </div>

        {/* 5-segment strength bar */}
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((bar) => (
            <div
              key={bar}
              className={`h-1.5 flex-1 rounded-full transition-all duration-400 ${
                bar <= filledBars ? barColor : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Criteria checklist */}
      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Security Criteria
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
                  className={`font-mono text-[11px] ${
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
