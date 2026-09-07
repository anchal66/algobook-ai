import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { OfflineToast } from "@/components/shell/OfflineToast";
import { Maintenance } from "@/app/maintenance";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://algobook.ai";
const description = "AI-verified interview problems in Java, Python, C++ and JavaScript, a LeetCode-parity editor, an AI tutor, spaced repetition, a rating and a daily challenge — practice like it's the real interview.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "AlgoBook — AI coding interview practice", template: "%s · AlgoBook" },
  description,
  applicationName: "AlgoBook",
  keywords: ["AI coding practice", "LeetCode alternative", "coding interview", "DSA practice", "data structures and algorithms", "technical interview prep", "Java", "Python", "C++", "JavaScript"],
  openGraph: { title: "AlgoBook — AI coding interview practice", description, url: siteUrl, siteName: "AlgoBook", locale: "en_US", type: "website" },
  twitter: { card: "summary_large_image", title: "AlgoBook — AI coding interview practice", description },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 } },
  category: "education",
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#0f0f10" }, { media: "(prefers-color-scheme: light)", color: "#ffffff" }],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth" className={`${inter.variable} ${jetbrains.variable}`}>
      <head>
        <link rel="preconnect" href="https://identitytoolkit.googleapis.com" />
        <link rel="preconnect" href="https://securetoken.googleapis.com" />
        <link rel="preconnect" href="https://lh3.googleusercontent.com" />
      </head>
      <body className="min-h-dvh font-sans">
        <Suspense fallback={null}>
          <GoogleAnalytics />
        </Suspense>
        <Providers>
          <OfflineToast />
          {process.env.MAINTENANCE === "1" ? <Maintenance /> : children}
        </Providers>
      </body>
    </html>
  );
}
