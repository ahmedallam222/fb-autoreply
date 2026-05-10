/**
 * Lightweight language detection for inbound text.
 *
 * For now we only need to distinguish Arabic from "everything else"
 * (treated as English) so we can hint the AI fallback to reply in the
 * matching language. A full ISO-639 detector would be overkill, slow,
 * and ironically less accurate for the casual mix of Arabic / English /
 * Arabizi we actually see in Egyptian customer comments.
 *
 * Heuristic:
 *   - Count code points in the Arabic Unicode blocks
 *     (U+0600..U+06FF, U+0750..U+077F, U+08A0..U+08FF, U+FB50..U+FDFF,
 *      U+FE70..U+FEFF).
 *   - Count "letter" code points overall (treat ASCII a-z + Arabic blocks
 *     as letters; ignore digits / punctuation / emoji).
 *   - If at least 30% of the letters are Arabic, classify as 'ar'.
 *     Otherwise 'en'.
 *
 * The 30% threshold is intentional: a sentence like "هل ده available؟"
 * should still come back as 'ar' because the customer is clearly Arabic-
 * speaking. Pure-English with a stray emoji should still be 'en'.
 */

export type DetectedLanguage = 'ar' | 'en';

const ARABIC_RANGES: Array<[number, number]> = [
  [0x0600, 0x06ff], // Arabic
  [0x0750, 0x077f], // Arabic Supplement
  [0x08a0, 0x08ff], // Arabic Extended-A
  [0xfb50, 0xfdff], // Arabic Presentation Forms-A
  [0xfe70, 0xfeff], // Arabic Presentation Forms-B
];

function isArabicCodePoint(cp: number): boolean {
  for (const [lo, hi] of ARABIC_RANGES) {
    if (cp >= lo && cp <= hi) return true;
  }
  return false;
}

function isLatinLetterCodePoint(cp: number): boolean {
  return (cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a);
}

/**
 * Returns 'ar' if at least 30% of the letter code points in `text` fall
 * inside an Arabic Unicode block; 'en' otherwise. Empty / whitespace-only
 * input returns 'en' as a default.
 */
export function detectLanguage(text: string | null | undefined): DetectedLanguage {
  if (!text) return 'en';

  let arabicLetters = 0;
  let totalLetters = 0;

  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (isArabicCodePoint(cp)) {
      arabicLetters += 1;
      totalLetters += 1;
    } else if (isLatinLetterCodePoint(cp)) {
      totalLetters += 1;
    }
    // Everything else (digits, punctuation, emoji, CJK, …) doesn't
    // contribute to either bucket.
  }

  if (totalLetters === 0) return 'en';
  return arabicLetters / totalLetters >= 0.3 ? 'ar' : 'en';
}

/**
 * Human-readable label for use in UI badges and AI prompt hints.
 */
export function languageDisplayName(lang: DetectedLanguage): string {
  return lang === 'ar' ? 'Arabic' : 'English';
}
