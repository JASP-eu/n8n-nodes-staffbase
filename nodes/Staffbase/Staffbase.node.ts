import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	type JsonObject,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import {
	channelProperties,
	commentProperties,
	postProperties,
	resourceProperty,
	userProperties,
} from './descriptions';
import { buildRequest, type StaffbaseResource } from './shared/requests';
import { staffbaseApiRequest, staffbaseApiRequestList } from './shared/transport';

/** Collects the parameters of the current resource/operation into one flat object. */
export function readParameters(
	ctx: IExecuteFunctions,
	resource: StaffbaseResource,
	operation: string,
	i: number,
): IDataObject {
	const get = (name: string, fallback: IDataObject[string] = '') =>
		ctx.getNodeParameter(name, i, fallback) as IDataObject[string];
	const p: IDataObject = {};

	if (operation === 'getAll') {
		Object.assign(p, get('filters', {}) as IDataObject, get('options', {}) as IDataObject);
		if (resource === 'post' || resource === 'channel') p.scope = get('scope', 'manageable');
		return p;
	}
	if (resource === 'user') {
		Object.assign(p, get('options', {}) as IDataObject);
	}

	const idName = { post: 'postId', channel: 'channelId', user: 'userId', comment: 'commentId' }[
		resource
	];
	if (resource === 'post' && operation === 'create') {
		p.channelId = get('channelId');
		p.title = get('title');
	} else {
		p[idName] = get(idName);
	}

	if (resource === 'post' && (operation === 'create' || operation === 'update')) {
		const additional = get('additionalFields', {}) as IDataObject;
		// The required create-only Title field wins over the update-only one in Additional Fields.
		Object.assign(p, additional, operation === 'create' ? { title: p.title } : {});
		p.publish = get('publish', operation === 'create' ? 'draft' : 'keep');
		if (p.publish === 'scheduled') p.publishAt = get('publishAt');
	}
	return p;
}

export class Staffbase implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Staffbase',
		name: 'staffbase',
		icon: { light: 'file:../../icons/staffbase.svg', dark: 'file:../../icons/staffbase.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Read and publish news, channels, users and comments in Staffbase',
		defaults: { name: 'Staffbase' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'staffbaseApi', required: true }],
		properties: [
			resourceProperty,
			...postProperties,
			...channelProperties,
			...userProperties,
			...commentProperties,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as StaffbaseResource;
				const operation = this.getNodeParameter('operation', i) as string;
				const params = readParameters(this, resource, operation, i);

				let request;
				try {
					request = buildRequest(resource, operation, params);
				} catch (error) {
					throw new NodeOperationError(this.getNode(), (error as Error).message, { itemIndex: i });
				}

				let results: IDataObject[];
				if (operation === 'getAll') {
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
					results = await staffbaseApiRequestList.call(this, request, limit);
				} else {
					const response = await staffbaseApiRequest.call(this, request);
					results =
						operation === 'delete'
							? [{ deleted: true, id: params.postId }]
							: [(response ?? {}) as IDataObject];
				}

				returnData.push(
					...this.helpers.constructExecutionMetaData(this.helpers.returnJsonArray(results), {
						itemData: { item: i },
					}),
				);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				// Input errors keep their message; everything else is an HTTP failure from Staffbase.
				if (error instanceof NodeOperationError) {
					throw new NodeOperationError(this.getNode(), error, { itemIndex: i });
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}
		return [returnData];
	}
}
