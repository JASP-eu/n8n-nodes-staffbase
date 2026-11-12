import { describe, expect, it, vi } from 'vitest';
import type { IDataObject, IExecuteFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { buildRequest } from '../nodes/Staffbase/shared/requests';
import { staffbaseApiRequest, staffbaseApiRequestList } from '../nodes/Staffbase/shared/transport';

function fakeContext(pages: unknown[]) {
	const calls: IHttpRequestOptions[] = [];
	const request = vi.fn(async (_type: string, options: IHttpRequestOptions) => {
		calls.push(options);
		return pages.shift();
	});
	const ctx = {
		getCredentials: async () => ({ baseUrl: 'https://acme.staffbase.com/api/', apiToken: 't' }),
		helpers: { httpRequestWithAuthentication: request },
	} as unknown as IExecuteFunctions;
	return { ctx, calls, request };
}

const rows = (from: number, count: number): IDataObject[] =>
	Array.from({ length: count }, (_, k) => ({ id: from + k }));

describe('staffbaseApiRequest', () => {
	it('joins the base URL without a double slash and sends JSON with the credential type', async () => {
		const { ctx, calls, request } = fakeContext([{ id: 'p1' }]);
		await staffbaseApiRequest.call(ctx, buildRequest('post', 'get', { postId: 'p1' }));
		expect(request.mock.calls[0][0]).toBe('staffbaseApi');
		expect(calls[0]).toMatchObject({
			method: 'GET',
			url: 'https://acme.staffbase.com/api/posts/p1',
			json: true,
			arrayFormat: 'repeat',
		});
	});

	it('sends the body on create', async () => {
		const { ctx, calls } = fakeContext([{}]);
		await staffbaseApiRequest.call(
			ctx,
			buildRequest('post', 'create', { channelId: 'c1', title: 'Hi', publish: 'now' }),
		);
		expect(calls[0].body).toEqual({ contents: { en_US: { title: 'Hi' } }, published: 'now' });
	});
});

describe('staffbaseApiRequestList', () => {
	it('walks offset pages until total is reached', async () => {
		const { ctx, calls } = fakeContext([
			{ total: 150, data: rows(0, 100) },
			{ total: 150, data: rows(100, 50) },
		]);
		const items = await staffbaseApiRequestList.call(
			ctx,
			buildRequest('channel', 'getAll', { scope: 'accessible' }),
		);
		expect(items).toHaveLength(150);
		expect(calls.map((c) => c.qs)).toEqual([
			{ limit: 100, offset: 0 },
			{ limit: 100, offset: 100 },
		]);
	});

	it('follows the "cursor" field of manageable channels and stops at total', async () => {
		const { ctx, calls } = fakeContext([
			{ total: 3, data: rows(0, 2), cursor: 'c1' },
			{ total: 3, data: rows(2, 1), cursor: 'c2' },
		]);
		const items = await staffbaseApiRequestList.call(ctx, buildRequest('channel', 'getAll', {}));
		expect(items).toHaveLength(3);
		expect(calls[0].url).toBe('https://acme.staffbase.com/api/branch/channels');
		expect(calls[1].qs).toEqual({ limit: 100, cursor: 'c1' });
	});

	it('stops when the API echoes the same cursor again', async () => {
		const { ctx, calls } = fakeContext([
			{ entries: rows(0, 1), nextCursor: 'same' },
			{ entries: rows(1, 1), nextCursor: 'same' },
			{ entries: rows(2, 1), nextCursor: 'never-reached' },
		]);
		const items = await staffbaseApiRequestList.call(ctx, buildRequest('user', 'getAll', {}));
		expect(items).toHaveLength(2);
		expect(calls).toHaveLength(2);
	});

	it('stops at the limit and asks only for what is missing', async () => {
		const { ctx, calls } = fakeContext([{ total: 500, data: rows(0, 30) }]);
		const items = await staffbaseApiRequestList.call(ctx, buildRequest('post', 'getAll', {}), 30);
		expect(items).toHaveLength(30);
		expect(calls[0].qs).toMatchObject({ limit: 30, offset: 0 });
	});

	it('follows cursors for users and stops without one', async () => {
		const { ctx, calls } = fakeContext([
			{ entries: rows(0, 2), nextCursor: 'n1' },
			{ entries: rows(2, 1), nextCursor: null },
		]);
		const items = await staffbaseApiRequestList.call(ctx, buildRequest('user', 'getAll', {}));
		expect(items).toHaveLength(3);
		expect(calls[0].qs).toEqual({ limit: 500 });
		expect(calls[1].qs).toEqual({ limit: 500, cursor: 'n1' });
		expect(calls[1].headers).toMatchObject({
			Accept: 'application/vnd.staffbase.accessors.users.v2+json',
		});
	});

	it('stops on an empty page even without total', async () => {
		const { ctx, calls } = fakeContext([{ data: [] }]);
		expect(await staffbaseApiRequestList.call(ctx, buildRequest('comment', 'getAll', {}))).toEqual(
			[],
		);
		expect(calls).toHaveLength(1);
	});
});
