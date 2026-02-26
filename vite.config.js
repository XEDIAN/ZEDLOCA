import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    port: 5193, // Use the actual port the server is running on
    host: true, // Allow connections from any host (equivalent to 0.0.0.0)
    hmr: {
      overlay: false, // Disable the error overlay for cleaner console
    },
    cors: true, // Enable CORS
    allowedHosts: [
      'all',
      'unmethodizing-precongressional-hudson.ngrok-free.dev'
    ]
  }
})
