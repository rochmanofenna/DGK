import type { Metadata } from "next"
import { Barlow_Condensed, Geist_Mono, Inter } from "next/font/google"

import "./globals.css"

// Corporate ERP palette — Inter for all UI text (clean neo-grotesque,
// renders cleanly at small sizes), Barlow Condensed for the brand
// wordmark (matches the logo's condensed industrial feel), Geist Mono
// for identifiers and numbers (order/DO/invoice numbers, amounts).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
      className={`${inter.variable} ${barlowCondensed.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
