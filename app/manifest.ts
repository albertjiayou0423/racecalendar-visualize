import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "赛道时刻 · WRC / F1 / FE 赛程时间表",
    short_name: "赛道时刻",
    description:
      "直观查看 WRC、F1、Formula E 的未来赛程，提供当地时间与北京时间的详细时间安排。",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0b",
    theme_color: "#1a1a1e",
    orientation: "portrait-primary",
    categories: ["sports", "entertainment"],
    lang: "zh-CN",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-1024.png",
        sizes: "1024x1024",
        type: "image/png",
        purpose: "any",
      },
    ],
  }
}
