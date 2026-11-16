import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  /* BASE_PATH is the folder the app lives in once online.
     GitHub Pages: "/Peydro-Capital-Alliance-CRM/" (set by .github/workflows/deploy.yml).
     Own subdomain or your computer: "/" (the default). */
  const env = loadEnv(mode, '.', '');
  return {
    base: env.BASE_PATH || '/',
    plugins: [react()],
    server: { port: 5174 },
  };
});
