import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/components/theme-provider";
import { GoogleAnalytics } from "@/components/GoogleAnalytics"; // <-- Import Analytics
import { Suspense } from "react";

const inter = Inter({ subsets: ["latin"] });

// --- NEW SEO-OPTIMIZED METADATA ---
const siteUrl = "https://algobook.ai";

export const metadata: Metadata = {
  // --- Basic Info ---
  title: {
    default: "AlgoBook | AI Coding Practice Platform",
    template: "%s | AlgoBook",
  },
  description: "Sharpen your coding skills with AlgoBook, a smart AI-powered practice platform. Get LeetCode-style questions, Java support, and intelligent feedback to prepare for technical interviews.",
  
  // --- Keywords ---
  keywords: [
    "AI coding practice",
    "LeetCode alternative",
    "Java coding interview",
    "DSA practice",
    "Data Structures and Algorithms",
    "AI coding assistant",
    "technical interview prep",
    "software engineer interview"
  ],

  // --- Search Engine Links ---
  metadataBase: new URL(siteUrl), // Very important for absolute URLs
  alternates: {
    canonical: '/',
  },

  // --- Open Graph (for Facebook, LinkedIn, etc.) ---
  openGraph: {
    title: "AlgoBook | AI Coding Practice Platform",
    description: "AI-driven practice for your next technical interview.",
    url: siteUrl,
    siteName: "AlgoBook",
    images: [
      {
        url: "/og-image.png", // You should create this image (1200x630)
        width: 1200,
        height: 630,
        alt: "AlgoBook AI Coding Platform",
      },
    ],
    locale: 'en_US',
    type: 'website',
  },

  // --- Twitter Card ---
  twitter: {
    card: 'summary_large_image',
    title: "AlgoBook | AI Coding Practice Platform",
    description: "AI-driven practice for your next technical interview.",
    images: ["/og-image.png"], // Twitter can use the same OG image
  },

  // --- Other ---
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};
// --- END OF METADATA ---


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        
        {/* 2. WRAP GOOGLE ANALYTICS IN SUSPENSE */}
        <Suspense fallback={null}>
          <GoogleAnalytics /> 
        </Suspense>
        
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}