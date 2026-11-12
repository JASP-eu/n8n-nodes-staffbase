import { describe, expect, it } from 'vitest';
import {
	buildPostBody,
	buildRequest,
	extractItems,
	nextCursor,
	USERS_SEARCH_ACCEPT,
	USERS_V2_ACCEPT,
} from '../nodes/Staffbase/shared/requests';

describe('buildRequest: posts', () => {
	it('lists manageable posts by default, because API tokens see no reader view', () => {
		const r = buildRequest('post', 'getAll', { sort: 'updated_DESC' });
		expect(r.qs).toEqual({ sort: 'updated_DESC', manageable: true });
	});

	it('lists accessible posts with filters and offset pagination', () => {
		const r = buildRequest('post', 'getAll', {
			query: 'summit',
			sort: 'published_DESC',
			contentType: ['articles'],
			scope: 'accessible',
		});
		expect(r).toMatchObject({
			method: 'GET',
			path: '/posts',
			pagination: 'offset',
			maxPageSize: 100,
		});
		expect(r.qs).toEqual({ query: 'summit', sort: 'published_DESC', contentType: ['articles'] });
	});

	it('switches to the channel endpoint when a channel filter is set', () => {
		const r = buildRequest('post', 'getAll', { channelId: 'ch 1', query: 'ignored' });
		expect(r.path).toBe('/channels/ch%201/posts');
		expect(r.qs).toEqual({});
	});

	it('creates a draft post in a channel', () => {
		const r = buildRequest('post', 'create', { channelId: 'c1', title: 'Hello', publish: 'draft' });
		expect(r).toMatchObject({ method: 'POST', path: '/channels/c1/posts' });
		expect(r.body).toEqual({ contents: { en_US: { title: 'Hello' } } });
	});

	it('publishes now with locale, content and notifications', () => {
		const body = buildPostBody(
			{
				title: 'Hallo',
				content: '<p>Text</p>',
				teaser: 'Kurz',
				locale: 'de_DE',
				publish: 'now',
				externalId: 'news-42',
				notificationChannels: ['push'],
			},
			false,
		);
		expect(body).toEqual({
			contents: { de_DE: { title: 'Hallo', content: '<p>Text</p>', teaser: 'Kurz' } },
			externalID: 'news-42',
			published: 'now',
			notificationChannels: ['push'],
		});
	});

	it('schedules with an ISO date', () => {
		const body = buildPostBody(
			{ title: 'T', publish: 'scheduled', publishAt: '2026-12-01T09:00:00+01:00' },
			false,
		);
		expect(body.published).toBe('2026-12-01T08:00:00.000Z');
	});

	it('rejects invalid input before any request', () => {
		expect(() => buildRequest('post', 'create', { channelId: 'c1', title: '' })).toThrow(/title/);
		expect(() => buildRequest('post', 'create', { title: 'x' })).toThrow(/channelId/);
		expect(() => buildPostBody({ title: 'x', publish: 'scheduled' }, false)).toThrow(/Publish At/);
		expect(() =>
			buildPostBody({ title: 'x', publish: 'scheduled', publishAt: 'soon' }, false),
		).toThrow(/valid date/);
		expect(() => buildPostBody({ title: 'x', publish: 'unpublish' }, false)).toThrow(/updating/);
		expect(() => buildRequest('post', 'update', { postId: 'p1', publish: 'keep' })).toThrow(
			/at least one/,
		);
	});

	it('updates only the given fields and can unpublish', () => {
		const r = buildRequest('post', 'update', {
			postId: 'p/1',
			publish: 'unpublish',
			teaser: 'New',
		});
		expect(r).toMatchObject({ method: 'PUT', path: '/posts/p%2F1' });
		expect(r.body).toEqual({ contents: { en_US: { teaser: 'New' } }, published: null });
	});

	it('gets and deletes by id', () => {
		expect(buildRequest('post', 'get', { postId: 'p1' })).toMatchObject({
			method: 'GET',
			path: '/posts/p1',
		});
		expect(buildRequest('post', 'delete', { postId: 'p1' })).toMatchObject({
			method: 'DELETE',
			path: '/posts/p1',
		});
	});
});

describe('buildRequest: other resources', () => {
	it('lists manageable channels with cursor pagination by default', () => {
		expect(buildRequest('channel', 'getAll', { query: 'HR' })).toMatchObject({
			path: '/branch/channels',
			qs: { query: 'HR' },
			pagination: 'cursor',
		});
	});

	it('lists accessible channels with offset pagination', () => {
		expect(buildRequest('channel', 'getAll', { scope: 'accessible' })).toMatchObject({
			path: '/channels',
			qs: {},
			pagination: 'offset',
		});
	});

	it('passes "manage" for unpublished comments only when asked', () => {
		expect(buildRequest('comment', 'getAll', { manage: true }).qs).toEqual({ manage: true });
		expect(buildRequest('comment', 'getAll', { manage: false }).qs).toEqual({});
	});

	it('lists users through API v2 with cursor pagination', () => {
		const r = buildRequest('user', 'getAll', { includeProfile: true, query: '' });
		expect(r).toMatchObject({ path: '/users', pagination: 'cursor', maxPageSize: 500 });
		expect(r.headers).toEqual({ Accept: USERS_V2_ACCEPT });
		expect(r.qs).toEqual({ includeProfile: true });
	});

	// Regression: v2 GET /users ignored "query" and returned every user (live test 2026-11-12).
	it('searches users through /users/search when a query is set', () => {
		const r = buildRequest('user', 'getAll', { includeProfile: true, query: ' Sascha ' });
		expect(r).toMatchObject({
			path: '/users/search',
			pagination: 'cursor',
			maxPageSize: 500,
			unwrapData: true,
		});
		expect(r.headers).toEqual({ Accept: USERS_SEARCH_ACCEPT });
		expect(r.qs).toEqual({ query: 'Sascha', includeProfile: true });
	});

	it('gets a user and a comment', () => {
		expect(buildRequest('user', 'get', { userId: 'ext-7' }).path).toBe('/users/ext-7');
		expect(buildRequest('comment', 'get', { commentId: 'c9' }).path).toBe('/comments/c9');
	});

	it('lists comments with a SCIM filter', () => {
		const r = buildRequest('comment', 'getAll', {
			filter: 'created gt "2026-01-01"',
			sort: 'created_DESC',
		});
		expect(r.qs).toEqual({ filter: 'created gt "2026-01-01"', sort: 'created_DESC' });
	});

	it('rejects unknown operations', () => {
		expect(() => buildRequest('channel', 'delete', {})).toThrow(/Unsupported/);
	});
});

describe('response helpers', () => {
	it('reads items from every list envelope', () => {
		expect(extractItems({ total: 1, data: [{ id: 'a' }] })).toEqual([{ id: 'a' }]);
		expect(extractItems({ entries: [{ id: 'b' }], nextCursor: 'x' })).toEqual([{ id: 'b' }]);
		expect(extractItems([{ id: 'c' }])).toEqual([{ id: 'c' }]);
		expect(extractItems(undefined)).toEqual([]);
	});

	it('unwraps user search entries', () => {
		expect(extractItems({ entries: [{ data: { id: 'u1' } }], total: 1 }, true)).toEqual([
			{ id: 'u1' },
		]);
	});

	it('reads the next cursor', () => {
		expect(nextCursor({ nextCursor: 'abc' })).toBe('abc');
		expect(nextCursor({ cursor: 'from-branch-channels' })).toBe('from-branch-channels');
		expect(nextCursor({ nextCursor: '' })).toBeUndefined();
		expect(nextCursor({ nextCursor: null })).toBeUndefined();
	});
});
