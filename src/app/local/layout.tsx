// src/app/local/layout.tsx
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Local Share – CheezyPizza',
  description:
    'Send and receive files instantly with nearby devices on the same Wi-Fi network. No uploads, no cloud — direct device-to-device transfer via WebRTC.',
  openGraph: {
    title: 'CheezyPizza — Local Share',
    description:
      'Instantly transfer files between devices on the same network. No account needed.',
    url: 'https://www.cheezypizza.in/local',
    siteName: 'CheezyPizza',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://www.cheezypizza.in/local',
  },
}

export default function LocalLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
