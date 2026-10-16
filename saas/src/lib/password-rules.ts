/**
 * Password rules, with no server dependencies, so the browser and the server
 * enforce the SAME rules from the SAME file. The browser copy is a courtesy;
 * the server runs these again on every attempt.
 *
 * Eight characters rather than Docchase's twelve: teachers type these on a
 * phone in a staff room. Length still beats character classes, and the
 * obvious choices are refused.
 */

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 200;

const OBVIOUS_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "passw0rd",
  "12345678",
  "123456789",
  "1234567890",
  "87654321",
  "11111111",
  "qwertyuiop",
  "qwerty123",
  "iloveyou",
  "welcome1",
  "welcome123",
  "admin123",
  "admin1234",
  "teacher1",
  "teacher123",
  "school123",
  "india123",
  "mdm12345",
  "midday123",
]);

/** The message to show, or null when the password is acceptable. */
export function passwordProblem(password: string, context: string[] = []): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Use at most ${MAX_PASSWORD_LENGTH} characters.`;
  const lower = password.toLowerCase();
  if (OBVIOUS_PASSWORDS.has(lower) || /^(.)\1+$/.test(password)) {
    return "That password is too easy to guess. Try a short phrase instead.";
  }
  for (const word of context) {
    const w = word.trim().toLowerCase();
    if (w.length >= 4 && lower.includes(w)) return "Don't use your name, email or school name in the password.";
  }
  return null;
}
