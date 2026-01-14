import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Nebula Editor - Markdown ↔ NebulaXML',
  description: 'Advanced Markdown and XML document editor with bidirectional sync',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  )
}
