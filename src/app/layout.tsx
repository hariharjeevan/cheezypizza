import React from 'react'
import { Viewport } from 'next'
import { ViewTransitions } from 'next-view-transitions'
//import Script from 'next/script'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '../components/ThemeProvider'
import FilePizzaQueryClientProvider from '../components/QueryClientProvider'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import ScrollToTop from '../components/ScrollToTop'
import '../styles.css'
import 'highlight.js/styles/atom-one-dark.css'

export const metadata = {
  title: 'CheezyPizza — Peer-to-Peer File Transfers in Your Browser',
  description:
    'Send files directly between browsers using WebRTC. No uploads, no cloud storage, and no middleman. Fast, secure, peer-to-peer file sharing. Forked from file.pizza.',
  keywords: [
    'file transfer',
    'peer to peer',
    'WebRTC',
    'p2p file sharing',
    'FilePizza',
    'file.pizza',
    'browser file sharing',
    'no upload file transfer',
    'CheezyPizza',
    'filepizza',
  ],
  metadataBase: new URL('https://www.cheezypizza.in'),
  alternates: {
    canonical: 'https://www.cheezypizza.in',
  },
  openGraph: {
    title: 'CheezyPizza — Peer-to-Peer File Transfers in Your Browser',
    description:
      'Send files directly between browsers using WebRTC. No uploads, no cloud storage, and no middleman. Fast, secure, peer-to-peer file sharing. Forked from file.pizza.',
    url: 'https://www.cheezypizza.in',
    siteName: 'CheezyPizza',
    images: [
      {
        url: 'https://www.cheezypizza.in/images/OG.png',
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
    images: ['https://www.cheezypizza.in/images/OG.png'],
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
          <link rel="manifest" href="/manifest.webmanifest" />
          <link
            href="https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=DM+Mono&display=swap"
            rel="stylesheet"
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'WebApplication',
                name: 'CheezyPizza',
                url: 'https://www.cheezypizza.in',
                description:
                  'Peer-to-peer file transfers in your browser using WebRTC. Forked from FilePizza (file.pizza).',
                applicationCategory: 'UtilitiesApplication',
                isBasedOn: 'https://file.pizza',
              }),
            }}
          />
        </head>
        <body>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
            {/* <Script
              src="https://static.cloudflareinsights.com/beacon.min.js"
              data-cf-beacon='{"token": "345a2254fa94545bf88d65926273523", "spa": true}'
              strategy="afterInteractive"
            /> */}
            <Analytics />
            <FilePizzaQueryClientProvider>
              <Navbar />
              <main>{children}</main>
              <ScrollToTop />
              <Footer />
            </FilePizzaQueryClientProvider>
          </ThemeProvider>
        </body>
      </html>
    </ViewTransitions>
  )
}
