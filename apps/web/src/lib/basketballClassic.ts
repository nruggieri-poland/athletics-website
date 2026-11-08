import { getGalleryBySlug, type Gallery, type GallerySectionItem, type Media } from "./payload";

// The Basketball Classic page reads one section of the All-Sports Booster
// Club gallery — the one headed "Basketball Classic" (any capitalization).
// Shared by the page and the Boosters sidebar, which only links the page
// once that section has something in it.
export const BASKETBALL_CLASSIC_HEADING = "basketball classic";

export async function getBasketballClassicItems(): Promise<{ gallery: Gallery; items: GallerySectionItem[] } | null> {
  const gallery = await getGalleryBySlug("all-sports-boosters");
  const section = gallery?.sections.find((s) => s.heading?.trim().toLowerCase() === BASKETBALL_CLASSIC_HEADING);
  if (!gallery || !section || section.items.length === 0) return null;
  return { gallery, items: section.items };
}

export const isImage = (m: Media) => !!m.mimeType?.startsWith("image/");
export const isPdf = (m: Media) => m.mimeType === "application/pdf";
export const mediaTitle = (m: Media) => (m.title || m.alt || "").toLowerCase();
