import * as astring from 'astring';
import * as SourceMap from 'source-map';
import * as perisopic from 'periscopic';
import { handle } from './handlers';
import { Node, Program } from 'estree';

type PrintOptions = {
	file?: string;
	sourceMapSource?: string;
	getName?: (name: string) => string;
};

function deconflict(name: string, names: Set<string>) {
	const original = name;
	let i = 1;

	while (names.has(name)) {
		name = `${original}$${i++}`;
	}

	return name;
}

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

	let { map: scope_map, scope: current_scope } = perisopic.analyze(node);
	const deconflicted = new WeakMap();

	const chunks = handle(node, {
		indent: '',
		getName,
		scope_map
	});

	let code = '';
	let mappings = [];

	for (let i = 0; i < chunks.length; i += 1) {
		// TODO add mappings
		code += chunks[i].content;
	}

	return {
		code,
		map: null
	};
}