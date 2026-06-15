import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aurenya AI Character Chat",
    short_name: "Aurenya",
    description: "AI character chats with persona, memory, and secure model access.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B0B12",
    theme_color: "#0B0B12",
    categories: ["social", "entertainment", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ],
    shortcuts: [
      {
        name: "Explore characters",
        short_name: "Explore",
        url: "/explore",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }]
      },
      {
        name: "Continue chats",
        short_name: "Chats",
        url: "/chats",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }]
      },
      {
        name: "Create character",
        short_name: "Create",
        url: "/create-character",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }]
      }
    ]
  };
}
