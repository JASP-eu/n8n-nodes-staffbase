import { describe, expect, it } from 'vitest';
import type { IDataObject, IExecuteFunctions } from 'n8n-workflow';
import { readParameters } from '../nodes/Staffbase/Staffbase.node';
import { buildRequest } from '../nodes/Staffbase/shared/requests';

const ctxWith = (values: IDataObject) =>
	({
		getNodeParameter: (name: string, _i: number, fallback?: unknown) =>
			name in values ? values[name] : fallback,
	}) as unknown as IExecuteFunctions;

describe('readParameters', () => {
	it('lets the required Title win over Additional Fields on create', () => {
		const p = readParameters(
			ctxWith({
				channelId: 'c1',
				title: 'Main title',
				publish: 'now',
				additionalFields: { title: 'stray', teaser: 'Short', locale: 'de_DE' },
			}),
			'post',
			'create',
			0,
		);
		expect(buildRequest('post', 'create', p).body).toEqual({
			contents: { de_DE: { title: 'Main title', teaser: 'Short' } },
			published: 'now',
		});
	});

	it('takes the new title from Additional Fields on update and keeps publish state', () => {
		const p = readParameters(
			ctxWith({ postId: 'p1', additionalFields: { title: 'Renamed' } }),
			'post',
			'update',
			0,
		);
		expect(p.publish).toBe('keep');
		expect(buildRequest('post', 'update', p).body).toEqual({
			contents: { en_US: { title: 'Renamed' } },
		});
	});

	it('reads publishAt only for scheduled posts', () => {
		const p = readParameters(
			ctxWith({
				channelId: 'c1',
				title: 'T',
				publish: 'scheduled',
				publishAt: '2026-12-24T10:00:00Z',
			}),
			'post',
			'create',
			0,
		);
		expect(buildRequest('post', 'create', p).body?.published).toBe('2026-12-24T10:00:00.000Z');
	});

	it('merges filters and the scope for lists', () => {
		const p = readParameters(
			ctxWith({ scope: 'accessible', filters: { query: 'HR' } }),
			'channel',
			'getAll',
			0,
		);
		expect(buildRequest('channel', 'getAll', p)).toMatchObject({
			path: '/channels',
			qs: { query: 'HR' },
		});
	});

	it('passes user options to Get', () => {
		const p = readParameters(
			ctxWith({ userId: 'u1', options: { includeProfile: true } }),
			'user',
			'get',
			0,
		);
		expect(buildRequest('user', 'get', p)).toMatchObject({
			path: '/users/u1',
			qs: { includeProfile: true },
		});
	});
});
