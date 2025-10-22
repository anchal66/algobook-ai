"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useEffect } from "react"

// Your Google Analytics Measurement ID
const GA_MEASUREMENT_ID = "G-GS6D8GSWC8"

// To let TypeScript know about the gtag function on the window object
declare global {
  interface Window {
    gtag: (command: string, targetId: string, params: { [key: string]: string | number | boolean }) => void;
  }
}

// Utility function to send pageview events
export const gtagPageview = (url: string) => {
  if (typeof window.gtag !== "function") {
    return
  }
  window.gtag("config", GA_MEASUREMENT_ID, {
    page_path: url,
  })
}

export const GoogleAnalytics = () => {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    // Send a pageview event when the pathname or search params change
    const url = pathname + searchParams.toString()
    gtagPageview(url)
  }, [pathname, searchParams])

  return (
    <>
      <script
        async
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
      ></script>
      <script
        id="google-analytics"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}', {
              page_path: window.location.pathname,
            });
          `,
        }}
      ></script>
    </>
  )
}