# Cube Embedding Demo

Application to test signed embedding functionality in Cube.

## Setup

1. Install dependencies:
```bash
cd packages/console-ui/cube-embedding-demo
yarn install
```

2. Create a `.env` file from the example:
```bash
cp .env.example .env
```

3. Edit `.env` and set your required configuration:
```bash
API_KEY=your-api-key-here
CUBE_API_URL=https://your-cube-instance.com
```

Required environment variables:
- `API_KEY` - Your Cube API key
- `CUBE_API_URL` - Cube API server URL (used by both backend and frontend)

Optional environment variables:
- `VITE_CUBE_API_URL` - Override Cube API URL for frontend only (defaults to `CUBE_API_URL`)
- `PORT` - Server port (defaults to `3001`)

## Development

For development with hot reload, run Vite dev server:
```bash
yarn dev
```

This will start the Vite dev server on `http://localhost:3002` (or the port configured in `vite.config.ts`).

The dev server includes a proxy that forwards `/api` requests to your Cube server, so API calls work seamlessly.

## Production

1. Build the React app:
```bash
yarn build
```

2. Start the production server:
```bash
yarn start
```

The server will start on `http://localhost:3001` (or the port specified in `PORT`).

Open `http://localhost:3001` in your browser to access the test page.

## How it works

- The server proxies API requests to the Cube server, adding the API key from the environment variable
- The React app makes API calls to the local server (which handles authentication)
- Embed iframes point directly to the Cube server

This keeps the API key secure on the server side and never exposes it to the client.

## Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **shadcn/ui** - Modern UI components
- **Tailwind CSS** - Styling
- **Express** - Backend server
