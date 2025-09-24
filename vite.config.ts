import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    resolve: {},
    build: {
        minify: false,
        lib: {
            entry: {
                extension: resolve(__dirname, 'src/index.ts')
            },
            formats: ["cjs"],
            fileName: 'extension',
        },
        sourcemap: true,
        rollupOptions: {
            external: ['vscode', 'events'],
            output: {
                dir: 'dist',
                entryFileNames: '[name].js',
                format: 'cjs',
                exports: 'named'
            }
        },
    },
});