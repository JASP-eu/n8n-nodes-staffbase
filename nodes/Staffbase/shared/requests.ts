import type { IDataObject, IHttpRequestMethods } from 'n8n-workflow';

export type StaffbaseResource = 'post' | 'channel' | 'user' | 'comment';

export type Pagination = 'none' | 'offset' | 'cursor';

export interface StaffbaseRequest {
	method: IHttpRequestMethods;
	path: string;
	qs: IDataObject;
	body?: IDataObject;
	headers?: Record<string, string>;
	pagination: Pagination;
	/** Highest page size the endpoint accepts. */
	maxPageSize?: number;
	/** List entries are wrapped as `{ data: {...} }` (user search). */
	unwrapData?: boolean;
}

// User API v1 is deprecated (removal 2027-10-01); v2 is selected via Accept header.
export const USERS_V2_ACCEPT = 'application/vnd.staffbase.accessors.users.v2+json';
// GET /users v2 ignores "query" (seen live 2026-11-12); only /users/search filters by text.
export const USERS_SEARCH_ACCEPT = 'application/vnd.staffbase.accessors.users-search.v1+json';

const id = (value: unknown, name: string): string => {
	const text = String(value ?? '').trim();
	if (!text) {
		throw new Error(`Parameter "${name}" is required`);
	}
	return encodeURIComponent(text);
};

const compact = (obj: IDataObject): IDataObject =>
	Object.fromEntries(
		Object.entries(obj).filter(([, v]) => v !== undefined && v !== '' && v !== null),
	);

const toIsoDate = (value: string): string => {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new Error(`"${value}" is not a valid date`);
	}
	return date.toISOString();
};

export interface PostContentInput {
	locale?: string;
	title?: string;
	content?: string;
	teaser?: string;
	image?: string;
}

export interface PostWriteInput extends PostContentInput {
	publish?: 'draft' | 'now' | 'scheduled' | 'unpublish' | 'keep';
	publishAt?: string;
	externalId?: string;
	notificationChannels?: string[];
}

/** Builds the JSON body shared by post create (POST) and update (PUT). */
export function buildPostBody(input: PostWriteInput, isUpdate: boolean): IDataObject {
	const locale = (input.locale || 'en_US').trim();
	const localized = compact({
		title: input.title,
		content: input.content,
		teaser: input.teaser,
		image: input.image,
	});
	if (!isUpdate && !localized.title) {
		throw new Error('A title is required to create a post');
	}

	const body: IDataObject = {};
	if (Object.keys(localized).length > 0) {
		body.contents = { [locale]: localized };
	}
	if (input.externalId) {
		body.externalID = input.externalId;
	}

	switch (input.publish) {
		case 'now':
			body.published = 'now';
			break;
		case 'scheduled':
			if (!input.publishAt) {
				throw new Error('"Publish At" is required for scheduled posts');
			}
			body.published = toIsoDate(input.publishAt);
			break;
		case 'unpublish':
			if (!isUpdate) {
				throw new Error('"Unpublish" is only available when updating a post');
			}
			body.published = null;
			break;
		default:
			break;
	}

	// Sending notificationChannels on update re-sends notifications to all readers.
	if (input.notificationChannels && input.notificationChannels.length > 0) {
		body.notificationChannels = input.notificationChannels;
	}
	return body;
}

/**
 * Maps a node resource/operation plus already-read parameters to one Staffbase API call.
 * Pure on purpose so request building is unit-testable without an n8n runtime.
 */
export function buildRequest(
	resource: StaffbaseResource,
	operation: string,
	p: IDataObject,
): StaffbaseRequest {
	switch (resource) {
		case 'post':
			return buildPostRequest(operation, p);
		case 'channel':
			return buildChannelRequest(operation, p);
		case 'user':
			return buildUserRequest(operation, p);
		case 'comment':
			return buildCommentRequest(operation, p);
		default:
			throw new Error(`Unsupported resource "${String(resource)}"`);
	}
}

// An API token is not a user, so the "accessible" lists (/channels, /posts) come back empty
// for it (seen on a test tenant, 2026-11-12). The manageable lists are the useful default.
const isManageable = (p: IDataObject): boolean => p.scope !== 'accessible';

function buildPostRequest(operation: string, p: IDataObject): StaffbaseRequest {
	switch (operation) {
		case 'getAll': {
			if (p.channelId) {
				return {
					method: 'GET',
					path: `/channels/${id(p.channelId, 'channelId')}/posts`,
					qs: {},
					pagination: 'offset',
					maxPageSize: 100,
				};
			}
			const contentType = p.contentType as string[] | undefined;
			return {
				method: 'GET',
				path: '/posts',
				qs: compact({
					query: p.query,
					sort: p.sort,
					manageable: isManageable(p) ? true : undefined,
					contentType: contentType && contentType.length > 0 ? contentType : undefined,
				}),
				pagination: 'offset',
				maxPageSize: 100,
			};
		}
		case 'get':
			return {
				method: 'GET',
				path: `/posts/${id(p.postId, 'postId')}`,
				qs: {},
				pagination: 'none',
			};
		case 'create':
			return {
				method: 'POST',
				path: `/channels/${id(p.channelId, 'channelId')}/posts`,
				qs: {},
				body: buildPostBody(p as PostWriteInput, false),
				pagination: 'none',
			};
		case 'update': {
			const body = buildPostBody(p as PostWriteInput, true);
			if (Object.keys(body).length === 0) {
				throw new Error('Set at least one field to update');
			}
			return {
				method: 'PUT',
				path: `/posts/${id(p.postId, 'postId')}`,
				qs: {},
				body,
				pagination: 'none',
			};
		}
		case 'delete':
			return {
				method: 'DELETE',
				path: `/posts/${id(p.postId, 'postId')}`,
				qs: {},
				pagination: 'none',
			};
		default:
			throw new Error(`Unsupported post operation "${operation}"`);
	}
}

function buildChannelRequest(operation: string, p: IDataObject): StaffbaseRequest {
	switch (operation) {
		case 'getAll':
			if (isManageable(p)) {
				return {
					method: 'GET',
					path: '/branch/channels',
					qs: compact({ query: p.query }),
					pagination: 'cursor',
					maxPageSize: 100,
				};
			}
			return {
				method: 'GET',
				path: '/channels',
				qs: compact({ query: p.query }),
				pagination: 'offset',
				maxPageSize: 100,
			};
		case 'get':
			return {
				method: 'GET',
				path: `/channels/${id(p.channelId, 'channelId')}`,
				qs: {},
				pagination: 'none',
			};
		default:
			throw new Error(`Unsupported channel operation "${operation}"`);
	}
}

function buildUserRequest(operation: string, p: IDataObject): StaffbaseRequest {
	switch (operation) {
		case 'getAll': {
			const includeProfile = p.includeProfile === true ? true : undefined;
			const query = String(p.query ?? '').trim();
			if (query) {
				// Search returns activated users only; plain /users also lists pending ones.
				return {
					method: 'GET',
					path: '/users/search',
					qs: compact({ query, includeProfile }),
					headers: { Accept: USERS_SEARCH_ACCEPT },
					pagination: 'cursor',
					maxPageSize: 500,
					unwrapData: true,
				};
			}
			return {
				method: 'GET',
				path: '/users',
				qs: compact({ sort: p.sort, includeProfile }),
				headers: { Accept: USERS_V2_ACCEPT },
				pagination: 'cursor',
				maxPageSize: 500,
			};
		}
		case 'get':
			return {
				method: 'GET',
				path: `/users/${id(p.userId, 'userId')}`,
				qs: compact({ includeProfile: p.includeProfile === true ? true : undefined }),
				pagination: 'none',
			};
		default:
			throw new Error(`Unsupported user operation "${operation}"`);
	}
}

function buildCommentRequest(operation: string, p: IDataObject): StaffbaseRequest {
	switch (operation) {
		case 'getAll':
			return {
				method: 'GET',
				path: '/comments',
				qs: compact({
					filter: p.filter,
					sort: p.sort,
					manage: p.manage === true ? true : undefined,
				}),
				pagination: 'offset',
				maxPageSize: 100,
			};
		case 'get':
			return {
				method: 'GET',
				path: `/comments/${id(p.commentId, 'commentId')}`,
				qs: {},
				pagination: 'none',
			};
		default:
			throw new Error(`Unsupported comment operation "${operation}"`);
	}
}

/** Pulls the item array out of the different list envelopes Staffbase uses. */
export function extractItems(response: unknown, unwrapData = false): IDataObject[] {
	let items: IDataObject[] = [];
	if (Array.isArray(response)) {
		items = response as IDataObject[];
	} else if (response && typeof response === 'object') {
		const r = response as IDataObject;
		if (Array.isArray(r.data)) items = r.data as IDataObject[];
		else if (Array.isArray(r.entries)) items = r.entries as IDataObject[];
	}
	return unwrapData ? items.map((entry) => (entry?.data ?? entry) as IDataObject) : items;
}

/** Cursor for the next page, or undefined when the last page was reached. */
export function nextCursor(response: unknown): string | undefined {
	if (!response || typeof response !== 'object') return undefined;
	// Users v2 returns "nextCursor"; /branch/channels returns "cursor".
	const r = response as IDataObject;
	const cursor = r.nextCursor ?? r.cursor;
	return typeof cursor === 'string' && cursor !== '' ? cursor : undefined;
}
