import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['.loca.lt', '.ngrok-free.app', '.ngrok-free.dev', '.ngrok.io'],
    proxy: {
      '/colyseus': {
        target: 'http://localhost:2567',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/colyseus/, ''),
      },
    },
  },
});
