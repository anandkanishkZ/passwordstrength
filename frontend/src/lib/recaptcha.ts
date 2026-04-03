/**
 * Google reCAPTCHA v3 — invisible score-based verification.
 * https://developers.google.com/recaptcha/docs/v3
 */

declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const SITE_KEY = (import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined)?.trim() ?? "";

export function isRecaptchaConfigured(): boolean {
  return SITE_KEY.length > 0;
}

let scriptLoadPromise: Promise<void> | null = null;

function waitForGrecaptcha(maxMs: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (window.grecaptcha?.execute) {
        resolve();
        return;
      }
      if (Date.now() - start > maxMs) {
        reject(new Error("reCAPTCHA failed to initialise"));
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

function loadRecaptchaScript(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("reCAPTCHA can only run in the browser"));
  }
  if (window.grecaptcha?.execute) {
    return Promise.resolve();
  }
  if (!SITE_KEY) {
    return Promise.reject(new Error("VITE_RECAPTCHA_SITE_KEY is not set"));
  }
  if (scriptLoadPromise) return scriptLoadPromise;

  const already = document.querySelector<HTMLScriptElement>('script[src*="google.com/recaptcha/api.js"]');
  if (already) {
    scriptLoadPromise = waitForGrecaptcha(20_000);
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(SITE_KEY)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      waitForGrecaptcha(20_000).then(resolve).catch(reject);
    };
    script.onerror = () => {
      scriptLoadPromise = null;
      reject(new Error("Failed to load reCAPTCHA script"));
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

/**
 * Runs reCAPTCHA v3 and returns a token for your backend (verify with the secret key).
 * Use the same action name server-side when verifying the token (e.g. "register", "login").
 */
export async function executeRecaptcha(action: string): Promise<string> {
  await loadRecaptchaScript();
  const client = window.grecaptcha;
  if (!client?.execute) {
    throw new Error("reCAPTCHA is not available");
  }
  return new Promise((resolve, reject) => {
    client.ready(() => {
      client
        .execute(SITE_KEY, { action })
        .then(resolve)
        .catch(reject);
    });
  });
}
