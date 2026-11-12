import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class StaffbaseApi implements ICredentialType {
	name = 'staffbaseApi';

	displayName = 'Staffbase API';

	icon: Icon = { light: 'file:../icons/staffbase.svg', dark: 'file:../icons/staffbase.dark.svg' };

	documentationUrl = 'https://developers.staffbase.com/concepts/authentication/';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://app.staffbase.com/api',
			placeholder: 'https://yourapp.staffbase.com/api',
			description:
				'API base URL of your Staffbase app, shown next to the token in Staffbase Studio',
			required: true,
		},
		{
			displayName: 'API Token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'API token created on the API token page in Staffbase Studio',
			required: true,
		},
	];

	// Staffbase expects the token as-is after "Basic", without base64 encoding.
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Basic {{$credentials.apiToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/+$/, "")}}',
			url: '/channels',
			method: 'GET',
			qs: { limit: 1 },
		},
	};
}
