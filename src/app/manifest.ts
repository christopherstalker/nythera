import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nythera AI Character Chat",
    short_name: "Nythera",
    description: "AI character chats with persona, memory, and secure model access.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B0B12",
    theme_color: "#0B0B12",
    categories: ["social", "entertainment"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/og-image.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      }
    ],
    shortcuts: [
      {
        name: "Explore characters",
        short_name: "Explore",
        url: "/explore",
        icons: [{ src: "/icon.svg", sizes: "512x512" }]
      },
      {
        name: "Continue chats",
        short_name: "Chats",
        url: "/chats",
        icons: [{ src: "/icon.svg", sizes: "512x512" }]
      },
      {
        name: "Create character",
        short_name: "Create",
        url: "/create-character",
        icons: [{ src: "/icon.svg", sizes: "512x512" }]
      }
    ]
  };
}
