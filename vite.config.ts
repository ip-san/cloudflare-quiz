/**
 * Vite Configuration
 *
 * GitHub Pages にデプロイする PWA のビルド設定。
 */

import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/cloudflare-quiz/',

  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,json,png,svg,ico}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        skipWaiting: true,
        clientsClaim: true,
        // Clean old caches on activate
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'Cloudflare Quiz',
        short_name: 'CF Quiz',
        description: 'Cloudflare をプロダクト開発に活かすための学習クイズアプリ',
        theme_color: '#F6821F',
        background_color: '#F6821F',
        display: 'standalone',
        scope: '/cloudflare-quiz/',
        start_url: '/cloudflare-quiz/',
        icons: [
          { src: 'icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        orientation: 'portrait' as const,
        shortcuts: [{ name: 'クイックスタート', url: '/cloudflare-quiz/', description: 'クイズをすぐ開始' }],
      },
    }),
  ],

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // quiz-data chunk is intentionally split out so the initial JS stays small.
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('quizzes.json')) return 'quiz-data'
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'vendor'
        },
      },
    },
  },

  server: {
    port: 5174,
    host: true, // LAN公開: 同じWiFiのスマホから http://PCのIP:5174 でアクセス可能
  },
})
