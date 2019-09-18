import * as astring from 'astring';
// import * as SourceMap from 'source-map';
import * as perisopic from 'periscopic';
import { Node } from 'estree';

type PrintOptions = {
	file?: string;
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

export function print(node: Node, opts: PrintOptions = {}) {
	const {
		getName = (x: string) => x
	} = opts;

	let { map: scope_map, scope: current_scope } = perisopic.analyze(node);
	const deconflicted = new WeakMap();

	const set_scope = (type: string) => function(this: any, node: any, state: any) {
		const previous_scope = current_scope;
		current_scope = scope_map.get(node);
		(astring.baseGenerator as any)[type].call(this, node, state);
		current_scope = previous_scope;
	};

	const generator = Object.assign({}, astring.baseGenerator, {
		handle(this: any, node: any, state: any) {
			if (Array.isArray(node)) {
				console.log(node);
				throw new Error('we have an array where there probably should not be an array');
				for (let i = 0; i < node.length; i += 1) {
					this.handle(node[i], state);
					if (i < node.length - 1) {
						state.write(state.lineEnd);
						state.write(state.indent);
					}
				}

				return;
			}

			if (!node.type) {
				console.log(`missing type: `, node);
			}

			if (!this[node.type]) {
				console.log(node);
				throw new Error(`Not implemented: ${node.type}`);
			}

			try {
				this[node.type](node, state);
			} catch (err) {
				if (!err.depth) {
					console.log(`${err.message} while handling`, JSON.stringify(node, null, '  '));
					err.depth = 1;
				} else if (err.depth <= 2) {
					console.log(`${err.depth}:`, JSON.stringify(node, null, '  '));
					err.depth += 1;
				}

				throw err;
			}
		},

		ArrowFunctionExpression: set_scope('ArrowFunctionExpression'),
		BlockStatement: set_scope('BlockStatement'),
		CatchClause: set_scope('CatchClause'),
		ForStatement: set_scope('ForStatement'),
		ForInStatement: set_scope('ForInStatement'),
		ForOfStatement: set_scope('ForOfStatement'),
		FunctionDeclaration: set_scope('FunctionDeclaration'),
		FunctionExpression: set_scope('FunctionExpression'),

		Identifier(this: any, node: any, state: any) {
			if (!node.name) {
				console.log(node);
			}

			if (node.name[0] === '@') {
				const name = getName(node.name.slice(1));
				state.write(name, node);
			}

			else if (node.name[0] === '#') {
				const owner = current_scope.find_owner(node.name);

				if (!owner) {
					console.log(node);
					throw new Error(`Could not find owner for node`);
				}

				if (!deconflicted.has(owner)) {
					deconflicted.set(owner, new Map());
				}

				const deconflict_map = deconflicted.get(owner);

				if (!deconflict_map.has(node.name)) {
					deconflict_map.set(node.name, deconflict(node.name.slice(1), owner.references));
				}

				const name = deconflict_map.get(node.name);
				state.write(name, node);
			}

			else {
				state.write(node.name, node);
			}
		},

		Literal(this: any, node: any, state: any) {
			if (typeof node.value === 'string') {
				state.write(JSON.stringify(node.value));
				return;
			}

			astring.baseGenerator.Literal.call(this, node, state);
		}
	});

	// const map = new SourceMap.SourceMapGenerator({
	// 	file: opts.file
	// });

	const code = astring.generate(node as any, {
		indent: '\t',
		generator
	});

	return {
		code,
		map: null as any
	};
}