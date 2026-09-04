import type { MetadataRoute } from "next";
import { BRAND_ICON_APPLE, BRAND_ICON_LARGE, BRAND_ICON_MASKABLE, BRAND_ICON_SMALL, BRAND_THEME_COLOR } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nythera",
    short_name: "Nythera",
    description: "AI character roleplay with synced persona, memory, and secure model access.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "browser"],
    background_color: BRAND_THEME_COLOR,
    theme_color: BRAND_THEME_COLOR,
    lang: "en",
    dir: "ltr",
    categories: ["social", "entertainment", "games"],
    prefer_related_applications: false,
    icons: [
      {
        src: BRAND_ICON_SMALL,
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: BRAND_ICON_LARGE,
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: BRAND_ICON_MASKABLE,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      },
      {
        src: BRAND_ICON_APPLE,
        sizes: "180x180",
        type: "image/png",
        purpose: "any"
      }
    ],
    shortcuts: [
      {
        name: "Explore characters",
        short_name: "Explore",
        url: "/explore?source=shortcut",
        icons: [{ src: BRAND_ICON_SMALL, sizes: "192x192", type: "image/png" }]
      },
      {
        name: "Continue chats",
        short_name: "Chats",
        url: "/chats?source=shortcut",
        icons: [{ src: BRAND_ICON_SMALL, sizes: "192x192", type: "image/png" }]
      },
      {
        name: "Create character",
        short_name: "Create",
        url: "/create-character?source=shortcut",
        icons: [{ src: BRAND_ICON_SMALL, sizes: "192x192", type: "image/png" }]
      }
    ]
  };
}
