/**
 * inputValidation.ts
 * =====================================================================
 * Input Validation & Sanitisation Module
 * CET324 – Advanced CyberSecurity | University of Sunderland
 *
 * SECURITY RATIONALE:
 * - Never trust user input — validate and sanitise before processing.
 * - Prevent injection attacks (XSS, SQL injection simulation).
 * - Enforce length limits to prevent buffer overflow simulation.
 * - Whitelist approach: define what IS allowed, reject everything else.
 * =====================================================================
 */

// --- Injection pattern detection ---
// SECURITY: Detect common injection patterns even in frontend context.
// In production, server-side validation is the primary defence.
const INJECTION_PATTERNS: RegExp[] = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // XSS script tags
  /javascript:/gi,                                          // JS protocol injection
  /on\w+\s*=/gi,                                           // HTML event handlers
  /['";].*?--/,                                             // SQL comment injection
  /union.*?select/gi,                                       // SQL UNION attack
  /drop\s+table/gi,                                         // SQL DROP injection
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * SECURITY: Strip potentially dangerous characters from input.
 * Removes HTML tags and trims whitespace.
 * NOTE: This is defence-in-depth. Server-side sanitisation is primary.
 */
export function sanitiseInput(input: string): string {
  return input
    .trim()
    .replace(/<[^>]*>/g, "")           // Strip HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ""); // Strip control characters
}

/**
 * SECURITY: Check for injection patterns in input.
 * Returns true if any suspicious pattern is detected.
 */
function containsInjection(input: string): boolean {
  return INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Validate username input.
 * SECURITY RULES:
 * - Alphanumeric + underscores only (whitelist approach)
 * - 3–30 characters (prevents enumeration via timing on very short names)
 * - No injection patterns
 */
export function validateUsername(username: string): ValidationResult {
  const sanitised = sanitiseInput(username);

  if (!sanitised) {
    return { valid: false, error: "Username is required." };
  }

  if (containsInjection(sanitised)) {
    return { valid: false, error: "Username contains invalid characters." };
  }

  if (sanitised.length < 3) {
    return { valid: false, error: "Username must be at least 3 characters." };
  }

  if (sanitised.length > 30) {
    return { valid: false, error: "Username must not exceed 30 characters." };
  }

  // Whitelist: only alphanumeric and underscores allowed
  if (!/^[a-zA-Z0-9_]+$/.test(sanitised)) {
    return { valid: false, error: "Username may only contain letters, numbers, and underscores." };
  }

  // SECURITY: Username must not start with a number (prevents numeric enumeration)
  if (/^[0-9]/.test(sanitised)) {
    return { valid: false, error: "Username must start with a letter." };
  }

  return { valid: true };
}

/**
 * Validate password input.
 * SECURITY RULES:
 * - Minimum 12 characters (NIST SP 800-63B)
 * - Maximum 128 characters (prevents DoS via long bcrypt hash)
 * - Must not contain injection patterns
 */
export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { valid: false, error: "Password is required." };
  }

  if (containsInjection(password)) {
    return { valid: false, error: "Password contains invalid content." };
  }

  if (password.length < 12) {
    return { valid: false, error: "Password must be at least 12 characters." };
  }

  // SECURITY: Bcrypt has a 72-character effective limit; cap at 128 for safety
  if (password.length > 128) {
    return { valid: false, error: "Password must not exceed 128 characters." };
  }

  return { valid: true };
}

/**
 * Validate password confirmation.
 */
export function validatePasswordMatch(password: string, confirmPassword: string): ValidationResult {
  if (!confirmPassword) {
    return { valid: false, error: "Please confirm your password." };
  }

  // SECURITY: Use constant-time comparison simulation
  // (true constant-time comparison is server-side; this is UI feedback only)
  if (password !== confirmPassword) {
    return { valid: false, error: "Passwords do not match." };
  }

  return { valid: true };
}
