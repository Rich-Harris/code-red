import * as perisopic from 'periscopic';
import { handle } from './handlers';
import { Node, Program } from 'estree';

type PrintOptions = {
	file?: string;
	sourceMapSource?: string;
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
		deconflicted
	});

	let code = '';
	let mappings = [];

	for (let i = 0; i < chunks.length; i += 1) {
		// TODO add mappings
		code += chunks[i].content;
	}

	return {
		code,
		map: {
			version: 3,
			names: [],
			// TODO
			sources: [],
			sourcesContent: [],
			mappings: ''
		}
	};
}