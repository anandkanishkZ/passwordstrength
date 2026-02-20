/**
 * CaptchaWidget.tsx
 * =====================================================================
 * Math CAPTCHA UI Component
 * CET324 – Advanced CyberSecurity | University of Sunderland
 *
 * SECURITY: The correct answer is stored only in component state
 * and never rendered to the DOM. Validation occurs on form submit.
 * =====================================================================
 */

import { useState, useEffect } from "react";
import { RefreshCw, ShieldQuestion } from "lucide-react";
import { generateCaptcha, CaptchaChallenge } from "@/lib/captcha";

interface CaptchaWidgetProps {
  value: string;
  onChange: (value: string) => void;
  onChallengeChange: (challenge: CaptchaChallenge) => void;
  error?: string;
}

export function CaptchaWidget({ value, onChange, onChallengeChange, error }: CaptchaWidgetProps) {
  const [challenge, setChallenge] = useState<CaptchaChallenge>(() => generateCaptcha());

  // Notify parent of initial challenge
  useEffect(() => {
    onChallengeChange(challenge);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge]);

  const refreshCaptcha = () => {
    const newChallenge = generateCaptcha();
    setChallenge(newChallenge);
    onChallengeChange(newChallenge);
    onChange(""); // Clear user input on refresh
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <ShieldQuestion size={13} className="text-primary" />
        CAPTCHA Verification
      </label>

      <div className="flex items-center gap-3">
        {/* CAPTCHA challenge display */}
        <div className="flex min-w-[130px] items-center justify-center rounded-lg border border-border bg-muted/60 px-4 py-3 select-none">
          {/* SECURITY: Challenge rendered as text — not as an attribute that could be scraped */}
          <span className="font-mono text-xl font-bold tracking-widest text-primary">
            {challenge.question} = ?
          </span>
        </div>

        {/* Refresh button — regenerates challenge on failure */}
        <button
          type="button"
          onClick={refreshCaptcha}
          className="group flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground transition-all hover:border-primary hover:text-primary"
          title="Generate new CAPTCHA"
          aria-label="Refresh CAPTCHA challenge"
        >
          <RefreshCw
            size={13}
            className="transition-transform group-hover:rotate-180 duration-300"
          />
          <span className="font-mono">New</span>
        </button>
      </div>

      {/* User answer input */}
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9-]*"
        value={value}
        onChange={(e) => {
          // SECURITY: Only allow numeric input (including negative for subtraction results)
          const sanitised = e.target.value.replace(/[^0-9-]/g, "");
          onChange(sanitised);
        }}
        placeholder="Enter your answer"
        maxLength={5}
        className={`input-cyber w-full rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground ${
          error ? "border-[hsl(var(--destructive))]" : ""
        }`}
        aria-label="CAPTCHA answer"
        autoComplete="off"
      />

      {error && (
        <p className="font-mono text-xs text-[hsl(var(--destructive))]">{error}</p>
      )}
    </div>
  );
}
