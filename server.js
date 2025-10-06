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

// Common header sanitizer to allow embedding and avoid COOP/COEP issues
function relaxEmbeddingHeaders(proxyRes) {
  // Remove headers that can block embedding or cross-origin behaviors
  delete proxyRes.headers['x-frame-options'];
  if (proxyRes.headers['content-security-policy']) {
    proxyRes.headers['content-security-policy'] = proxyRes.headers['content-security-policy']
      .replace(/frame-ancestors[^;]*;?/ig, '');
  }
  delete proxyRes.headers['cross-origin-opener-policy'];
  delete proxyRes.headers['cross-origin-embedder-policy'];
}

// Reverse proxy to Matterport under /mp
const mpProxy = createProxyMiddleware({
  target: 'https://my.matterport.com',
  changeOrigin: true,
  secure: true,
  ws: true,
  onProxyReq: (proxyReq) => {
    proxyReq.setHeader('Cache-Control', 'no-cache');
    // Many MP subresources expect a same-origin Referer; supply a safe default
    proxyReq.setHeader('Referer', 'https://my.matterport.com/show/');
    proxyReq.setHeader('Origin', 'https://my.matterport.com');
    // Let JS files negotiate correctly
    if (proxyReq.path && /\.(js)(\?|$)/i.test(proxyReq.path)) {
      proxyReq.setHeader('Accept', '*/*');
    }
  },
  onProxyRes: relaxEmbeddingHeaders,
  pathRewrite: { '^/mp': '' }
});
app.use('/mp', mpProxy);

// Catch-all proxy for non-root paths so iframe subresources resolve
const mpCatchAll = createProxyMiddleware({
  target: 'https://my.matterport.com',
  changeOrigin: true,
  secure: true,
  ws: true,
  onProxyReq: (proxyReq) => {
    proxyReq.setHeader('Cache-Control', 'no-cache');
    proxyReq.setHeader('Referer', 'https://my.matterport.com/show/');
    proxyReq.setHeader('Origin', 'https://my.matterport.com');
    if (proxyReq.path && /\.(js)(\?|$)/i.test(proxyReq.path)) {
      proxyReq.setHeader('Accept', '*/*');
    }
  },
  onProxyRes: relaxEmbeddingHeaders
});

app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/index.html' || req.path === '/healthz') return next();
  return mpCatchAll(req, res, next);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});


