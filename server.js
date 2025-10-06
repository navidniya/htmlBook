import express from 'express';
import morgan from 'morgan';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5173;

app.disable('x-powered-by');
app.use(morgan('combined'));

// Serve static files with mild caching
app.use(express.static(__dirname, { etag: true, maxAge: '1h' }));

// Health check
app.get('/healthz', (_req, res) => res.status(200).send('ok'));

// Reverse proxy to Matterport under /mp
const mpProxy = createProxyMiddleware({
  target: 'https://my.matterport.com',
  changeOrigin: true,
  secure: true,
  ws: true,
  onProxyReq: (proxyReq) => {
    proxyReq.setHeader('Cache-Control', 'no-cache');
  },
  onProxyRes: (proxyRes) => {
    // Remove headers that can block embedding or cross-origin behaviors
    delete proxyRes.headers['x-frame-options'];
    if (proxyRes.headers['content-security-policy']) {
      proxyRes.headers['content-security-policy'] = proxyRes.headers['content-security-policy']
        .replace(/frame-ancestors[^;]*;?/ig, '');
    }
    delete proxyRes.headers['cross-origin-opener-policy'];
    delete proxyRes.headers['cross-origin-embedder-policy'];
  },
  pathRewrite: { '^/mp': '' }
});
app.use('/mp', mpProxy);

// Catch-all proxy for non-root paths so iframe subresources resolve
const mpCatchAll = createProxyMiddleware({
  target: 'https://my.matterport.com',
  changeOrigin: true,
  secure: true,
  ws: true
});

app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/index.html' || req.path === '/healthz') return next();
  return mpCatchAll(req, res, next);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});


