import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';
import url from '@rollup/plugin-url'

export default {
    input: 'src/index.ts',
    output: {
        file: 'dist/extension.js',
        format: 'cjs',
        sourcemap: true,
    },
    external: [
        'vscode', 'events', 'fs', 'path',
        '@node-rs/jieba', "@node-rs/jieba-win32-x64-msvc"
    ],
    plugins: [
        url({
            include: ["src/**/*.txt?url", "src/**/*.txt"],
            limit: 0,
        }),
        nodeResolve({
            preferBuiltins: false,
        }),
        commonjs(),
        typescript({
            tsconfig: './tsconfig.json',
            sourceMap: true,
        }),
        copy({
            targets: [
                // { src: 'package.json', dest: 'dist' },
                // { src: 'README.md', dest: 'dist' }
            ]
        }),
    ]
};