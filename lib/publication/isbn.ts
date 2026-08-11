/**
 * ISBN-13 discipline (Metadata blueprint §7): validation and
 * normalization only. The platform records externally governed
 * identifiers — nothing here (or anywhere) generates one, and invalid
 * identifiers fail closed rather than being silently corrected.
 */

export function normalizeIsbn13(input: string): string {
  return input.replace(/[^0-9]/g, "");
}

export function isbn13Valid(normalized: string): boolean {
  if (!/^97[89][0-9]{10}$/.test(normalized)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i += 1) {
    sum += Number(normalized[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === Number(normalized[12]);
}
