import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";
import { PRODUCT_NAME } from "@/lib/brand";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations("seo");
  return {
    name: PRODUCT_NAME,
    short_name: PRODUCT_NAME,
    description: t("description"),
    start_url: "/",
    display: "standalone",
    background_color: "#07171e",
    theme_color: "#053b45",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
