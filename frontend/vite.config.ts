import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import net from 'net'

function getRandomPort(): number {
  const usedPorts = [8080, 3000, 8000, 5000, 5173, 4200, 3001, 8001]
  const minPort = 10000
  const maxPort = 65535
  
  for (let attempt = 0; attempt < 100; attempt++) {
    const port = Math.floor(Math.random() * (maxPort - minPort + 1)) + minPort
    if (!usedPorts.includes(port)) {
      try {
        const server = net.createServer()
        server.listen(port)
        server.close()
        return port
      } catch {
        continue
      }
    }
  }
  return 10000
}

const port = getRandomPort()
console.log(`\n${'='.repeat(60)}`)
console.log(`前端开发服务器端口: ${port}`)
console.log(`访问地址: http://localhost:${port}`)
console.log(`${'='.repeat(60)}\n`)

export default defineConfig({
  plugins: [react()],
  server: {
    port: port,
    host: '0.0.0.0',
    proxy: {
        '/api': {
          target: 'http://localhost:23944',
          changeOrigin: true,
          ws: true
        },
        '/ws': {
          target: 'ws://localhost:23944',
          changeOrigin: true,
          ws: true
        }
      },
  },
})
