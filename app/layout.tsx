import type { Metadata } from "next"
import { Fraunces, Geist, Geist_Mono } from "next/font/google"

import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
})

// Fraunces: a characterful editorial serif used for page titles, big
// numbers, and the wordmark. Italic form is especially expressive.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "DGK ERP",
  description: "Dinamika Global Korpora — logistics operations",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
