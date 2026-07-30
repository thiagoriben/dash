import type { Metadata, Viewport } from "next"
import { Inter, Space_Grotesk, Geist_Mono } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" })
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" })
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" })

export const metadata: Metadata = {
  title: "Dash — Gestão de Tráfego Pago",
  description: "Dashboard interna de gestão de tráfego pago, criativos e rentabilidade.",
}

export const viewport: Viewport = {
  themeColor: "#070b14",
  colorScheme: "dark",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="bg-background">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <div id="app-root">{children}</div>
      </body>
    </html>
  )
}
