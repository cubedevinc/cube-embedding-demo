import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  // Automatically set VITE_CUBE_API_URL from CUBE_API_URL if not provided
  const cubeApiUrl = env.VITE_CUBE_API_URL || env.CUBE_API_URL;

  if (!cubeApiUrl) {
    throw new Error(
      'CUBE_API_URL environment variable is required. Please set it in your .env file or as an environment variable.'
    );
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      'import.meta.env.VITE_CUBE_API_URL': JSON.stringify(cubeApiUrl),
    },
    server: {
      port: 3002,
      proxy: {
        '/api': {
          target: env.CUBE_API_URL || cubeApiUrl,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
    },
  };
});

