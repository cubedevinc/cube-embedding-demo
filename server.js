require('dotenv').config();

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const CUBE_API_URL = process.env.CUBE_API_URL;
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error('ERROR: API_KEY environment variable is required');
  console.error('Please set it in a .env file or as an environment variable:');
  console.error('  Create a .env file with: API_KEY=your-api-key-here');
  console.error('  Or set it inline: API_KEY=your-api-key-here yarn start');
  process.exit(1);
}

if (!CUBE_API_URL) {
  console.error('ERROR: CUBE_API_URL environment variable is required');
  console.error('Please set it in a .env file or as an environment variable:');
  console.error('  Create a .env file with: CUBE_API_URL=https://your-cube-instance.com');
  console.error('  Or set it inline: CUBE_API_URL=https://your-cube-instance.com yarn start');
  process.exit(1);
}

// Parse JSON bodies
app.use(express.json());

// Proxy API requests to Cube server with API key
app.post('/api/v1/embed/generate-session', async (req, res) => {
  try {
    const response = await fetch(`${CUBE_API_URL}/api/v1/embed/generate-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Api-Key ${API_KEY}`,
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.text();
    
    // Forward the status code and response
    res.status(response.status);
    res.set('Content-Type', response.headers.get('Content-Type') || 'application/json');
    res.send(data);
  } catch (error) {
    console.error('Error proxying request:', error);
    res.status(500).json({ error: 'Failed to proxy request', message: error.message });
  }
});

// Serve static files from dist (built React app)
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback to index.html for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Cube Embedding Demo server running at http://localhost:${PORT}`);
  console.log(`📡 Proxying to Cube API: ${CUBE_API_URL}`);
  console.log(`🔑 API Key: ${API_KEY.substring(0, 10)}...${API_KEY.substring(API_KEY.length - 10)}`);
  console.log(`\nOpen http://localhost:${PORT} in your browser to test signed embedding\n`);
  console.log(`Note: Make sure to run 'yarn build' first to build the React app\n`);
});
