import { Comment, Node } from 'estree';
import { re } from './id';

export interface CommentWithLocation extends Comment {
	start: number;
	end: number;
}

export const get_comment_handlers = (comments: CommentWithLocation[], raw: string) => ({

	// pass to acorn options
	onComment: (block: boolean, value: string, start: number, end: number) => {
		if (block && /\n/.test(value)) {
			let a = start;
			while (a > 0 && raw[a - 1] !== '\n') a -= 1;

			let b = a;
			while (/[ \t]/.test(raw[b])) b += 1;

			const indentation = raw.slice(a, b);
			value = value.replace(new RegExp(`^${indentation}`, 'gm'), '');
		}

		comments.push({ type: block ? 'Block' : 'Line', value, start, end });
	},

	// pass to estree-walker options
	enter(node: Node) {
		let comment;

		while (comments[0] && comments[0].start < (node as any).start) {
			comment = comments.shift();

			comment.value = comment.value.replace(re, (match, id, at, hash, value) => {
				if (hash) return `#${value}`;
				if (at) return `@${value}`;

				return match;
			});

			const next = comments[0] || node;
			(comment as any).has_trailing_newline = (
				comment.type === 'Line' ||
				/\n/.test(raw.slice(comment.end, (next as any).start))
			);

			(node.leadingComments || (node.leadingComments = [])).push(comment);
		}
	},
	leave(node: Node) {
		if (comments[0]) {
			const slice = raw.slice((node as any).end, comments[0].start);

			if (/^[,) \t]*$/.test(slice)) {
				node.trailingComments = [comments.shift()];
			}
		}
	}

});
