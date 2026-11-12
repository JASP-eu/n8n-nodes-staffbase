import { createHmac, timingSafeEqual } from 'crypto';

export type SignatureResult =
	| { valid: true }
	| { valid: false; reason: 'no-secret' | 'missing' | 'malformed' | 'stale' | 'mismatch' };

/**
 * Verifies a Staffbase outbound webhook signature.
 * Header format: `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`.
 * The raw body must be the exact bytes received; re-serialised JSON will not match.
 */
export function verifyStaffbaseSignature(
	header: string | undefined,
	rawBody: Buffer | string,
	secret: string,
	nowSeconds: number,
	toleranceSeconds = 300,
): SignatureResult {
	// An empty key is a valid HMAC key, so without this anyone could sign deliveries.
	if (!secret.trim()) return { valid: false, reason: 'no-secret' };
	if (!header) return { valid: false, reason: 'missing' };

	const parts = new Map<string, string[]>();
	for (const piece of header.split(',')) {
		const index = piece.indexOf('=');
		if (index <= 0) continue;
		const key = piece.slice(0, index).trim();
		const value = piece.slice(index + 1).trim();
		parts.set(key, [...(parts.get(key) ?? []), value]);
	}

	const timestamp = Number(parts.get('t')?.[0]);
	const signatures = parts.get('v1') ?? [];
	if (!Number.isInteger(timestamp) || signatures.length === 0) {
		return { valid: false, reason: 'malformed' };
	}
	if (toleranceSeconds > 0 && Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
		return { valid: false, reason: 'stale' };
	}

	// Hash the received bytes as-is; decoding first would alter invalid UTF-8.
	const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest();

	// The docs show one v1 entry; tolerating several costs nothing and survives a format change.
	for (const candidate of signatures) {
		if (!/^[0-9a-f]+$/i.test(candidate)) continue;
		const given = Buffer.from(candidate, 'hex');
		if (given.length === expected.length && timingSafeEqual(given, expected)) {
			return { valid: true };
		}
	}
	return { valid: false, reason: 'mismatch' };
}
