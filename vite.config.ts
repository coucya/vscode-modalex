import { defineConfig } from 'vite';

export default defineConfig({
    resolve: {},
    build: {
        minify: true,
        lib: {
            entry: {
                "extension": "./src/index.ts"
            },
            formats: ["cjs"],
        },
        sourcemap: true,
        rollupOptions: {
            input: {
                "extension": "./src/index.ts"
            },
            output: {
                dir: 'dist',
                entryFileNames: "[name].js"
            },
            external: [
                "vscode",
                "events"
            ]
        },
    },
});