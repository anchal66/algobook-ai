"use client";
/** GA4 loader (Module 05 U-23): next/script, env-configurable id, SPA page views with the correct `?` separator. */
import { useEffect } from "react";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-GS6D8GSWC8";

declare global { interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void } }

export function GoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pageView = () => {
    if (!window.gtag) return;
    const qs = searchParams.toString();
    window.gtag("event", "page_view", { page_path: qs ? `${pathname}?${qs}` : pathname, page_location: window.location.href, page_title: document.title });
  };
  // SPA navigations; the first page view is sent from the script's onLoad because gtag loads lazily.
  useEffect(() => { pageView(); }, [pathname, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!GA_ID || process.env.NODE_ENV !== "production") return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="lazyOnload" />
      <Script id="ga4-init" strategy="lazyOnload" onLoad={pageView}>{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}',{send_page_view:false});`}</Script>
    </>
  );
}
