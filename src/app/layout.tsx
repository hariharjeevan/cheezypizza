import React from 'react'
import Footer from '../components/Footer'
import '../styles.css'
import { ThemeProvider } from '../components/ThemeProvider'
import FilePizzaQueryClientProvider from '../components/QueryClientProvider'
import { Viewport } from 'next'
import { ViewTransitions } from 'next-view-transitions'
import Navbar from '../components/Navbar'
import 'highlight.js/styles/atom-one-dark.css'

export const metadata = {
  title: 'CheezyPizza — Peer-to-Peer File Transfers in Your Browser',
  description:
    'Send files directly between browsers using WebRTC. No uploads, no cloud storage, and no middleman. Fast, secure, peer-to-peer file sharing. Forked from file.pizza.',

  metadataBase: new URL('https://cheezypizza.vercel.app'),

  openGraph: {
    title: 'CheezyPizza — Peer-to-Peer File Transfers in Your Browser',
    description:
      'Send files directly between browsers using WebRTC. No uploads, no cloud storage, and no middleman. Fast, secure, peer-to-peer file sharing. Forked from file.pizza.',
    url: 'https://cheezypizza.vercel.app',
    siteName: 'CheezyPizza',
    images: [
      {
        url: 'https://file.pizza/images/fb.png',
        width: 1200,
        height: 630,
        alt: 'CheezyPizza Peer-to-Peer File Sharing',
      },
    ],
    type: 'website',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'CheezyPizza — Peer-to-Peer File Transfers in Your Browser',
    description:
      'Send files directly between browsers using WebRTC. No uploads, no cloud storage, and no middleman. Fast, secure, peer-to-peer file sharing. Forked from file.pizza.',
    images: ['https://file.pizza/images/fb.png'],
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return (
    <ViewTransitions>
      <html lang="en" suppressHydrationWarning>
        <head>
          <link
            href="https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=DM+Mono&display=swap"
            rel="stylesheet"
          />
        </head>
        <body>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            <FilePizzaQueryClientProvider>
              <Navbar />
              <main>{children}</main>
              <Footer />
            </FilePizzaQueryClientProvider>
          </ThemeProvider>
        </body>
      </html>
    </ViewTransitions>
  )
}
