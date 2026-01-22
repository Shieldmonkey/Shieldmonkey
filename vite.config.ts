import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
// import { viteStaticCopy } from 'vite-plugin-static-copy'
import manifest from './src/manifest.json'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    // viteStaticCopy({
    //   targets: [
    //     {
    //       src: 'node_modules/monaco-editor/min/vs',
    //       dest: 'monaco-vs'
    //     }
    //   ]
    // })
  ],
  build: {
    minify: false,
    sourcemap: 'inline'
  }
})
