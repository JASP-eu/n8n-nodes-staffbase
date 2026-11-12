import type { Icon, ICredentialType, INodeProperties } from 'n8n-workflow';

// A signing secret cannot be checked against Staffbase; only incoming deliveries prove it.
// eslint-disable-next-line @n8n/community-nodes/credential-test-required
export class StaffbaseWebhookApi implements ICredentialType {
	name = 'staffbaseWebhookApi';

	displayName = 'Staffbase Webhook Signing Secret API';

	icon: Icon = { light: 'file:../icons/staffbase.svg', dark: 'file:../icons/staffbase.dark.svg' };

	documentationUrl = 'https://developers.staffbase.com/guides/manage-outbound-webhooks/';

	properties: INodeProperties[] = [
		{
			displayName: 'Signing Secret',
			name: 'signingSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'Signing secret of the webhook in Staffbase Studio (Settings > Extensions > Webhooks)',
			required: true,
		},
	];
}
