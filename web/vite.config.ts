import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Toutes les interfaces, comme --host
    host: true,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
