const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static assets from root
app.use(express.static(__dirname));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'Aurora Music Player' });
});

// Fallback to index.html for SPA routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Aurora Music Player running at http://0.0.0.0:${PORT}`);
});

