import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nythera",
    short_name: "Nythera",
    description: "AI character roleplay with synced persona, memory, and secure model access.",
    id: "/?source=pwa",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "browser"],
    orientation: "any",
    background_color: "#0B0B12",
    theme_color: "#0B0B12",
    lang: "en",
    dir: "ltr",
    categories: ["social", "entertainment", "games"],
    prefer_related_applications: false,
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
      }
    ],
    shortcuts: [
      {
        name: "Explore characters",
        short_name: "Explore",
        url: "/explore?source=shortcut",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }]
      },
      {
        name: "Continue chats",
        short_name: "Chats",
        url: "/chats?source=shortcut",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }]
      },
      {
        name: "Create character",
        short_name: "Create",
        url: "/create-character?source=shortcut",
        icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }]
      }
    ]
  };
}
