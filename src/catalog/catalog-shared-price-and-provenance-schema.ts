// Price, purchase-link and generic provenance schemas shared by the camera and sensor
// catalogs. Extracted out of camera-catalog-schema.ts (DRY) so both catalogs validate
// id / sourceRetrieved / priceVn / purchaseLinks identically - see
// docs/camera-catalog-sources.md and docs/sensor-catalog-sources.md for the provenance
// rules these schemas enforce. Unrelated to DORI px/m or planPxPerMeter (scale) - this
// file is id/price/date formatting only.
import { z } from "zod";

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Catalog record id: kebab-case, lowercase alphanumeric segments joined by '-', dots
// allowed for focal-length fragments (e.g. "hikvision-ds-2cd2143g2-i-2.8mm").
export const CATALOG_ID_PATTERN = /^[a-z0-9]+([.-][a-z0-9]+)*$/;

// Indicative Vietnam street price, read from a Vietnamese reseller's public product
// page (unlike every optical/coverage spec, which must come from the manufacturer's
// datasheet or install manual). null = no VN reseller publishes a price ("Lien he").
export const priceVnSchema = z.object({
  /** Reseller's displayed selling price in VND (whole dong, as printed - VAT treatment varies by shop). */
  amountVnd: z.number().int().positive(),
  sourceUrl: z.string().url(),
  retrieved: z.string().regex(ISO_DATE_PATTERN, "priceVn.retrieved must be an ISO date (YYYY-MM-DD)"),
});

export type PriceVn = z.infer<typeof priceVnSchema>;

// Shop product page. https only: the card renders it as a clickable href.
const purchaseUrlSchema = z
  .string()
  .url()
  .regex(/^https:\/\//, "purchase link must be an https URL");

// One sales channel for a model: the shop's short name (shown as "buy (hacom)"), its
// product page, and the selling price that page displayed on `retrieved` (null when the
// page shows no number, e.g. "Lien he").
const purchaseChannelSchema = z.object({
  shop: z.string().regex(/^[a-z0-9]+$/, "shop must be a short lowercase name, e.g. shopee"),
  url: purchaseUrlSchema,
  amountVnd: z.number().int().positive().nullable().default(null),
  retrieved: z.string().regex(ISO_DATE_PATTERN, "retrieved must be an ISO date (YYYY-MM-DD)"),
});

export type PurchaseChannel = z.infer<typeof purchaseChannelSchema>;

// Where to buy this model: a primary and a secondary sales channel, either of which may
// be missing (null) but not both. Like priceVn this is shop data, not a datasheet value.
// null (the whole field) = no channel recorded at all.
export const purchaseLinksSchema = z
  .object({
    primary: purchaseChannelSchema.nullable().default(null),
    secondary: purchaseChannelSchema.nullable().default(null),
  })
  .refine((links) => links.primary !== null || links.secondary !== null, {
    message: "purchaseLinks needs a primary or a secondary channel (use null for none)",
  });

export type PurchaseLinks = z.infer<typeof purchaseLinksSchema>;
