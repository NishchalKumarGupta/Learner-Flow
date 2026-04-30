require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const YT_API_KEY = process.env.YT_KEY;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Check if API key is configured
if (!YT_API_KEY) {
  console.warn('⚠️  WARNING: YouTube API key not found. Set YT_KEY in .env file');
}

// Routes

// Test endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Backend is running',
    timestamp: new Date().toISOString(),
    ytApiConfigured: !!YT_API_KEY
  });
});

// Get YouTube playlist videos
app.get('/api/playlist', async (req, res) => {
  try {
    const { playlistId, pageToken } = req.query;

    if (!playlistId) {
      return res.status(400).json({ error: 'Playlist ID is required' });
    }

    if (!YT_API_KEY) {
      return res.status(500).json({ error: 'YouTube API key not configured' });
    }

    const params = {
      key: YT_API_KEY,
      playlistId: playlistId,
      part: 'snippet',
      maxResults: 50
    };

    if (pageToken) {
      params.pageToken = pageToken;
    }

    const response = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
      params: params
    });

    const videos = response.data.items.map(item => ({
      videoId: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.default.url
    }));

    res.json({ 
      videos: videos,
      nextPageToken: response.data.nextPageToken || null
    });
  } catch (error) {
    console.error('Error fetching playlist:', error.message);
    res.status(500).json({ error: 'Failed to fetch playlist', details: error.message });
  }
});

// Get video details
app.post('/api/video', async (req, res) => {
  try {
    const { videoId } = req.body;

    if (!videoId) {
      return res.status(400).json({ error: 'Video ID is required' });
    }

    if (!YT_API_KEY) {
      return res.status(500).json({ error: 'YouTube API key not configured' });
    }

    const response = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: {
        key: YT_API_KEY,
        id: videoId,
        part: 'snippet,statistics'
      }
    });

    const video = response.data.items[0];
    res.json({
      videoId,
      title: video.snippet.title,
      description: video.snippet.description,
      thumbnail: video.snippet.thumbnails.high.url,
      viewCount: video.statistics.viewCount,
      likeCount: video.statistics.likeCount
    });
  } catch (error) {
    console.error('Error fetching video:', error.message);
    res.status(500).json({ error: 'Failed to fetch video', details: error.message });
  }
});

// Catch-all 404
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ LearnerFlow Backend running at http://localhost:${PORT}`);
  console.log(`📺 YouTube API configured: ${YT_API_KEY ? 'Yes' : 'No'}`);
});
