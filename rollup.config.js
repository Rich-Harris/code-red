import sucrase from '@rollup/plugin-sucrase';
import resolve from '@rollup/plugin-node-resolve';
import pkg from './package.json';
import path from 'path';

export default {
	input: 'src/index.ts',
	output: [
		{ file: pkg.main, format: 'umd', name: 'CodeRed' },
		{ file: pkg.module, format: 'esm' },
	],
	plugins: [
		resolve({
			extensions: ['.js', '.ts'],
			jail: path.resolve(__dirname, 'src'),
		}),
		sucrase({
			transforms: ['typescript'],
		}),
	],
};
