import { ImageResponse } from "next/og";

/** Favicon (Module 05 U-02): gradient tile with the bracket-"A" mark. */
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center",
          background: "linear-gradient(135deg, #6366f1, #22d3ee)", borderRadius: 16,
        }}
      >
        <svg width="44" height="44" viewBox="0 0 32 32" fill="none">
          <path d="M13.5 5.5 5 16l8.5 10.5" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18.5 5.5 27 16l-8.5 10.5" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.5 5.5h5" stroke="#fff" strokeWidth="3.6" strokeLinecap="round" />
          <circle cx="16" cy="18" r="3.4" fill="#fff" />
        </svg>
      </div>
    ),
    size,
  );
}
