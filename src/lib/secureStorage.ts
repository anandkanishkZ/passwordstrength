/**
 * secureStorage.ts
 * =====================================================================
 * Simulated Secure User Storage Module
 * CET324 – Advanced CyberSecurity | University of Sunderland
 *
 * SECURITY RATIONALE:
 * - Passwords are NEVER stored in plaintext.
 * - bcrypt with salt rounds ≥ 12 is used (OWASP recommendation: 10–12).
 * - Only username + hashed password are stored.
 * - In-memory storage simulates a secure database backend.
 * - Production systems would use a hardened server-side database.
 * =====================================================================
 */

import bcrypt from "bcryptjs";

// --- Type definition for stored user records ---
interface UserRecord {
  username: string;
  passwordHash: string;    // bcrypt hash — NEVER the plaintext password
  createdAt: string;       // ISO timestamp for audit trail
  saltRounds: number;      // Stored for audit/documentation purposes
}

/**
 * SECURITY: In-memory user store.
 * In a production system, this would be a server-side PostgreSQL/MySQL
 * database with encrypted connections (TLS), parameterised queries,
 * and proper access controls.
 *
 * The Map is keyed by lowercase username to prevent duplicate accounts
 * with different capitalisation (case-insensitive uniqueness).
 */
const userStore = new Map<string, UserRecord>();

/**
 * SECURITY: Salt rounds for bcrypt.
 * Higher = more computationally expensive = harder to brute-force.
 * OWASP recommends ≥ 10; we use 12 as a balance between security and UX.
 * Each additional round doubles the computation time.
 */
const BCRYPT_SALT_ROUNDS = 12;

/**
 * Register a new user with a securely hashed password.
 *
 * SECURITY PROCESS:
 * 1. Check for duplicate username (case-insensitive)
 * 2. Hash password with bcrypt + auto-generated salt
 * 3. Store only the hash — NEVER the plaintext
 * 4. Return success without exposing internal data
 */
export async function registerUser(
  username: string,
  plainTextPassword: string
): Promise<{ success: boolean; message: string; hashPreview?: string }> {
  const normalizedUsername = username.toLowerCase().trim();

  // SECURITY: Check for existing username to prevent account duplication
  if (userStore.has(normalizedUsername)) {
    return {
      success: false,
      message: "Username already exists. Please choose a different username.",
    };
  }

  // SECURITY: Hash the password using bcrypt.
  // bcrypt.hash() automatically:
  //   1. Generates a cryptographically secure random salt
  //   2. Applies the salt to the password
  //   3. Performs the Blowfish-based hashing with BCRYPT_SALT_ROUNDS iterations
  // The resulting hash string embeds the salt (format: $2b$12$<salt><hash>)
  const passwordHash = await bcrypt.hash(plainTextPassword, BCRYPT_SALT_ROUNDS);

  // Store only the username and hash — plaintext is immediately discarded
  const userRecord: UserRecord = {
    username: normalizedUsername,
    passwordHash,
    createdAt: new Date().toISOString(),
    saltRounds: BCRYPT_SALT_ROUNDS,
  };

  userStore.set(normalizedUsername, userRecord);

  // SECURITY: Return a hash preview for educational demonstration ONLY.
  // In production, NEVER expose any part of the stored hash to the client.
  const hashPreview = `${passwordHash.substring(0, 29)}...` ;

  return {
    success: true,
    message: "User registered successfully.",
    hashPreview,
  };
}

/**
 * Check if a username is already registered.
 * SECURITY: Returns boolean only — no user data exposed.
 */
export function isUsernameTaken(username: string): boolean {
  return userStore.has(username.toLowerCase().trim());
}

/**
 * Get registered user count (for demonstration purposes).
 */
export function getUserCount(): number {
  return userStore.size;
}
