import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

function devFileWriterPlugin() {
  return {
    name: 'dev-file-writer',
    configureServer(server) {
      server.middlewares.use('/api/write-file', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('Method not allowed'); return; }
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
          try {
            const { filePath, content } = JSON.parse(body);
            const fs = await import('fs');
            const path = await import('path');
            const fullPath = path.default.resolve(process.cwd(), filePath);
            if (!fullPath.startsWith(path.default.resolve(process.cwd(), 'public/data'))) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: 'Can only write to public/data/' }));
              return;
            }
            const dir = path.default.dirname(fullPath);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(fullPath, content, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });

      server.middlewares.use('/api/upload-audio', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end('Method not allowed'); return; }
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', async () => {
          try {
            const filePath = req.headers['x-file-path'];
            if (!filePath) { res.statusCode = 400; res.end(JSON.stringify({ error: 'Missing x-file-path header' })); return; }
            const fs = await import('fs');
            const path = await import('path');
            const fullPath = path.default.resolve(process.cwd(), filePath);
            if (!fullPath.startsWith(path.default.resolve(process.cwd(), 'public/data'))) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: 'Can only write to public/data/' }));
              return;
            }
            const dir = path.default.dirname(fullPath);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(fullPath, Buffer.concat(chunks));
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/Novel/' : '/',
  plugins: [
    react(),
    devFileWriterPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Cố Nguyên Giới · 固元界',
        short_name: '固元界',
        description: 'Interactive historical fantasy world map',
        theme_color: '#1a1209',
        background_color: '#1a1209',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,csv}']
      }
    })
  ],
  server: {},
})
