import type { INodeProperties } from 'n8n-workflow';

const show = (resource: string, operation: string[], extra: Record<string, unknown[]> = {}) => ({
	show: { resource: [resource], operation, ...extra },
});

const listFields = (resource: string): INodeProperties[] => [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		displayOptions: show(resource, ['getAll']),
		default: false,
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		displayOptions: show(resource, ['getAll'], { returnAll: [false] }),
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
	},
];

const scopeField = (resource: string): INodeProperties => ({
	displayName: 'Scope',
	name: 'scope',
	type: 'options',
	displayOptions: show(resource, ['getAll']),
	options: [
		{
			name: 'Manageable (Admin View)',
			value: 'manageable',
			description: 'Everything the token can manage, including unpublished items',
		},
		{
			name: 'Accessible (Reader View)',
			value: 'accessible',
			description: 'Only what the token can read as a user; usually empty for API tokens',
		},
	],
	default: 'manageable',
});

const idField = (
	resource: string,
	operations: string[],
	name: string,
	displayName: string,
): INodeProperties => ({
	displayName,
	name,
	type: 'string',
	required: true,
	default: '',
	displayOptions: show(resource, operations),
});

const operation = (
	resource: string,
	options: Array<{ name: string; value: string; action: string; description: string }>,
	defaultValue: string,
): INodeProperties => ({
	displayName: 'Operation',
	name: 'operation',
	type: 'options',
	noDataExpression: true,
	displayOptions: { show: { resource: [resource] } },
	options,
	default: defaultValue,
});

const postWriteFields: INodeProperties[] = [
	{
		displayName: 'Title',
		name: 'title',
		type: 'string',
		required: true,
		default: '',
		displayOptions: show('post', ['create']),
	},
	{
		displayName: 'Publish',
		name: 'publish',
		type: 'options',
		displayOptions: show('post', ['create']),
		options: [
			{ name: 'Save as Draft', value: 'draft' },
			{ name: 'Publish Now', value: 'now' },
			{ name: 'Schedule', value: 'scheduled' },
		],
		default: 'draft',
	},
	{
		displayName: 'Publish',
		name: 'publish',
		type: 'options',
		displayOptions: show('post', ['update']),
		options: [
			{ name: 'Keep As Is', value: 'keep' },
			{ name: 'Publish Now', value: 'now' },
			{ name: 'Schedule', value: 'scheduled' },
			{ name: 'Unpublish', value: 'unpublish' },
		],
		default: 'keep',
	},
	{
		displayName: 'Publish At',
		name: 'publishAt',
		type: 'dateTime',
		required: true,
		default: '',
		displayOptions: show('post', ['create', 'update'], { publish: ['scheduled'] }),
	},
	{
		displayName: 'Additional Fields',
		name: 'additionalFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		displayOptions: show('post', ['create', 'update']),
		options: [
			{
				displayName: 'Content (HTML)',
				name: 'content',
				type: 'string',
				typeOptions: { rows: 6 },
				default: '',
				description: 'Main body of the post; HTML is allowed',
			},
			{
				displayName: 'External ID',
				name: 'externalId',
				type: 'string',
				default: '',
				description: 'Your own reference ID. Allowed characters: a-z, 0-9, _ and -.',
			},
			{
				displayName: 'Image URL',
				name: 'image',
				type: 'string',
				default: '',
				description: 'URL of the primary image of the post',
			},
			{
				displayName: 'Locale',
				name: 'locale',
				type: 'string',
				default: 'en_US',
				description: 'Language key of the content, for example en_US or de_DE',
			},
			{
				displayName: 'Notification Channels',
				name: 'notificationChannels',
				type: 'multiOptions',
				options: [
					{ name: 'Email', value: 'email' },
					{ name: 'Push', value: 'push' },
				],
				default: [],
				description:
					'Send notifications for this post. On update, this sends the notifications again.',
			},
			{
				displayName: 'Teaser',
				name: 'teaser',
				type: 'string',
				default: '',
				description: 'Short text used in the news feed and in notifications',
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				description: 'New title (update only; on create use the Title field above)',
			},
		],
	},
];

export const resourceProperty: INodeProperties = {
	displayName: 'Resource',
	name: 'resource',
	type: 'options',
	noDataExpression: true,
	options: [
		{ name: 'Channel', value: 'channel' },
		{ name: 'Comment', value: 'comment' },
		{ name: 'Post', value: 'post' },
		{ name: 'User', value: 'user' },
	],
	default: 'post',
};

export const postProperties: INodeProperties[] = [
	operation(
		'post',
		[
			{
				name: 'Create',
				value: 'create',
				action: 'Create a post',
				description: 'Create a news post in a channel',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a post',
				description: 'Delete a news post',
			},
			{ name: 'Get', value: 'get', action: 'Get a post', description: 'Get a news post' },
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many posts',
				description: 'List news posts',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a post',
				description: 'Update a news post',
			},
		],
		'getAll',
	),
	idField('post', ['get', 'update', 'delete'], 'postId', 'Post ID'),
	idField('post', ['create'], 'channelId', 'Channel ID'),
	...postWriteFields,
	scopeField('post'),
	...listFields('post'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show('post', ['getAll']),
		options: [
			{
				displayName: 'Channel ID',
				name: 'channelId',
				type: 'string',
				default: '',
				description: 'Only posts of this channel. Other filters are ignored when set.',
			},
			{
				displayName: 'Content Types',
				name: 'contentType',
				type: 'multiOptions',
				options: [
					{ name: 'Articles', value: 'articles' },
					{ name: 'Pictures', value: 'pictures' },
					{ name: 'Updates', value: 'updates' },
				],
				default: [],
			},
			{
				displayName: 'Search Query',
				name: 'query',
				type: 'string',
				default: '',
				description: 'Search in the post content',
			},
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				options: [
					{ name: 'Created (Newest First)', value: 'created_DESC' },
					{ name: 'Published (Newest First)', value: 'published_DESC' },
					{ name: 'Updated (Newest First)', value: 'updated_DESC' },
				],
				default: 'published_DESC',
			},
		],
	},
];

export const channelProperties: INodeProperties[] = [
	operation(
		'channel',
		[
			{ name: 'Get', value: 'get', action: 'Get a channel', description: 'Get a news channel' },
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many channels',
				description: 'List news channels',
			},
		],
		'getAll',
	),
	idField('channel', ['get'], 'channelId', 'Channel ID'),
	scopeField('channel'),
	...listFields('channel'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show('channel', ['getAll']),
		options: [
			{
				displayName: 'Name Contains',
				name: 'query',
				type: 'string',
				default: '',
			},
		],
	},
];

export const userProperties: INodeProperties[] = [
	operation(
		'user',
		[
			{
				name: 'Get',
				value: 'get',
				action: 'Get a user',
				description: 'Get a user by ID or external ID',
			},
			{ name: 'Get Many', value: 'getAll', action: 'Get many users', description: 'List users' },
		],
		'getAll',
	),
	idField('user', ['get'], 'userId', 'User ID'),
	...listFields('user'),
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: show('user', ['get', 'getAll']),
		options: [
			{
				displayName: 'Include Profile',
				name: 'includeProfile',
				type: 'boolean',
				default: false,
				description: 'Whether to include the profile fields of each user',
			},
			{
				displayName: 'Search Query',
				name: 'query',
				type: 'string',
				default: '',
				description: 'Search across profile fields such as name or location (Get Many only)',
			},
		],
	},
];

export const commentProperties: INodeProperties[] = [
	operation(
		'comment',
		[
			{ name: 'Get', value: 'get', action: 'Get a comment', description: 'Get a comment' },
			{
				name: 'Get Many',
				value: 'getAll',
				action: 'Get many comments',
				description: 'List comments',
			},
		],
		'getAll',
	),
	idField('comment', ['get'], 'commentId', 'Comment ID'),
	...listFields('comment'),
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: show('comment', ['getAll']),
		options: [
			{
				displayName: 'Filter (SCIM)',
				name: 'filter',
				type: 'string',
				default: '',
				placeholder: 'created gt "2026-01-01T00:00:00Z"',
				description: 'SCIM filter on the created or updated date',
			},
			{
				displayName: 'Include Unpublished',
				name: 'manage',
				type: 'boolean',
				default: false,
				description:
					'Whether to include unpublished comments (needs a token that can manage comments)',
			},
			{
				displayName: 'Sort',
				name: 'sort',
				type: 'options',
				options: [
					{ name: 'Created (Newest First)', value: 'created_DESC' },
					{ name: 'Created (Oldest First)', value: 'created_ASC' },
					{ name: 'Updated (Newest First)', value: 'updated_DESC' },
					{ name: 'Updated (Oldest First)', value: 'updated_ASC' },
				],
				default: 'updated_DESC',
			},
		],
	},
];
