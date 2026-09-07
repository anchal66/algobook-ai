import type { MetadataRoute } from "next";

/** PWA-lite manifest (Module 05 U-23): installable, no offline API caching. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AlgoBook — AI coding practice",
    short_name: "AlgoBook",
    description: "AI-verified interview problems with a LeetCode-parity editor, an AI tutor, spaced repetition and a rating.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0f0f10",
    theme_color: "#0f0f10",
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
