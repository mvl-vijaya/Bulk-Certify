/**
 * Bulk Certify - File & String Sanitizer Utility
 * Ensures secure path handling, clean filenames, and safe data processing.
 */

/**
 * Sanitizes a student name or identifier for safe filesystem usage.
 * Removes illegal characters across Windows, Linux, and macOS.
 *
 * @param {string} rawName - The student or recipient name
 * @param {string} [fallback='certificate'] - Fallback name if input is empty/invalid
 * @returns {string} - Clean, filesystem-safe filename string
 */
export function sanitizeFilename(rawName, fallback = 'certificate') {
  if (!rawName || typeof rawName !== 'string') {
    return fallback;
  }

  // 1. Remove control characters (ASCII 0-31 and 127)
  let clean = rawName.replace(/[\x00-\x1F\x7F]/g, '');

  // 2. Remove illegal characters across Windows/Unix: / \ ? % * : | " < >
  clean = clean.replace(/[/\\?%*:|"<>]/g, '_');

  // 3. Remove consecutive spaces or underscores
  clean = clean.replace(/\s+/g, ' ').replace(/_+/g, '_');

  // 4. Trim leading/trailing whitespace, dots, and dashes
  clean = clean.trim().replace(/^[\.\-_]+|[\.\-_]+$/g, '');

  // 5. Truncate to reasonable filename length (120 chars) to prevent path length errors
  if (clean.length > 120) {
    clean = clean.substring(0, 120).trim();
  }

  return clean || fallback;
}

/**
 * Normalizes hex or color string to RGB object { r, g, b } (0 to 1 scale for pdf-lib).
 *
 * @param {string} hexColor - e.g. "#1e3a8a" or "#000"
 * @returns {{ r: number, g: number, b: number }}
 */
export function hexToRgb01(hexColor = '#000000') {
  let hex = (hexColor || '#000000').replace('#', '').trim();
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length !== 6) {
    hex = '000000';
  }
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  return {
    r: isNaN(r) ? 0 : r,
    g: isNaN(g) ? 0 : g,
    b: isNaN(b) ? 0 : b
  };
}

