import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  base: '/react-oidc-example/',
  plugins: [react()],
  server: {
    port: 8080,
  },
});
