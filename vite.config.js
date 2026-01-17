import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    allowedHosts: [
      'db45323d2527.ngrok-free.app',
      'd4a1d67ab524.ngrok-free.app',
      'a4312e51d73f.ngrok-free.app',
      '6029258da1bf.ngrok-free.app',
      '94035653dfa8.ngrok-free.app',
      '71ac22027af7.ngrok-free.app',
      'unmethodizing-precongressional-hudson.ngrok-free.dev',
      /\.ngrok-free\.app$/ // allow any ngrok-free.app subdomain for convenience
    ],
  },
})
