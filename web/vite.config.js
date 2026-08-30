import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  base: '/diet/',
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString())
  },
  // ponytail: basicSsl only runs for `vite dev` (its own `apply: 'serve'`), never
  // for `vite build`/deploy — it exists so testing on a phone over LAN gets a
  // secure context, required for getUserMedia/BarcodeDetector camera scanning.
  plugins: [tailwindcss(), svelte(), basicSsl()],
  server: {
    host: true
  },
  resolve: {
    alias: {
      '$lib': fileURLToPath(new URL('./src/lib', import.meta.url))
    }
  },
  optimizeDeps: {
    exclude: ['@lucide/svelte', 'bits-ui']
  }
})
