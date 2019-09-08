import * as acorn from 'acorn';
import * as astring from 'astring';
import * as SourceMap from 'source-map';

type PrintOptions = {
	file?: string;
};

const generator = Object.assign({}, astring.baseGenerator, {
	AwaitExpression(this: any, node: any, state: any) {
		state.write('await ');
		const { argument } = node;
		this[argument.type](argument, state);
	},

	FunctionExpression(this: any, node: any, state: any) {
		const params = [].concat(...node.params.map((param: any) => {
			if (param.type === 'SequenceExpression') {
				return param.expressions;
			}

			return param;
		}));

		return astring.baseGenerator.FunctionExpression.call(this, { ...node, params }, state);
	}
});

export function print(node: acorn.Node, opts: PrintOptions = {}) {
	const map = new SourceMap.SourceMapGenerator({
		file: opts.file
	});

	const code = astring.generate(node as any, {
		indent: '\t',
		generator
	});

	return {
		code,
		map
	};
}