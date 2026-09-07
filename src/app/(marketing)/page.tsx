import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import Script from "next/script";
import { LandingClient } from "@/components/landing/LandingClient";
import { FAQ } from "@/components/landing/faq";

/** Landing (Module 05 U-10). Server shell with structured data; sections are client components for motion. */
export const metadata: Metadata = {
  title: { absolute: "AlgoBook — Practice like it's the real interview" },
  alternates: { canonical: "/" },
};

export default function LandingPage() {
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://algobook.ai";
  const jsonLd = [
    {
      "@context": "https://schema.org", "@type": "SoftwareApplication", name: "AlgoBook", applicationCategory: "EducationalApplication", operatingSystem: "Web",
      url: siteUrl, description: "AI-verified coding interview practice with a LeetCode-parity editor, an AI tutor, spaced repetition, a rating and a daily challenge in Java, Python, C++ and JavaScript.",
      offers: [{ "@type": "Offer", price: "0", priceCurrency: "INR", name: "Free" }, { "@type": "Offer", price: "499", priceCurrency: "INR", name: "Pro Monthly" }, { "@type": "Offer", price: "4999", priceCurrency: "INR", name: "Pro Yearly" }],
      publisher: { "@type": "Organization", name: "CognitiveSquad" },
    },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
  ];
  // Product screenshots captured by `npm run qa:screenshots` into public/screens; the bento only renders the ones that exist.
  const shots = Object.fromEntries(["/screens/workspace.webp", "/screens/profile.webp"].map((p) => [p, fs.existsSync(path.join(process.cwd(), "public", p))]));
  return (
    <>
      <Script id="ld-json" type="application/ld+json" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LandingClient shots={shots} />
    </>
  );
}
