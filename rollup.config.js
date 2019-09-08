import sucrase from 'rollup-plugin-sucrase';
import pkg from './package.json';

export default {
	input: 'src/index.ts',
	output: [
		{ file: pkg.main, format: 'umd', name: 'CodeRed' },
		{ file: pkg.module, format: 'esm' }
	],
	plugins: [
		sucrase({
			transforms: ['typescript']
		})
	]
};
