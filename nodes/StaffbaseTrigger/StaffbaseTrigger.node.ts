import {
	NodeConnectionTypes,
	type IDataObject,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookFunctions,
	type IWebhookResponseData,
} from 'n8n-workflow';
import { verifyStaffbaseSignature } from './signature';

export const STAFFBASE_EVENTS = [
	{ name: 'Comment Created', value: 'news.comment.created.v1' },
	{ name: 'Comment Deleted', value: 'news.comment.deleted.v1' },
	{ name: 'Comment Updated', value: 'news.comment.updated.v1' },
	{ name: 'User Changed', value: 'user.changed.v1' },
	{ name: 'User Deleted', value: 'user.deleted.v1' },
];

/** Decides what the trigger does with one delivery. Pure for testability. */
export function handleDelivery(input: {
	rawBody: Buffer | string | undefined;
	signatureHeader: string | undefined;
	secret: string;
	events: string[];
	nowSeconds: number;
	toleranceSeconds: number;
}):
	| { status: 'emit'; event: IDataObject }
	| { status: 'ignored' }
	| { status: 'rejected'; code: 400 | 401; reason: string } {
	const raw = input.rawBody ?? '';
	const check = verifyStaffbaseSignature(
		input.signatureHeader,
		raw,
		input.secret,
		input.nowSeconds,
		input.toleranceSeconds,
	);
	if (!check.valid) return { status: 'rejected', code: 401, reason: `signature ${check.reason}` };

	let event: IDataObject;
	try {
		// Parse the raw bytes ourselves: n8n may not parse the vendor +json content type.
		event = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8')) as IDataObject;
	} catch {
		return { status: 'rejected', code: 400, reason: 'body is not JSON' };
	}
	if (input.events.length > 0 && !input.events.includes(String(event.type))) {
		return { status: 'ignored' };
	}
	return { status: 'emit', event };
}

// Staffbase documents no API to register webhooks; admins add the URL in Studio by hand,
// so there is nothing for checkExists/create/delete to call.
// eslint-disable-next-line @n8n/community-nodes/webhook-lifecycle-complete
export class StaffbaseTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Staffbase Trigger',
		name: 'staffbaseTrigger',
		icon: { light: 'file:../../icons/staffbase.svg', dark: 'file:../../icons/staffbase.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow when Staffbase sends an outbound webhook event',
		defaults: { name: 'Staffbase Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'staffbaseWebhookApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName:
					'Copy the production webhook URL above into Staffbase Studio (Settings > Extensions > Webhooks) and select the same events there',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: STAFFBASE_EVENTS,
				default: [],
				description: 'Only start for these events. Leave empty to accept every event.',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Max Signature Age (Seconds)',
						name: 'toleranceSeconds',
						type: 'number',
						typeOptions: { minValue: 0 },
						default: 300,
						description: 'Reject deliveries older than this. 0 turns the age check off.',
					},
				],
			},
		],
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const req = this.getRequestObject();
		const credentials = await this.getCredentials('staffbaseWebhookApi');
		const options = this.getNodeParameter('options', {}) as IDataObject;
		const header = req.headers['webhook-signature'];

		const result = handleDelivery({
			rawBody: (req as unknown as { rawBody?: Buffer }).rawBody,
			signatureHeader: Array.isArray(header) ? header[0] : header,
			secret: String(credentials.signingSecret ?? ''),
			events: this.getNodeParameter('events', []) as string[],
			nowSeconds: Math.floor(Date.now() / 1000),
			toleranceSeconds: (options.toleranceSeconds as number | undefined) ?? 300,
		});

		if (result.status === 'rejected') {
			this.getResponseObject().status(result.code).json({ error: result.reason });
			return { noWebhookResponse: true };
		}
		if (result.status === 'ignored') {
			return { webhookResponse: { ignored: true } };
		}
		const deliveryId = req.headers['webhook-delivery-id'];
		return {
			workflowData: [
				this.helpers.returnJsonArray([
					{ ...result.event, deliveryId: Array.isArray(deliveryId) ? deliveryId[0] : deliveryId },
				]),
			],
		};
	}
}
