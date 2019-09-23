// heavily based on https://github.com/davidbonnet/astring
// released under MIT license https://github.com/davidbonnet/astring/blob/master/LICENSE

import {
	Node,
	CallExpression,
	Program,
	ExpressionStatement,
	Identifier,
	ObjectExpression,
	Property,
	Literal,
	RegExpLiteral,
	AssignmentExpression,
	BinaryExpression,
	FunctionDeclaration,
	BlockStatement,
	ReturnStatement,
	IfStatement,
	LabeledStatement,
	BreakStatement,
	ContinueStatement,
	WithStatement,
	SwitchStatement,
	ThrowStatement,
	TryStatement,
	WhileStatement,
	DoWhileStatement,
	ForStatement,
	VariableDeclaration,
	VariableDeclarator,
	ClassDeclaration,
	ImportDeclaration,
	ExportDefaultDeclaration,
	ExportNamedDeclaration,
	ExportAllDeclaration,
	MethodDefinition,
	ArrowFunctionExpression,
	RestElement,
	YieldExpression,
	AwaitExpression,
	TaggedTemplateExpression,
	TemplateLiteral,
	ArrayExpression,
	ObjectPattern,
	SequenceExpression,
	UnaryExpression,
	UpdateExpression,
	Expression,
	AssignmentPattern,
	ConditionalExpression,
	NewExpression,
	MemberExpression,
	MetaProperty
} from 'estree';

type Chunk = {
	content: string;
	loc?: {
		start: { line: number; column: number; };
		end: { line: number; column: number; };
	};
};

type Handler = (node: Node, state: State) => Chunk[];

type State = {
	indent: string;
	getName: (name: string) => string;
};

export function handle(node: Node, state: State): Chunk[] {
	const handler: Handler = handlers[node.type];

	if (!handler) {
		throw new Error(`Not implemented ${node.type}`);
	}

	return handler(node, state);
}

const OPERATOR_PRECEDENCE = {
	'||': 3,
	'&&': 4,
	'|': 5,
	'^': 6,
	'&': 7,
	'==': 8,
	'!=': 8,
	'===': 8,
	'!==': 8,
	'<': 9,
	'>': 9,
	'<=': 9,
	'>=': 9,
	in: 9,
	instanceof: 9,
	'<<': 10,
	'>>': 10,
	'>>>': 10,
	'+': 11,
	'-': 11,
	'*': 12,
	'%': 12,
	'/': 12,
	'**': 13,
};

// Enables parenthesis regardless of precedence
const NEEDS_PARENTHESES = 17;

const EXPRESSIONS_PRECEDENCE: Record<string, number> = {
	ArrayExpression: 20,
	TaggedTemplateExpression: 20,
	ThisExpression: 20,
	Identifier: 20,
	Literal: 18,
	TemplateLiteral: 20,
	Super: 20,
	SequenceExpression: 20,
	MemberExpression: 19,
	CallExpression: 19,
	NewExpression: 19,
	ArrowFunctionExpression: NEEDS_PARENTHESES,
	ClassExpression: NEEDS_PARENTHESES,
	FunctionExpression: NEEDS_PARENTHESES,
	ObjectExpression: NEEDS_PARENTHESES,
	UpdateExpression: 16,
	UnaryExpression: 15,
	BinaryExpression: 14,
	LogicalExpression: 13,
	ConditionalExpression: 4,
	AssignmentExpression: 3,
	AwaitExpression: 2,
	YieldExpression: 2,
	RestElement: 1
};

function needs_parens(node: Expression, parent: BinaryExpression, is_right: boolean) {
	const precedence = EXPRESSIONS_PRECEDENCE[node.type];

	if (precedence === NEEDS_PARENTHESES) {
		return true;
	}

	const parent_precedence = EXPRESSIONS_PRECEDENCE[parent.type];

	if (precedence !== parent_precedence) {
		// Different node types
		return (
			(!is_right &&
				precedence === 15 &&
				parent_precedence === 14 &&
				parent.operator === '**') ||
			precedence < parent_precedence
		);
	}

	if (precedence !== 13 && precedence !== 14) {
		// Not a `LogicalExpression` or `BinaryExpression`
		return false;
	}

	if ((node as BinaryExpression).operator === '**' && parent.operator === '**') {
		// Exponentiation operator has right-to-left associativity
		return !is_right;
	}

	if (is_right) {
		// Parenthesis are used if both operators have the same precedence
		return (
			OPERATOR_PRECEDENCE[(node as BinaryExpression).operator] <=
			OPERATOR_PRECEDENCE[parent.operator]
		);
	}

	return (
		OPERATOR_PRECEDENCE[(node as BinaryExpression).operator] <
		OPERATOR_PRECEDENCE[parent.operator]
	);
}

const has_newline = (chunks: Chunk[]) => {
	for (let i = 0; i < chunks.length; i += 1) {
		if (/\n/.test(chunks[i].content)) return true;
	}
	return false;
};

const length = (chunks: Chunk[]) => {
	let total = 0;
	for (let i = 0; i < chunks.length; i += 1) {
		total += chunks[i].content.length;
	}
	return total;
};

const sum = (a: number, b: number) => a + b;

const join = (nodes: Chunk[][], separator: Chunk): Chunk[] => {
	if (nodes.length === 0) return [];
	const joined: Chunk[] = [...nodes[0]];
	for (let i = 1; i < nodes.length; i += 1) {
		joined.push(separator, ...nodes[i] as Chunk[]);
	}
	return joined;
};

const handlers: Record<string, Handler> = {
	Program(node: Program, state) {
		const chunks = [];

		for (let i = 0; i < node.body.length; i += 1) {
			const statement = handle(node.body[i], state);
			chunks.push(...statement);
		}

		return chunks;
	},

	BlockStatement(node: BlockStatement, state: State) {
		const chunks = [{ content: `{\n${state.indent}\t` }];

		const body = node.body.map(statement => handle(statement, {
			...state,
			indent: state.indent + '\t'
		}));

		let needed_padding = false;

		for (let i = 0; i < body.length; i += 1) {
			const needs_padding = has_newline(body[i]);

			if (i > 0) {
				chunks.push({ content: needs_padding || needed_padding ? `\n\n${state.indent}\t` : `\n${state.indent}\t` });
			}

			chunks.push(
				...body[i]
			);

			needed_padding = needs_padding;
		}

		chunks.push({ content: `\n${state.indent}}` });

		return chunks;
	},

	EmptyStatement(node, state) {
		return [];
	},

	ExpressionStatement(node: ExpressionStatement, state) {
		const precedence = EXPRESSIONS_PRECEDENCE[node.expression.type]
		if (
			precedence === NEEDS_PARENTHESES ||
			(precedence === 3 && node.expression.left.type[0] === 'O')
		) {
			// Should always have parentheses or is an AssignmentExpression to an ObjectPattern
			return [
				{ content: '(' },
				...handle(node.expression, state),
				{ content: ');' }
			];
		}

		return [
			...handle(node.expression, state),
			{ content: ';' }
		];
	},

	IfStatement(node: IfStatement, state) {
		throw new Error(`TODO IfStatement`);
	},

	LabeledStatement(node: LabeledStatement, state) {
		throw new Error(`TODO LabeledStatement`);
	},

	BreakStatement(node: BreakStatement, state) {
		throw new Error(`TODO BreakStatement`);
	},

	ContinueStatement(node: ContinueStatement, state) {
		throw new Error(`TODO ContinueStatement`);
	},

	WithStatement(node: WithStatement, state) {
		throw new Error(`TODO WithStatement`);
	},

	SwitchStatement(node: SwitchStatement, state) {
		throw new Error(`TODO SwitchStatement`);
	},

	ReturnStatement(node: ReturnStatement, state) {
		return [
			{ content: 'return ' },
			...handle(node.argument, state),
			{ content: ';' }
		];
	},

	ThrowStatement(node: ThrowStatement, state) {
		throw new Error(`TODO ThrowStatement`);
	},

	TryStatement(node: TryStatement, state) {
		throw new Error(`TODO TryStatement`);
	},

	WhileStatement(node: WhileStatement, state) {
		throw new Error(`TODO WhileStatement`);
	},

	DoWhileStatement(node: DoWhileStatement, state) {
		throw new Error(`TODO DoWhileStatement`);
	},

	ForStatement(node: ForStatement, state) {
		throw new Error(`TODO ForStatement`);
	},

	DebuggerStatement(node, state) {
		return [{ content: 'debugger', loc: node.loc }, { content: ';' }];
	},

	FunctionDeclaration(node: FunctionDeclaration, state) {
		const chunks = [];

		if (node.async) chunks.push({ content: 'async '});
		chunks.push({ content: node.generator ? 'function* ' : 'function ' });
		if (node.id) chunks.push({ content: node.id.name, loc: node.id.loc });
		chunks.push({ content: '(' });

		const params = node.params.map(p => handle(p, {
			...state,
			indent: state.indent + '\t'
		}));

		const multiple_lines = (
			params.some(has_newline) ||
			(params.map(length).reduce(sum, 0) + (state.indent.length + params.length - 1) * 2) > 80
		);

		const separator = { content: multiple_lines ? `,\n${state.indent}` : ', ' };

		if (multiple_lines) {
			chunks.push(
				{ content: `\n${state.indent}\t` },
				...join(params, separator),
				{ content: `\n${state.indent}` }
			);
		} else {
			chunks.push(
				...join(params, separator)
			);
		}

		chunks.push(
			{ content: ') ' },
			...handle(node.body, state)
		);

		return chunks;
	},

	VariableDeclaration(node: VariableDeclaration, state) {
		throw new Error(`TODO VariableDeclaration`);
	},

	VariableDeclarator(node: VariableDeclarator, state) {
		throw new Error(`TODO VariableDeclarator`);
	},

	ClassDeclaration(node: ClassDeclaration, state) {
		throw new Error(`TODO ClassDeclaration`);
	},

	ImportDeclaration(node: ImportDeclaration, state) {
		throw new Error(`TODO ImportDeclaration`);
	},

	ExportDefaultDeclaration(node: ExportDefaultDeclaration, state) {
		throw new Error(`TODO ExportDefaultDeclaration`);
	},

	ExportNamedDeclaration(node: ExportNamedDeclaration, state) {
		throw new Error(`TODO ExportNamedDeclaration`);
	},

	ExportAllDeclaration(node: ExportAllDeclaration, state) {
		throw new Error(`TODO ExportAllDeclaration`);
	},

	MethodDefinition(node: MethodDefinition, state) {
		throw new Error(`TODO MethodDefinition`);
	},

	ArrowFunctionExpression(node: ArrowFunctionExpression, state) {
		throw new Error(`TODO ArrowFunctionExpression`);
	},
	ThisExpression(node, state) {
		return [{ content: 'this', loc: node.loc }];
	},
	Super(node, state) {
		return [{ content: 'super', loc: node.loc }];
	},
	RestElement(node: RestElement, state) {
		throw new Error(`TODO RestElement`);
	},

	YieldExpression(node: YieldExpression, state) {
		throw new Error(`TODO YieldExpression`);
	},

	AwaitExpression(node: AwaitExpression, state) {
		throw new Error(`TODO AwaitExpression`);
	},

	TemplateLiteral(node: TemplateLiteral, state) {
		throw new Error(`TODO TemplateLiteral`);
	},

	TaggedTemplateExpression(node: TaggedTemplateExpression, state) {
		throw new Error(`TODO TaggedTemplateExpression`);
	},

	ArrayExpression(node: ArrayExpression, state) {
		throw new Error(`TODO ArrayExpression`);
	},

	ObjectExpression(node: ObjectExpression, state) {
		const properties = node.properties.map(p => handle(p, {
			...state,
			indent: state.indent + '\t'
		}));

		const multiple_lines = (
			properties.some(has_newline) ||
			(properties.map(length).reduce(sum, 0) + (state.indent.length + properties.length - 1) * 2) > 80
		);

		const separator = { content: multiple_lines ? ',\n' + state.indent : ', ' };

		return [
			{ content: multiple_lines ? `{\n${state.indent}` : `{ ` },
			...join(properties, separator) as Chunk[],
			{ content: multiple_lines ? `\n${state.indent}}` : ` }` }
		];
	},

	Property(node: Property, state) {
		const key = handle(node.key, state);
		const value = handle(node.value, state);

		if (key.length === 1 && value.length === 1 && key[0].content === value[0].content) {
			return value;
		}


		if (node.method || node.kind !== 'init') {
			throw new Error('TODO');
		}

		return [
			...key,
			{ content: ': ' },
			...value
		];
	},

	ObjectPattern(node: ObjectPattern, state) {
		throw new Error(`TODO ObjectPattern`);
	},

	SequenceExpression(node: SequenceExpression, state) {
		throw new Error(`TODO SequenceExpression`);
	},

	UnaryExpression(node: UnaryExpression, state) {
		throw new Error(`TODO UnaryExpression`);
	},

	UpdateExpression(node: UpdateExpression, state) {
		throw new Error(`TODO UpdateExpression`);
	},

	AssignmentExpression(node: AssignmentExpression, state) {
		return [
			...handle(node.left, state),
			{ content: ` ${node.operator} ` },
			...handle(node.right, state)
		];
	},

	AssignmentPattern(node: AssignmentPattern, state) {
		throw new Error(`TODO AssignmentPattern`);
	},

	BinaryExpression(node: BinaryExpression, state) {
		const chunks = [];

		const is_in = node.operator === 'in'
		if (is_in) {
			// Avoids confusion in `for` loops initializers
			chunks.push({ content: '(' });
		}

		if (needs_parens(node.left, node, false)) {
			chunks.push(
				{ content: '(' },
				...handle(node.left, state),
				{ content: ')' }
			);
		} else {
			chunks.push(...handle(node.left, state));
		}

		chunks.push({ content: ` ${node.operator} ` });

		if (needs_parens(node.right, node, true)) {
			chunks.push(
				{ content: '(' },
				...handle(node.right, state),
				{ content: ')' }
			);
		} else {
			chunks.push(...handle(node.right, state));
		}

		return chunks;
	},

	ConditionalExpression(node: ConditionalExpression, state) {
		throw new Error(`TODO ConditionalExpression`);
	},

	NewExpression(node: NewExpression, state) {
		throw new Error(`TODO NewExpression`);
	},

	CallExpression(node: CallExpression, state) {
		const chunks = [];

		if (
			EXPRESSIONS_PRECEDENCE[node.callee.type] <
			EXPRESSIONS_PRECEDENCE.CallExpression
		) {
			chunks.push(
				{ content: '(' },
				...handle(node.callee, state),
				{ content: ')' }
			);
		} else {
			chunks.push(...handle(node.callee, state));
		}

		const args = node.arguments.map(arg => handle(arg, {
			...state,
			indent: state.indent + '\t'
		}));

		const separator = args.some(has_newline) // TODO or length exceeds 80
			? { content: ',\n' + state.indent }
			: { content: ', ' };

		chunks.push(
			{ content: '(' },
			...join(args, separator) as Chunk[],
			{ content: ')' }
		);

		return chunks;
	},

	MemberExpression(node: MemberExpression, state) {
		throw new Error(`TODO MemberExpression`);
	},

	MetaProperty(node: MetaProperty, state) {
		throw new Error(`TODO MetaProperty`);
	},

	Identifier(node: Identifier, state) {
		let name = node.name;
		if (name[0] === '@') name = state.getName(name.slice(1));
		return [{ content: name, loc: node.loc }];
	},

	Literal(node: Literal | RegExpLiteral, state) {
		// TODO
		if (typeof node.value === 'string') {
			return [{ content: JSON.stringify(node.value), loc: node.loc }];
		}

		const { regex } = node as RegExpLiteral; // TODO is this right?
		if (regex) {
			return [{ content: `/${regex.pattern}/${regex.flags}`, loc: node.loc }];
		}

		return [{ content: String(node.value), loc: node.loc }];
	},

	RegExpLiteral(node: RegExpLiteral, state) {
		throw new Error(`TODO RegExpLiteral`);
	},
};

handlers.ForInStatement = handlers.ForOfStatement = handlers.ForStatement;
handlers.FunctionExpression = handlers.FunctionDeclaration;
handlers.ClassExpression = handlers.ClassDeclaration;
handlers.ClassBody = handlers.BlockStatement;
handlers.SpreadElement = handlers.RestElement;
handlers.ArrayPattern = handlers.ArrayExpression;
handlers.LogicalExpression = handlers.BinaryExpression;