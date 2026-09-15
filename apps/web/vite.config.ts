import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // One shared .env at the monorepo root instead of a separate apps/web/.env
  // — see .env.example there.
  envDir: '../../',
})
