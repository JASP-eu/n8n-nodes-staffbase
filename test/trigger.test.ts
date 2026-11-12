import { createHmac } from 'crypto';
import { describe, expect, it } from 'vitest';
import { verifyStaffbaseSignature } from '../nodes/StaffbaseTrigger/signature';
import { handleDelivery } from '../nodes/StaffbaseTrigger/StaffbaseTrigger.node';

const secret = 'whsec_test';
const now = 1_800_000_000;
const body = JSON.stringify({
	id: 'evt-1',
	type: 'news.comment.created.v1',
	occurred_at: '2026-11-12T10:00:00Z',
	data: { commentId: 'c1' },
});
const sign = (t: number, raw: string, key = secret) =>
	`t=${t},v1=${createHmac('sha256', key).update(`${t}.${raw}`).digest('hex')}`;

describe('verifyStaffbaseSignature', () => {
	it('accepts a valid signature over the raw body', () => {
		expect(verifyStaffbaseSignature(sign(now, body), Buffer.from(body), secret, now)).toEqual({
			valid: true,
		});
	});

	it('rejects a tampered body, a wrong secret and a stale timestamp', () => {
		expect(verifyStaffbaseSignature(sign(now, body), body + ' ', secret, now)).toMatchObject({
			reason: 'mismatch',
		});
		expect(verifyStaffbaseSignature(sign(now, body, 'other'), body, secret, now)).toMatchObject({
			reason: 'mismatch',
		});
		expect(verifyStaffbaseSignature(sign(now - 301, body), body, secret, now)).toMatchObject({
			reason: 'stale',
		});
	});

	it('allows old deliveries when the age check is off', () => {
		expect(verifyStaffbaseSignature(sign(now - 9999, body), body, secret, now, 0)).toEqual({
			valid: true,
		});
	});

	it('rejects missing and malformed headers', () => {
		expect(verifyStaffbaseSignature(undefined, body, secret, now)).toMatchObject({
			reason: 'missing',
		});
		expect(verifyStaffbaseSignature('v1=abc', body, secret, now)).toMatchObject({
			reason: 'malformed',
		});
		expect(verifyStaffbaseSignature(`t=${now},v1=zz`, body, secret, now)).toMatchObject({
			reason: 'mismatch',
		});
	});
});

describe('handleDelivery', () => {
	const base = { secret, nowSeconds: now, toleranceSeconds: 300, events: [] as string[] };

	it('emits a verified event', () => {
		const r = handleDelivery({
			...base,
			rawBody: Buffer.from(body),
			signatureHeader: sign(now, body),
		});
		expect(r).toEqual({ status: 'emit', event: JSON.parse(body) });
	});

	it('ignores events that are not selected', () => {
		const r = handleDelivery({
			...base,
			events: ['user.deleted.v1'],
			rawBody: body,
			signatureHeader: sign(now, body),
		});
		expect(r).toEqual({ status: 'ignored' });
	});

	it('rejects unsigned and non-JSON deliveries', () => {
		expect(handleDelivery({ ...base, rawBody: body, signatureHeader: undefined })).toMatchObject({
			status: 'rejected',
			code: 401,
		});
		expect(
			handleDelivery({ ...base, rawBody: 'nope', signatureHeader: sign(now, 'nope') }),
		).toMatchObject({ status: 'rejected', code: 400 });
	});
});
