import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import manifest from './src/manifest.json'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const plugins = [
    react(),
    crx({ manifest }),
  ];

  const copyTargets = [
    {
      src: 'src/locales/*',
      dest: '_locales'
    }
  ];

  if (mode === 'development') {
    copyTargets.push({
      src: 'examples',
      dest: '.'
    });
  }

  plugins.push(
    viteStaticCopy({
      targets: copyTargets
    })
  );

  return {
    plugins,
    define: {
      '__DEV__': mode === 'development'
    },
    build: {
      minify: process.env.ENABLE_MINIFY === 'true',
      sourcemap: process.env.DISABLE_SOURCEMAP === 'true' ? false : true,
      rollupOptions: {
        input: {
        }
      }
    }
  };
})
