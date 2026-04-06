import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    /** Слушать 0.0.0.0 — открывается и как localhost, и по LAN (телефон в той же Wi‑Fi) */
    host: true,
    port: 5173,
    strictPort: false,
    headers: {
      'Cache-Control': 'no-store',
    },
  },
});
