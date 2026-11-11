import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0', // 监听所有网卡，局域网内其他机器可通过本机 IP 访问
    port: 5173,
    open: true,
    // 开发态把 /api 代理到本机 Spring Boot 后端（8081），免去跨域
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8081',
        changeOrigin: true
      }
    }
  }
})
