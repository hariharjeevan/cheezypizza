/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable strict mode to avoid calling useEffect twice in development.
  // The uploader and downloader are both using useEffect to listen for peerjs events
  // which causes the connection to be created twice.
  reactStrictMode: false,
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/favicon.ico',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      }
    ]
  }
}

module.exports = nextConfig