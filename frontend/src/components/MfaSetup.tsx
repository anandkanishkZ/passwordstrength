import { useState, useEffect, useRef } from "react";
import { Copy, CheckCircle, AlertCircle } from "lucide-react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { API_BASE, authHeadersJson } from "@/lib/api";

interface MfaSetupProps {
  userId: string;
  onComplete: (recoveryCodes: string[]) => void;
  onCancel: () => void;
}

export function MfaSetup({ userId, onComplete, onCancel }: MfaSetupProps) {
  const [secret, setSecret] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"qr" | "verify" | "complete">("qr");
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMfaSecret();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only MFA secret fetch
  }, []);

  async function fetchMfaSecret() {
    try {
      const res = await fetch(`${API_BASE}/api/auth/mfa/setup/request`, {
        method: "POST",
        credentials: "include",
        headers: authHeadersJson(),
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSecret(data.secret);

      const otpauthUrl = `otpauth://totp/Password-App:${data.email}?secret=${data.secret}&issuer=Password-App`;
      const qr = await QRCode.toDataURL(otpauthUrl);
      setQrCode(qr);
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Could not start MFA setup." });
    }
  }

  async function verifySetup() {
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/mfa/setup/verify`, {
        method: "POST",
        credentials: "include",
        headers: authHeadersJson(),
        body: JSON.stringify({ userId, secret, token: verifyCode }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setRecoveryCodes(data.recoveryCodes);
      setStep("complete");
      setMessage({ type: "success", text: "Two-factor authentication is now enabled." });
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Verification failed." });
    } finally {
      setLoading(false);
    }
  }

  function copyRecoveryCodes() {
    navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Set up authenticator</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Use Google Authenticator, Microsoft Authenticator, Authy, or another TOTP app.
        </p>
      </div>

      {message && (
        <div
          role="status"
          className={cn(
            "flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-sm",
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-800",
          )}
        >
          {message.type === "success" ? (
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {step === "qr" && (
        <>
          {qrCode && (
            <div
              ref={qrRef}
              className="mx-auto w-fit rounded-lg border border-border bg-white p-4 shadow-sm"
              dangerouslySetInnerHTML={{
                __html: `<img src="${qrCode}" alt="Scan to add account to authenticator" class="w-44 h-44 sm:w-48 sm:h-48" />`,
              }}
            />
          )}
          <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-center font-mono text-xs text-muted-foreground break-all">
            {secret}
          </div>
          <p className="text-xs text-muted-foreground">
            If you cannot scan the code, enter this secret manually in your app. Store it only if your organisation
            requires key escrow.
          </p>
          <Button type="button" className="w-full" onClick={() => setStep("verify")}>
            Continue to verification
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={onCancel}>
            Cancel
          </Button>
        </>
      )}

      {step === "verify" && (
        <>
          <p className="text-sm text-muted-foreground">Enter the 6-digit code from your authenticator.</p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            className="input-enterprise text-center font-mono text-2xl tracking-[0.35em]"
          />
          <Button
            type="button"
            className="w-full"
            onClick={verifySetup}
            disabled={verifyCode.length < 6 || loading}
          >
            {loading ? "Verifying…" : "Verify and enable"}
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={() => setStep("qr")}>
            Back
          </Button>
        </>
      )}

      {step === "complete" && (
        <>
          <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
            <p className="font-semibold text-emerald-900">Save your recovery codes</p>
            <p className="text-emerald-800">
              Each code works once if you lose your phone. Store them in a password manager or other secure location.
            </p>
            <div className="max-h-36 overflow-y-auto rounded-md border border-border bg-card p-3 font-mono text-xs text-foreground">
              {recoveryCodes.map((code, i) => (
                <div key={i}>{code}</div>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              className="w-full border border-emerald-300 bg-emerald-100 text-emerald-950 hover:bg-emerald-200"
              onClick={copyRecoveryCodes}
            >
              <Copy className="h-4 w-4" aria-hidden />
              {copied ? "Copied" : "Copy recovery codes"}
            </Button>
          </div>
          <Button type="button" className="w-full" onClick={() => onComplete(recoveryCodes)}>
            Done
          </Button>
        </>
      )}
    </div>
  );
}
