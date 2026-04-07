import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { sign, verify, decode, Secret, SignOptions } from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import speakeasy from "speakeasy";
import { randomBytes } from "crypto";
import { z } from "zod";

dotenv.config();

const {
  DATABASE_URL,
  JWT_SECRET = "secret",
  JWT_EXPIRES_IN = "15m",
  REFRESH_SECRET = "refresh_secret",
  REFRESH_EXPIRES_IN = "7d",
  RECAPTCHA_SECRET,
  // v3 scores on localhost are often below 0.5; raise in production via env (e.g. RECAPTCHA_MIN_SCORE=0.6).
  RECAPTCHA_MIN_SCORE = "0.3",
  RECAPTCHA_SKIP_VERIFY,
  TRUST_PROXY,
  FRONTEND_URL = "http://localhost:5173",
} = process.env;

const ALLOWED_ORIGINS = FRONTEND_URL.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const recaptchaMinScore = Math.min(1, Math.max(0, Number.parseFloat(RECAPTCHA_MIN_SCORE) || 0.5));

/** Lock account after this many consecutive wrong passwords (assignment demo: 3). */
const MAX_FAILED_LOGIN_ATTEMPTS = Math.max(1, Number.parseInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS || "3", 10) || 3);
/** Lockout length after max failures. */
const LOCKOUT_DURATION_MINUTES = Math.max(1, Number.parseInt(process.env.LOCKOUT_DURATION_MINUTES || "15", 10) || 15);
/** Recommend password change when older than this many days. */
const PASSWORD_MAX_AGE_DAYS = Math.max(1, Number.parseInt(process.env.PASSWORD_MAX_AGE_DAYS || "30", 10) || 30);

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required in .env");
}

const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function initSchema() {
  await pool.query(`
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT,
  password_hash TEXT NOT NULL,
  password_history JSONB NOT NULL DEFAULT '[]',
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret TEXT,
  reset_token TEXT,
  reset_token_expires TIMESTAMPTZ,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  lockout_until TIMESTAMPTZ,
  last_jwt_invalidated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_admin BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  token TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recovery_codes (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
  `);
}

/** Apply additive DB changes for existing databases (Neon, etc.). */
async function migrateUsersColumns() {
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
  `);
  await pool.query(`
    UPDATE users SET password_changed_at = COALESCE(password_changed_at, created_at, NOW())
    WHERE password_changed_at IS NULL;
  `);
  await pool.query(`
    ALTER TABLE users ALTER COLUMN password_changed_at SET DEFAULT NOW();
  `);
  try {
    await pool.query(`ALTER TABLE users ALTER COLUMN password_changed_at SET NOT NULL;`);
  } catch {
    /* already NOT NULL or empty table edge case */
  }

  // Add is_admin column
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;
  `);
}

const app = express();
if (TRUST_PROXY === "1" || TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}
app.use(helmet());
app.use(cookieParser());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
    exposedHeaders: ["Authorization"],
  })
);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

app.use(limiter);
app.use(express.json());

function minutesFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function generateJwt(user: { id: string; email: string; mfaEnabled: boolean}) {
  const options: SignOptions = { expiresIn: JWT_EXPIRES_IN as unknown as number | import("ms").StringValue };
  return sign({ sub: user.id, email: user.email, mfa: user.mfaEnabled }, JWT_SECRET as Secret, options);
}

function generateRefreshToken(userId: string) {
  const options: SignOptions = { expiresIn: REFRESH_EXPIRES_IN as unknown as number | import("ms").StringValue };
  const token = sign({ sub: userId }, REFRESH_SECRET as Secret, options);
  return token;
}

interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string; mfa: boolean };
}

async function ensureAuthenticated(req: AuthenticatedRequest, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.slice(7);
  let decoded: { sub: string; email: string; mfa: boolean; iat?: number };
  try {
    decoded = verify(token, JWT_SECRET as Secret) as typeof decoded;
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!decoded.sub) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userResult = await pool.query("SELECT last_jwt_invalidated_at FROM users WHERE id=$1", [decoded.sub]);
  if (userResult.rowCount === 0) return res.status(401).json({ error: "Unauthorized" });

  const lastInvalidatedAt = userResult.rows[0].last_jwt_invalidated_at;
  if (lastInvalidatedAt && decoded.iat && decoded.iat * 1000 < new Date(lastInvalidatedAt).getTime()) {
    return res.status(401).json({ error: "Token invalidated" });
  }

  req.user = { id: decoded.sub, email: decoded.email, mfa: decoded.mfa };
  next();
}

async function ensureAdmin(req: AuthenticatedRequest, res: Response, next: () => void) {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const userResult = await pool.query("SELECT is_admin FROM users WHERE id=$1", [req.user.id]);
  if (userResult.rowCount === 0 || !userResult.rows[0].is_admin) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

function setRefreshCookie(res: Response, refreshToken: string) {
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie("refreshToken", { path: "/api/auth" });
}

function sanitizePassword(password: string): void {
  if (password.length < 12) throw new Error("Password must be at least 12 characters");
  if (!/[A-Z]/.test(password)) throw new Error("Password must include an uppercase letter");
  if (!/[a-z]/.test(password)) throw new Error("Password must include a lowercase letter");
  if (!/[0-9]/.test(password)) throw new Error("Password must include a number");
  if (!/[!@#$%^&*()_+\-=[\]{};:\"\\|,.<>/?]/.test(password)) throw new Error("Password must include a special character");
}

interface RecaptchaVerifyPayload {
  success?: boolean;
  score?: number;
  action?: string;
  "error-codes"?: string[];
}

type CaptchaResult = { ok: true } | { ok: false; reason: string };

const X_FORWARDED_FOR = "x-forwarded-for";

/** Client IP for reCAPTCHA siteverify (optional; helps in some hosting setups). */
function clientIp(req: Request): string | undefined {
  const xff = req.headers[X_FORWARDED_FOR];
  if (typeof xff === "string" && xff.length) {
    return xff.split(",")[0]?.trim() || undefined;
  }
  if (Array.isArray(xff) && xff[0]) {
    return String(xff[0]).trim();
  }
  const raw = req.socket.remoteAddress;
  if (!raw) return undefined;
  if (raw === "::1") return "127.0.0.1";
  return raw.replace(/^::ffff:/, "");
}

/** Verifies Google reCAPTCHA v3 token (score + optional action name). */
async function verifyCaptcha(
  token: string,
  expectedAction: string,
  remoteip?: string | undefined
): Promise<CaptchaResult> {
  if (RECAPTCHA_SKIP_VERIFY === "1") {
    if (process.env.NODE_ENV === "production") {
      console.error("[reCAPTCHA] RECAPTCHA_SKIP_VERIFY is set but ignored when NODE_ENV=production");
    } else {
      console.warn(
        "[reCAPTCHA] verification SKIPPED (RECAPTCHA_SKIP_VERIFY=1). Remove for staging/production; never ship this enabled publicly."
      );
      return { ok: true };
    }
  }

  const secret = RECAPTCHA_SECRET?.trim();
  if (!secret || !token.trim()) {
    console.warn("[reCAPTCHA] missing secret or empty token");
    return { ok: false, reason: "missing server secret or empty token" };
  }

  const body = new URLSearchParams({ secret, response: token.trim() });
  if (remoteip) {
    body.set("remoteip", remoteip);
  }

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = (await response.json()) as RecaptchaVerifyPayload;

  let failReason = "";
  if (data.success !== true) {
    const codes = data["error-codes"] ?? [];
    if (codes.includes("browser-error")) {
      failReason =
        'Google returned "browser-error": the browser that obtained the token was flagged (privacy extensions, automation, or an unsupported environment). Try Chrome/Edge with extensions off, confirm your site domain is listed in the reCAPTCHA admin console, or for local dev only set RECAPTCHA_SKIP_VERIFY=1 with NODE_ENV not equal to production. Codes: ' +
        JSON.stringify(codes);
    } else {
      failReason = `Google rejected token: ${JSON.stringify(codes)}`;
    }
  } else if (typeof data.score !== "number" || Number.isNaN(data.score)) {
    failReason = "missing score (ensure keys are for reCAPTCHA v3, not v2)";
  } else if (data.score < recaptchaMinScore) {
    failReason = `score ${data.score.toFixed(2)} below minimum ${recaptchaMinScore} (try lowering RECAPTCHA_MIN_SCORE for local dev)`;
  } else if (
    data.action &&
    expectedAction &&
    data.action.toLowerCase() !== expectedAction.toLowerCase()
  ) {
    failReason = `action mismatch (got "${data.action}", expected "${expectedAction}")`;
  } else {
    return { ok: true };
  }

  console.warn("[reCAPTCHA] verification failed:", failReason, {
    score: data.score,
    action: data.action,
    errors: data["error-codes"],
  });

  return { ok: false, reason: failReason };
}

function sendCaptchaFailed(res: Response, captcha: Extract<CaptchaResult, { ok: false }>) {
  const verbose = process.env.NODE_ENV !== "production" || process.env.RECAPTCHA_VERBOSE_ERRORS === "1";
  res.status(400).json({
    error: verbose ? `CAPTCHA verification failed — ${captcha.reason}` : "CAPTCHA verification failed",
  });
}

function generateRecoveryCodes(count: number = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = randomBytes(4).toString("hex").toUpperCase();
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }
  return codes;
}

app.post("/api/auth/register", async (req: Request, res: Response) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string(),
    username: z.string().optional(),
    captchaToken: z.string().min(1, "reCAPTCHA token required"),
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });

  const { email, password, username, captchaToken } = parse.data;

  const captcha = await verifyCaptcha(captchaToken, "auth", clientIp(req));
  if (!captcha.ok) {
    sendCaptchaFailed(res, captcha);
    return;
  }

  try {
    sanitizePassword(password);
  } catch (err) {
    return res.status(400).json({ error: (err as Error).message });
  }

  const hashed = await bcrypt.hash(password, 12);

  const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if ((existing.rowCount ?? 0) > 0) {
    return res.status(409).json({ error: "Email already exists" });
  }

  const id = uuidv4();

  // Check if this is the first user, make them admin
  const userCount = await pool.query("SELECT COUNT(*) as count FROM users");
  const isFirstUser = parseInt(userCount.rows[0].count) === 0;

  await pool.query(
    "INSERT INTO users (id, email, username, password_hash, password_history, last_jwt_invalidated_at, password_changed_at, is_admin) VALUES ($1,$2,$3,$4,$5,$6, NOW(), $7)",
    [id, email, username || null, hashed, JSON.stringify([hashed]), new Date(), isFirstUser]
  );

  const token = generateJwt({ id, email, mfaEnabled: false });
  const refresh = generateRefreshToken(id);
  const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  await pool.query("INSERT INTO refresh_tokens(token,user_id,expires_at) VALUES($1,$2,$3)", [refresh, id, refreshExpiresAt]);

  setRefreshCookie(res, refresh);
  res.json({ token });
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string(),
    captchaToken: z.string().min(1, "reCAPTCHA token required"),
  });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });

  const { email, password, captchaToken } = parse.data;

  const captcha = await verifyCaptcha(captchaToken, "auth", clientIp(req));
  if (!captcha.ok) {
    sendCaptchaFailed(res, captcha);
    return;
  }

  const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  if (result.rowCount === 0) return res.status(401).json({ error: "Invalid credentials" });

  const user = result.rows[0];
  if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
    return res.status(423).json({
      error: `Account locked after ${MAX_FAILED_LOGIN_ATTEMPTS} failed sign-in attempts. Try again after the lockout period (about ${LOCKOUT_DURATION_MINUTES} minutes), or contact support.`,
    });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    const failedCount = (user.failed_login_attempts || 0) + 1;
    const lockoutUntil =
      failedCount >= MAX_FAILED_LOGIN_ATTEMPTS ? minutesFromNow(LOCKOUT_DURATION_MINUTES) : null;
    await pool.query("UPDATE users SET failed_login_attempts=$1, lockout_until=$2 WHERE id=$3", [
      failedCount,
      lockoutUntil,
      user.id,
    ]);
    if (lockoutUntil) {
      return res.status(423).json({
        error: `Too many failed attempts. This account is locked for about ${LOCKOUT_DURATION_MINUTES} minutes.`,
      });
    }
    const remaining = MAX_FAILED_LOGIN_ATTEMPTS - failedCount;
    return res.status(401).json({
      error: `Invalid credentials. ${remaining} attempt(s) remaining before lockout.`,
    });
  }

  await pool.query("UPDATE users SET failed_login_attempts=0, lockout_until=NULL WHERE id=$1", [user.id]);

  const mfaEnabled = user.mfa_enabled ?? false;
  if (mfaEnabled) {
    return res.json({ mfa_required: true, userId: user.id });
  }

  const token = generateJwt({ id: user.id, email: user.email, mfaEnabled });
  const refresh = generateRefreshToken(user.id);
  const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  await pool.query("INSERT INTO refresh_tokens(token,user_id,expires_at) VALUES($1,$2,$3)", [refresh, user.id, refreshExpiresAt]);

  setRefreshCookie(res, refresh);
  res.json({ token });
});

app.post("/api/auth/mfa/verify", async (req: Request, res: Response) => {
  const schema = z.object({ userId: z.string().uuid(), token: z.string().length(6) });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });

  const { userId, token } = parse.data;
  const result = await pool.query("SELECT mfa_secret FROM users WHERE id = $1", [userId]);
  if (result.rowCount === 0) return res.status(404).json({ error: "User not found" });

  const mfaSecret = result.rows[0].mfa_secret;
  if (!mfaSecret) return res.status(400).json({ error: "MFA not configured" });

  const verified = speakeasy.totp.verify({ secret: mfaSecret, encoding: "base32", token, window: 1 });
  if (!verified) return res.status(401).json({ error: "Invalid MFA token" });

  const user = await pool.query("SELECT id,email,mfa_enabled FROM users WHERE id=$1", [userId]);
  const jwtToken = generateJwt({ id: userId, email: user.rows[0].email, mfaEnabled: true });
  const refresh = generateRefreshToken(userId);
  const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
  await pool.query("INSERT INTO refresh_tokens(token,user_id,expires_at) VALUES($1,$2,$3)", [refresh, userId, refreshExpiresAt]);

  setRefreshCookie(res, refresh);
  res.json({ token: jwtToken });
});

app.post("/api/auth/mfa/setup/request", ensureAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  const schema = z.object({ userId: z.string().uuid() });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });

  const { userId } = parse.data;
  if (req.user?.id !== userId) return res.status(403).json({ error: "Forbidden" });

  const secret = speakeasy.generateSecret({
    name: "Password-App",
    issuer: "Password-App",
  }).base32;

  const user = await pool.query("SELECT email FROM users WHERE id=$1", [userId]);
  if (user.rowCount === 0) return res.status(404).json({ error: "User not found" });

  res.json({ secret, email: user.rows[0].email });
});

app.post("/api/auth/mfa/setup/verify", ensureAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  const schema = z.object({ userId: z.string().uuid(), secret: z.string(), token: z.string().length(6) });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });

  const { userId, secret, token } = parse.data;
  if (req.user?.id !== userId) return res.status(403).json({ error: "Forbidden" });

  const verified = speakeasy.totp.verify({ secret, encoding: "base32", token, window: 1 });
  if (!verified) return res.status(401).json({ error: "Invalid TOTP code" });

  const recoveryCodes = generateRecoveryCodes(10);
  const hashedCodes = await Promise.all(recoveryCodes.map((code) => bcrypt.hash(code, 10)));

  await pool.query(
    "UPDATE users SET mfa_enabled=true, mfa_secret=$1 WHERE id=$2",
    [secret, userId]
  );

  await pool.query(
    "DELETE FROM recovery_codes WHERE user_id=$1",
    [userId]
  );

  for (const code of hashedCodes) {
    await pool.query("INSERT INTO recovery_codes(user_id,code,created_at) VALUES($1,$2,now())", [userId, code]);
  }

  res.json({ message: "MFA enabled", recoveryCodes });
});

app.post("/api/auth/request-password-reset", async (req: Request, res: Response) => {
  const schema = z.object({ email: z.string().email() });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });

  const { email } = parse.data;
  const result = await pool.query("SELECT id FROM users WHERE email = $1", [email]);

  if (result.rowCount === 1) {
    const token = uuidv4();
    const expires = new Date(Date.now() + 1000 * 60 * 20); // 20 min
    await pool.query("UPDATE users SET reset_token=$1, reset_token_expires=$2 WHERE email=$3", [token, expires, email]);
    // Send email using your email service (omitted)
    console.log(`Password reset token for ${email}: ${token}`);
  }

  return res.json({ message: "If the email exists, password reset instructions were sent" });
});

app.post("/api/auth/confirm-password-reset", async (req: Request, res: Response) => {
  const schema = z.object({ token: z.string(), password: z.string() });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });

  const { token, password } = parse.data;
  const result = await pool.query("SELECT id,password_history FROM users WHERE reset_token=$1 AND reset_token_expires > now()", [token]);
  if (result.rowCount === 0) return res.status(400).json({ error: "Invalid or expired token" });

  const user = result.rows[0];
  try { sanitizePassword(password); } catch (err) { return res.status(400).json({ error: (err as Error).message }); }

  const newHash = await bcrypt.hash(password, 12);

  const history = Array.isArray(user.password_history) ? user.password_history : [];
  const reuse: boolean[] = await Promise.all(history.map(async (h: string): Promise<boolean> => bcrypt.compare(password, h)));
  if (reuse.some(Boolean)) {
    return res.status(400).json({ error: "Cannot reuse a recent password" });
  }

  const nextHistory = [...history.slice(-4), newHash];
  await pool.query(
    "UPDATE users SET password_hash=$1, password_history=$2, reset_token=NULL, reset_token_expires=NULL, last_jwt_invalidated_at=now(), password_changed_at=now(), updated_at=now() WHERE id=$3",
    [newHash, JSON.stringify(nextHistory), user.id]
  );

  res.json({ message: "Password reset successful" });
});

app.post("/api/auth/change-password", ensureAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  const schema = z.object({ currentPassword: z.string(), newPassword: z.string() });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });

  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { currentPassword, newPassword } = parse.data;
  const result = await pool.query(
    "SELECT password_hash, password_history, email, mfa_enabled FROM users WHERE id=$1",
    [userId]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: "User not found" });

  const user = result.rows[0];
  const good = await bcrypt.compare(currentPassword, user.password_hash);
  if (!good) return res.status(401).json({ error: "Current password invalid" });

  try { sanitizePassword(newPassword); } catch (err) { return res.status(400).json({ error: (err as Error).message }); }

  const newHash = await bcrypt.hash(newPassword, 12);
  const history = Array.isArray(user.password_history) ? user.password_history : [];
  const reuse = await Promise.all(history.map(async (h: string) => bcrypt.compare(newPassword, h)));
  if (reuse.some(Boolean)) {
    return res.status(400).json({ error: "Cannot reuse a recent password" });
  }

  const newAccessToken = generateJwt({
    id: userId,
    email: user.email,
    mfaEnabled: Boolean(user.mfa_enabled),
  });
  const payload = decode(newAccessToken) as { iat?: number };
  const iatSec = payload?.iat;
  if (typeof iatSec !== "number") {
    return res.status(500).json({ error: "Could not issue session token" });
  }
  const invalidationCutoff = new Date(iatSec * 1000);

  const newHistory = [...history.slice(-4), newHash];
  await pool.query(
    "UPDATE users SET password_hash=$1, password_history=$2, last_jwt_invalidated_at=$3, password_changed_at=now(), updated_at=now() WHERE id=$4",
    [newHash, JSON.stringify(newHistory), invalidationCutoff, userId]
  );

  res.json({ message: "Password changed successfully", token: newAccessToken });
});

app.post("/api/auth/refresh-token", async (req: Request, res: Response) => {
  const refreshTokenFromCookie = req.cookies?.refreshToken;
  const payload = z.object({ refreshToken: z.string().optional() }).safeParse(req.body);
  const refreshToken = (payload.success && payload.data.refreshToken) || refreshTokenFromCookie;

  if (!refreshToken) return res.status(400).json({ error: "Refresh token missing" });

  try {
    const { sub } = verify(refreshToken, REFRESH_SECRET as Secret) as { sub: string };
    const tokenRow = await pool.query("SELECT user_id, expires_at FROM refresh_tokens WHERE token=$1", [refreshToken]);
    if (tokenRow.rowCount === 0) throw new Error("Not found");

    if (new Date(tokenRow.rows[0].expires_at) < new Date()) {
      await pool.query("DELETE FROM refresh_tokens WHERE token=$1", [refreshToken]);
      clearRefreshCookie(res);
      return res.status(401).json({ error: "Refresh token expired" });
    }

    const userRecord = await pool.query("SELECT id,email,mfa_enabled,last_jwt_invalidated_at FROM users WHERE id=$1", [sub]);
    if (userRecord.rowCount === 0) throw new Error("Unauthorized");
    const user = userRecord.rows[0];

    const accessToken = generateJwt({ id: user.id, email: user.email, mfaEnabled: user.mfa_enabled });
    const newRefresh = generateRefreshToken(user.id);
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

    await pool.query("DELETE FROM refresh_tokens WHERE token=$1", [refreshToken]);
    await pool.query("INSERT INTO refresh_tokens(token,user_id,expires_at) VALUES($1,$2,$3)", [newRefresh, user.id, refreshExpiresAt]);

    setRefreshCookie(res, newRefresh);
    res.json({ token: accessToken });
  } catch (error) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: "Invalid refresh token" });
  }
});

app.post("/api/auth/logout", async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  if (refreshToken) {
    await pool.query("DELETE FROM refresh_tokens WHERE token=$1", [refreshToken]);
    clearRefreshCookie(res);
  }

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const decoded = verify(authHeader.slice(7), JWT_SECRET as Secret) as { sub: string };
      await pool.query("UPDATE users SET last_jwt_invalidated_at=now() WHERE id=$1", [decoded.sub]);
    } catch {
      // ignore
    }
  }

  res.json({ message: "Logged out" });
});

app.get("/api/auth/me", ensureAuthenticated, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const user = await pool.query(
    "SELECT id,email,username,mfa_enabled,password_changed_at,failed_login_attempts,lockout_until,is_admin FROM users WHERE id=$1",
    [req.user.id]
  );
  if (user.rowCount === 0) return res.status(404).json({ error: "User not found" });
  const row = user.rows[0];
  const changedAt = row.password_changed_at ? new Date(row.password_changed_at) : new Date();
  const passwordAgeDays = Math.max(0, Math.floor((Date.now() - changedAt.getTime()) / 86400000));
  const passwordRotationRecommended = passwordAgeDays >= PASSWORD_MAX_AGE_DAYS;
  const daysUntilPasswordRotationSuggested = Math.max(0, PASSWORD_MAX_AGE_DAYS - passwordAgeDays);

  return res.json({
    user: {
      id: row.id,
      email: row.email,
      username: row.username,
      mfa_enabled: row.mfa_enabled,
      is_admin: row.is_admin,
      password_changed_at: row.password_changed_at,
      password_age_days: passwordAgeDays,
      password_max_age_days: PASSWORD_MAX_AGE_DAYS,
      password_rotation_recommended: passwordRotationRecommended,
      days_until_password_rotation_suggested: daysUntilPasswordRotationSuggested,
    },
    security_policy: {
      max_failed_login_attempts: MAX_FAILED_LOGIN_ATTEMPTS,
      lockout_minutes: LOCKOUT_DURATION_MINUTES,
    },
  });
});

app.get("/api/admin/users", ensureAuthenticated, ensureAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const users = await pool.query(
    "SELECT id,email,username,mfa_enabled,created_at,updated_at,is_admin FROM users ORDER BY created_at DESC"
  );
  res.json({ users: users.rows });
});

app.listen(4000, async () => {
  await initSchema();
  await migrateUsersColumns();
  console.log("Auth service running on http://localhost:4000");
});
