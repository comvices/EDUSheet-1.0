// Security & Sanitization Helpers for EduSheet TH

let inMemoryApiToken: string | null = null;

export function setApiSessionToken(token: string | null): void {
  inMemoryApiToken = token && token.trim().length > 0 ? token.trim() : null;
}

export function getApiSessionToken(): string | null {
  return inMemoryApiToken;
}

export function clearApiSessionToken(): void {
  inMemoryApiToken = null;
}

export function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...extraHeaders,
  };
  if (inMemoryApiToken) {
    headers['Authorization'] = `Bearer ${inMemoryApiToken}`;
  }
  return headers;
}

/**
 * Validates and sanitizes user-provided URLs to block XSS vectors like javascript:, data:text/html, vbscript:
 * Only http:// and https:// URLs are permitted.
 */
export function sanitizeHttpUrl(rawUrl: string | undefined | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

export function isSafeHttpUrl(rawUrl: string | undefined | null): boolean {
  return sanitizeHttpUrl(rawUrl) !== null;
}

const SAFE_RASTER_DATA_URL_RE = /^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/;

/**
 * Validates preview image sources: allows safe http(s) URLs or compact raster base64 data URLs
 * (jpeg, jpg, png, webp, gif). Explicitly blocks SVG and executable schemes to prevent XSS.
 */
export function sanitizeImageSrc(rawUrl: string | undefined | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  const httpUrl = sanitizeHttpUrl(trimmed);
  if (httpUrl) return httpUrl;

  if (trimmed.length <= 350000 && SAFE_RASTER_DATA_URL_RE.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function isSafeImageSrc(rawUrl: string | undefined | null): boolean {
  return sanitizeImageSrc(rawUrl) !== null;
}

/**
 * Constant-time string comparison to reduce timing side-channel discrepancies during credential verification.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const strA = String(a ?? '');
  const strB = String(b ?? '');
  const maxLen = Math.max(strA.length, strB.length);
  let mismatch = strA.length ^ strB.length;

  for (let i = 0; i < maxLen; i++) {
    const charA = i < strA.length ? strA.charCodeAt(i) : 0;
    const charB = i < strB.length ? strB.charCodeAt(i) : 0;
    mismatch |= charA ^ charB;
  }

  return mismatch === 0;
}

export function maskSecret(value: string | undefined | null): string {
  if (!value) return '••••••';
  return '•'.repeat(Math.min(Math.max(value.length, 6), 10));
}
