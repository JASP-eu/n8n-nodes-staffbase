import { describe, expect, it } from 'vitest';
import type { INodeProperties } from 'n8n-workflow';
import { Staffbase } from '../nodes/Staffbase/Staffbase.node';
import { StaffbaseTrigger } from '../nodes/StaffbaseTrigger/StaffbaseTrigger.node';
import newCommentToSlack from '../workflows/new-comment-to-slack.json';
import rssToDrafts from '../workflows/rss-to-staffbase-drafts.json';
import weeklyDigest from '../workflows/weekly-news-digest-email.json';

interface TemplateNode {
	name: string;
	type: string;
	parameters: Record<string, unknown>;
}

// Listed by hand: n8n's strict lint forbids fs here. Add every new template to this list.
const templates: Array<[string, unknown]> = [
	['new-comment-to-slack', newCommentToSlack],
	['rss-to-staffbase-drafts', rssToDrafts],
	['weekly-news-digest-email', weeklyDigest],
];
const descriptions: Record<string, INodeProperties[]> = {
	'n8n-nodes-staffbase.staffbase': new Staffbase().description.properties,
	'n8n-nodes-staffbase.staffbaseTrigger': new StaffbaseTrigger().description.properties,
};

// A template that names a parameter or option the node lacks imports silently and does nothing.
describe.each(templates)('workflow template %s', (_file, json) => {
	const workflow = json as { nodes: TemplateNode[]; connections: Record<string, unknown> };

	it('connects only nodes that exist', () => {
		const names = new Set(workflow.nodes.map((n) => n.name));
		for (const from of Object.keys(workflow.connections)) expect(names).toContain(from);
	});

	it('uses only parameters and option values the Staffbase nodes define', () => {
		const ours = workflow.nodes.filter((n) => n.type in descriptions);
		expect(ours.length).toBeGreaterThan(0);
		for (const node of ours) {
			const props = descriptions[node.type];
			for (const [key, value] of Object.entries(node.parameters)) {
				const candidates = props.filter((p) => p.name === key);
				expect(candidates, `${node.name}: unknown parameter "${key}"`).not.toHaveLength(0);
				const optionValues = candidates.flatMap((p) =>
					(p.options ?? []).map((o) => ('value' in o ? o.value : 'name' in o ? o.name : undefined)),
				);
				const isCollection = candidates.some((p) => p.type === 'collection');
				if (isCollection && value && typeof value === 'object') {
					for (const sub of Object.keys(value)) {
						expect(optionValues, `${node.name}: unknown field "${key}.${sub}"`).toContain(sub);
					}
				} else if (typeof value === 'string' && !value.startsWith('=') && optionValues.length > 0) {
					expect(optionValues, `${node.name}: "${key}" = "${value}"`).toContain(value);
				}
			}
		}
	});
});
