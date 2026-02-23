import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    port: 5193, // Use the actual port the server is running on
    host: '0.0.0.0', // Allow connections from any host
    hmr: {
      clientPort: 5193,
      port: 5193,
      overlay: false,
      host: '0.0.0.0' // Allow HMR from any host
    },
    cors: true, // Enable CORS
    allowedHosts: [
      'unmethodizing-precongressional-hudson.ngrok-free.dev',
      'localhost',
      '127.0.0.1',
      /\.ngrok-free\.app$/,
      /\.ngrok-free\.dev$/
    ]
  }
})
