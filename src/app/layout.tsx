import React from 'react'
import Footer from '../components/Footer'
import '../styles.css'
import { ThemeProvider } from '../components/ThemeProvider'
import FilePizzaQueryClientProvider from '../components/QueryClientProvider'
import { Viewport } from 'next'
import { ViewTransitions } from 'next-view-transitions'
import Navbar from '../components/Navbar'

export const metadata = {
  title: 'CheezyPizza • Your files, delivered.',
  description: 'Peer-to-peer file transfers in your web browser.',
  charSet: 'utf-8',
  openGraph: {
    url: 'https://github.com/hariharjeevan/cheezypizza',
    title: 'CheezyPizza • Your files, delivered.',
    description: 'Peer-to-peer file transfers in your web browser.',
    images: [{ url: 'https://file.pizza/images/fb.png' }],
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
