import * as perisopic from 'periscopic';
import { handle } from './handlers';
import { Node, Program } from 'estree';
import { encode } from 'sourcemap-codec';

type PrintOptions = {
	file?: string;
	sourceMapSource?: string;
	sourceMapContent?: string;
	getName?: (name: string) => string;
};

export function print(node: Node, opts: PrintOptions = {}): { code: string, map: any } {
	if (Array.isArray(node)) {
		return print({
			type: 'Program',
			body: node
		} as unknown as Program, opts);
	}

	const {
		getName = (x: string) => x
	} = opts;

	let { map: scope_map, scope } = perisopic.analyze(node);
	const deconflicted = new WeakMap();

	const chunks = handle(node, {
		indent: '',
		getName,
		scope,
		scope_map,
		deconflicted,
		comments: []
	});

	type Segment = [number, number, number, number];

	let code = '';
	let mappings: Segment[][] = [];
	let current_line: Segment[] = [];
	let current_column = 0;

	for (let i = 0; i < chunks.length; i += 1) {
		const chunk = chunks[i];

		code += chunk.content;

		if (chunk.loc) {
			current_line.push([
				current_column,
				0, // source index is always zero
				chunk.loc.start.line - 1,
				chunk.loc.start.column,
			]);
		}

		for (let i = 0; i < chunk.content.length; i += 1) {
			if (chunk.content[i] === '\n') {
				mappings.push(current_line);
				current_line = [];
				current_column = 0;
			} else {
				current_column += 1;
			}
		}

		if (chunk.loc) {
			current_line.push([
				current_column,
				0, // source index is always zero
				chunk.loc.end.line - 1,
				chunk.loc.end.column,
			]);
		}
	}

	mappings.push(current_line);

	return {
		code,
		map: {
			version: 3,
			names: [],
			sources: [opts.sourceMapSource || null],
			sourcesContent: [opts.sourceMapContent || null],
			mappings: encode(mappings)
		}
	};
}