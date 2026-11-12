import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
} from 'n8n-workflow';
import { extractItems, nextCursor, type StaffbaseRequest } from './requests';

type Context = IExecuteFunctions | ILoadOptionsFunctions;

export async function staffbaseApiRequest(
	this: Context,
	request: StaffbaseRequest,
	extraQs: IDataObject = {},
): Promise<unknown> {
	const credentials = await this.getCredentials('staffbaseApi');
	const baseUrl = String(credentials.baseUrl ?? '').replace(/\/+$/, '');
	const options: IHttpRequestOptions = {
		method: request.method,
		url: `${baseUrl}${request.path}`,
		qs: { ...request.qs, ...extraQs },
		headers: { Accept: 'application/json', ...request.headers },
		json: true,
	};
	if (request.body !== undefined) {
		options.body = request.body;
	}
	// The spec declares array query params with OpenAPI's default form style: key=a&key=b.
	options.arrayFormat = 'repeat';
	return await this.helpers.httpRequestWithAuthentication.call(this, 'staffbaseApi', options);
}

/** Fetches list pages until `limit` items are collected (or all, when limit is undefined). */
export async function staffbaseApiRequestList(
	this: Context,
	request: StaffbaseRequest,
	limit?: number,
): Promise<IDataObject[]> {
	const pageSize = request.maxPageSize ?? 100;
	const items: IDataObject[] = [];
	let offset = 0;
	let cursor: string | undefined;

	for (;;) {
		const remaining = limit === undefined ? pageSize : Math.min(pageSize, limit - items.length);
		const qs: IDataObject = { limit: remaining };
		if (request.pagination === 'offset') qs.offset = offset;
		if (request.pagination === 'cursor' && cursor) qs.cursor = cursor;

		const response = await staffbaseApiRequest.call(this, request, qs);
		const page = extractItems(response);
		items.push(...page);

		if (limit !== undefined && items.length >= limit) return items.slice(0, limit);
		if (page.length === 0) return items;

		if (request.pagination === 'offset') {
			offset += page.length;
			const total = (response as IDataObject).total;
			if (typeof total === 'number' ? offset >= total : page.length < remaining) return items;
		} else if (request.pagination === 'cursor') {
			const next = nextCursor(response);
			const total = (response as IDataObject).total;
			// Guards against an endless loop if the last page still echoes a cursor.
			if (!next || next === cursor || (typeof total === 'number' && items.length >= total)) {
				return items;
			}
			cursor = next;
		} else {
			return items;
		}
	}
}
