import * as perisopic from 'periscopic';
import { handle } from './handlers';
import { Node, Program } from 'estree';
import { encode } from 'sourcemap-codec';

let btoa: (str?: string) => void = () => {
	throw new Error('Unsupported environment: `window.btoa` or `Buffer` should be supported.');
};
if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
	btoa = (str: string) => window.btoa(unescape(encodeURIComponent(str)));
} else if (typeof Buffer === 'function') {
	btoa = (str: string) => Buffer.from(str, 'utf-8').toString('base64');
}

type PrintOptions = {
	file?: string;
	sourceMapSource?: string;
	sourceMapContent?: string;
	sourceMapEncodeMappings?: boolean; // default true
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
		getName = (x: string) => {
			throw new Error(`Unhandled sigil @${x}`);
		}
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

	const map = {
		version: 3,
		names: [] as string[],
		sources: [opts.sourceMapSource || null],
		sourcesContent: [opts.sourceMapContent || null],
		mappings: opts.sourceMapEncodeMappings == undefined || opts.sourceMapEncodeMappings
			? encode(mappings) : mappings
	};

	Object.defineProperties(map, {
		toString: {
			enumerable: false,
			value: function toString() {
				return JSON.stringify(this);
			}
		},
		toUrl: {
			enumerable: false,
			value: function toUrl() {
				return 'data:application/json;charset=utf-8;base64,' + btoa(this.toString());
			}
		}
	});

	return {
		code,
		map
	};
}