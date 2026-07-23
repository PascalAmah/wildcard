const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I for readability

function generateCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

/**
 * Generate a 4-character alphanumeric room code, checking for collisions
 * against existing codes via the provided callback.
 */
export async function generateRoomCode(
  isCollision: (code: string) => Promise<boolean>,
  maxAttempts = 10,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateCode();
    if (!(await isCollision(code))) {
      return code;
    }
  }
  // Extremely unlikely — fall back to a longer code
  const fallback = generateCode() + generateCode().slice(0, 2);
  return fallback;
}
