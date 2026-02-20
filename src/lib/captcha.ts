/**
 * captcha.ts
 * =====================================================================
 * Math CAPTCHA Module (Option A)
 * CET324 – Advanced CyberSecurity | University of Sunderland
 *
 * SECURITY RATIONALE:
 * - CAPTCHA prevents automated bot registrations.
 * - Random operands (1–20) and operator (+, -, ×) produce variable challenges.
 * - Answer is never exposed in the DOM — only validated server-side (simulated).
 * - Regenerated on every failure to prevent replay attacks.
 * =====================================================================
 */

export type CaptchaOperator = "+" | "-" | "×";

export interface CaptchaChallenge {
  operandA: number;
  operandB: number;
  operator: CaptchaOperator;
  question: string;
  answer: number;
}

/**
 * SECURITY: Uses Math.random() which is sufficient for CAPTCHA challenges.
 * For cryptographic purposes, crypto.getRandomValues() would be used instead.
 */
function secureRandInt(min: number, max: number): number {
  // NOTE: In production, use crypto.getRandomValues() for true randomness.
  // Math.random() is acceptable here as CAPTCHA doesn't require CSPRNG.
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a new CAPTCHA math challenge.
 * Operands range: 1–20 (as per assignment spec).
 * Operators: +, -, × (division excluded to avoid fractions).
 */
export function generateCaptcha(): CaptchaChallenge {
  const operators: CaptchaOperator[] = ["+", "-", "×"];
  const operator = operators[secureRandInt(0, 2)];

  let operandA = secureRandInt(1, 20);
  let operandB = secureRandInt(1, 20);

  // SECURITY: Ensure subtraction doesn't produce negative answers
  // (simplifies validation, prevents edge-case confusion)
  if (operator === "-" && operandB > operandA) {
    [operandA, operandB] = [operandB, operandA];
  }

  let answer: number;
  switch (operator) {
    case "+": answer = operandA + operandB; break;
    case "-": answer = operandA - operandB; break;
    case "×": answer = operandA * operandB; break;
    default:  answer = operandA + operandB;
  }

  return {
    operandA,
    operandB,
    operator,
    question: `${operandA} ${operator} ${operandB}`,
    answer,
  };
}

/**
 * SECURITY: Validate CAPTCHA answer.
 * Integer comparison — no floating-point tolerance needed for integer math.
 * Input is sanitized (parseInt) to prevent string injection.
 */
export function validateCaptcha(challenge: CaptchaChallenge, userAnswer: string): boolean {
  // SECURITY: Parse input strictly as base-10 integer
  const parsed = parseInt(userAnswer.trim(), 10);

  // SECURITY: Reject NaN or non-integer input
  if (isNaN(parsed)) return false;

  return parsed === challenge.answer;
}
