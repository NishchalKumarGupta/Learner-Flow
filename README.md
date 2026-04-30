# LearnerFlow - Study IDE

A web-based IDE for learning programming with integrated YouTube playlist support.

## Features
- YouTube playlist integration for study videos
- Multi-language code IDE (Python, Java, C++)
- Note-taking system
- Study streak tracking

## Setup

### Prerequisites
- Node.js (v14 or higher)
- YouTube Data API v3 key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd Learner-Flow
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Setup environment variables**
   - Copy `.env.example` to `.env`
   ```bash
   cp .env.example .env
   ```
   - Get your YouTube API key from [Google Cloud Console](https://console.developers.google.com/apis/credentials)
   - Add your key to `.env`:
   ```
   YT_KEY=your_actual_youtube_api_key_here
   ```

4. **Start the server**
   ```bash
   node server.js
   ```

5. **Open in browser**
   - Go to `http://localhost:3000`

## Security
- Never commit `.env` file to GitHub - it's in `.gitignore`
- Always use `.env.example` as a template
- Keep your API key secret and regenerate if exposed

## License
ISC
