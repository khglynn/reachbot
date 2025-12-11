import type { Metadata } from 'next'
import { Fascinate } from 'next/font/google'
import { Providers } from './providers'
import './globals.css'

// Fascinate font for the logo
export const fascinate = Fascinate({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-fascinate',
})

export const metadata: Metadata = {
  title: 'Eachie - Multi-Model AI Research',
  description: 'Search a dozen AI models at once. 🕷️',
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-96x96.png', sizes: '96x96', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`dark ${fascinate.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <meta name="theme-color" content="#0D0221" />
      </head>
      <body className="antialiased bg-paper-bg min-h-screen">
        <Providers clerkEnabled={!!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
          {/* SVG filter for chalk effect on loading bar */}
          <svg style={{ position: 'absolute', width: 0, height: 0 }}>
            <defs>
              <filter id="chalk" x="-20%" y="-20%" width="140%" height="140%">
                <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="4" seed="3" result="noise"/>
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G"/>
                <feGaussianBlur stdDeviation="0.3"/>
              </filter>
            </defs>
          </svg>
          {children}
        </Providers>
      </body>
    </html>
  )
}
