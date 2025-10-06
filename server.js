import express from 'express';
import morgan from 'morgan';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5173;

app.use(morgan('dev'));

// Serve static files (your site)
app.use(express.static(__dirname));

// Reverse proxy to Matterport under /mp
app.use('/mp', createProxyMiddleware({
  target: 'https://my.matterport.com',
  changeOrigin: true,
  secure: true,
  ws: true,
  onProxyReq: (proxyReq) => {
    // Ensure no caching of proxied assets for quick testing
    proxyReq.setHeader('Cache-Control', 'no-cache');
  },
  pathRewrite: {
    '^/mp': ''
  }
}));

// Catch-all proxy for any non-root path to ensure iframe subresources load
const mpCatchAll = createProxyMiddleware({
  target: 'https://my.matterport.com',
  changeOrigin: true,
  secure: true,
  ws: true
});

app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/index.html') return next();
  return mpCatchAll(req, res, next);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});


