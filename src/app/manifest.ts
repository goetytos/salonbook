import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SalonBook",
    short_name: "SalonBook",
    description:
      "Discover salons and barbershops across Kenya and book appointments online.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f0e8",
    theme_color: "#102b24",
    lang: "en-KE",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
