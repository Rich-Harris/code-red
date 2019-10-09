module.exports = ({ b }) => {
	const bar = b`import { bar } from 'y';`[0];

	return b`
	import { foo as #foo } from 'x';
	${bar};`
};