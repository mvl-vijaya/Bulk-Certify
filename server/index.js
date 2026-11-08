import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';

import analyzeRouter from './routes/analyze.js';
import parseDataRouter from './routes/parseData.js';
import previewRouter from './routes/preview.js';
import generateRouter from './routes/generate.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const app = express();

// Security and utility middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static frontend assets (disabled caching to ensure instant live updates)
app.use(express.static(path.join(projectRoot, 'public'), {
  etag: false,
  maxAge: 0,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// Mount API endpoints on both /api and root (guarantees 100% Vercel & Express serverless compatibility)
const apiRouters = [analyzeRouter, parseDataRouter, previewRouter, generateRouter];
apiRouters.forEach(r => {
  app.use('/api', r);
  app.use(r);
});

// Health check endpoint
const healthCheck = (req, res) => {
  res.json({
    status: 'ok',
    app: 'Bulk Certify',
    version: '1.0.0',
    geminiKeyConfigured: Boolean(config.defaultGeminiApiKey)
  });
};
app.get('/api/health', healthCheck);
app.get('/health', healthCheck);

// Fallback to index.html for SPA routing (only if not an API request)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ success: false, error: 'API endpoint not found' });
  }
  res.sendFile(path.join(projectRoot, 'public', 'index.html'));
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'An unexpected internal server error occurred.'
  });
});

// Start Express HTTP Server with automatic port fallback if port is busy
function startServer(port) {
  const HOST = '0.0.0.0';
  const server = app.listen(port, HOST, () => {
    console.log(`\n==================================================`);
    console.log(`   Bulk Certify Server is running!`);
    console.log(`   Local URL:    http://localhost:${port}`);
    console.log(`   Loopback URL: http://127.0.0.1:${port}`);
    console.log(`   Gemini AI Vision: ${config.defaultGeminiApiKey ? 'API Key Configured (Server)' : 'Client-provided Key Mode'}`);
    console.log(`==================================================\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      console.warn(`[WARN] Port ${port} is already in use. Retrying on port ${nextPort}...`);
      startServer(nextPort);
    } else {
      console.error('Fatal Server Error:', err);
    }
  });
}

// Start Express HTTP Server when run directly
if (!process.env.VERCEL) {
  startServer(config.port);
}

export default app;

