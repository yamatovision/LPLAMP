import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: true,
    hmr: {
      port: 3001
    },
    // Codespaces環境での開発サーバー最適化
    fs: {
      allow: ['..']
    }
  },
  preview: {
    port: 4173,
    host: '0.0.0.0',
    strictPort: true
  },
  build: {
    // Codespaces環境でのビルド最適化
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom']
        }
      }
    }
  },
  // 環境変数の設定
  define: {
    __CODESPACES__: JSON.stringify(process.env.CODESPACES === 'true'),
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development')
  }
})