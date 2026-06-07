import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CheezyPizza',
    short_name: 'CheezyPizza',
    description: 'Peer-to-peer file transfers in your browser',
    start_url: '/',
    display: 'standalone',
    background_color: '#fffbf0',
    theme_color: '#ea580c',
    icons: [{ src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' }],
    screenshots: [
      {
        src: '/images/OG.png',
        sizes: '1200x630',
        type: 'image/png',
        form_factor: 'wide',
      },
      { src: '/images/OG.png', sizes: '1200x630', type: 'image/png' },
    ],
  }
}
