// Zod schema for the static camera catalog. Every record must be traceable to an
// official manufacturer datasheet (see docs/camera-catalog-sources.md) - no values
// from memory, resellers, or calculation.
//
// Vertical FOV (vfov*) is optional: present only when the datasheet prints it. The
// app derives a fallback at runtime (labelled as computed) and never stores it. Max
// is 360, not 180: fisheye datasheets print e.g. "V: 185" and values are as printed.
//
// Protection / audio / detection fields are two-state, not tri-state: true or a
// listed value means the datasheet prints it for this exact model string; false,
// null or an empty array means "not printed as present" - never a confirmed
// absence. UI wording for the negative is "not listed"; the one exception, by owner
// decision, is the properties "IP rate" row, which reads "None".
import { z } from "zod";

export const BRANDS = ["hikvision", "dahua", "axis"] as const;
// "ptz" = pan-tilt(-zoom) camera: drawn as one cone at the bearing the user sets, like any
// other form factor - the pan range is not modelled.
export const FORM_FACTORS = ["dome", "turret", "bullet", "fisheye", "ptz"] as const;
export const ILLUMINATION_TYPES = ["ir", "white-light", "dual"] as const;
// On-device target classes, in canonical order.
export const DETECTION_TYPES = ["human", "vehicle", "face", "license-plate"] as const;

export type Brand = (typeof BRANDS)[number];
export type FormFactor = (typeof FORM_FACTORS)[number];
export type IlluminationType = (typeof ILLUMINATION_TYPES)[number];
export type DetectionType = (typeof DETECTION_TYPES)[number];

// Official domains each brand's sourceUrl must resolve under (host must end with one).
// hikvision.vn (Hikvision Vietnam) is accepted by owner decision for older models whose
// datasheet is no longer hosted on hikvision.com.
const BRAND_DOMAINS: Record<Brand, readonly string[]> = {
  hikvision: ["hikvision.com", "hikvision.vn"],
  dahua: ["dahuasecurity.com"],
  axis: ["axis.com"],
};

const fixedLensSchema = z.object({
  kind: z.literal("fixed"),
  focalMm: z.number().positive(),
  hfovDeg: z.number().positive().max(360),
  vfovDeg: z.number().positive().max(360).optional(),
});

const varifocalLensSchema = z.object({
  kind: z.literal("varifocal"),
  focalMinMm: z.number().positive(),
  focalMaxMm: z.number().positive(),
  hfovWideDeg: z.number().positive().max(360),
  hfovTeleDeg: z.number().positive().max(360),
  vfovWideDeg: z.number().positive().max(360).optional(),
  vfovTeleDeg: z.number().positive().max(360).optional(),
});

export const lensSchema = z.discriminatedUnion("kind", [
  fixedLensSchema,
  varifocalLensSchema,
]);

export type Lens = z.infer<typeof lensSchema>;

const doriSchema = z.object({
  detect: z.number().positive(),
  observe: z.number().positive(),
  recognize: z.number().positive(),
  identify: z.number().positive(),
});

export type ManufacturerDori = z.infer<typeof doriSchema>;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// Ingress protection code as printed, e.g. "IP67", "IP69K".
const INGRESS_RATING_PATTERN = /^IP\d{2}K?$/;
// Impact protection code as printed, IK00..IK11, e.g. "IK10".
const IK_RATING_PATTERN = /^IK(0\d|1[01])$/;

function hasDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

// Indicative Vietnam street price, read from a Vietnamese reseller's public
// product page (unlike every optical spec above, which must come from the
// manufacturer's datasheet). null = no VN reseller publishes a price ("Liên hệ").
const priceVnSchema = z.object({
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
// page shows no number, e.g. "Liên hệ").
const purchaseChannelSchema = z.object({
  shop: z.string().regex(/^[a-z0-9]+$/, "shop must be a short lowercase name, e.g. shopee"),
  url: purchaseUrlSchema,
  amountVnd: z.number().int().positive().nullable().default(null),
  retrieved: z.string().regex(ISO_DATE_PATTERN, "retrieved must be an ISO date (YYYY-MM-DD)"),
});

export type PurchaseChannel = z.infer<typeof purchaseChannelSchema>;

// Where to buy this model: a primary and a secondary sales channel, either of which may be
// missing (null) but not both. Like priceVn this is shop data, not a datasheet value.
// null = no channel recorded.
const purchaseLinksSchema = z
  .object({
    primary: purchaseChannelSchema.nullable().default(null),
    secondary: purchaseChannelSchema.nullable().default(null),
  })
  .refine((links) => links.primary !== null || links.secondary !== null, {
    message: "purchaseLinks needs a primary or a secondary channel (use null for none)",
  });

export type PurchaseLinks = z.infer<typeof purchaseLinksSchema>;

// id: kebab-case, lowercase alphanumeric segments joined by '-', dots allowed for
// focal-length fragments (e.g. "hikvision-ds-2cd2143g2-i-2.8mm").
const ID_PATTERN = /^[a-z0-9]+([.-][a-z0-9]+)*$/;

export const cameraModelSchema = z
  .object({
    id: z.string().regex(ID_PATTERN, "id must be kebab-case (lowercase, digits, '-', '.')"),
    brand: z.enum(BRANDS),
    model: z.string().min(1),
    formFactor: z.enum(FORM_FACTORS),
    resolutionMp: z.number().positive(),
    pixelWidth: z.number().int().positive(),
    pixelHeight: z.number().int().positive(),
    lens: lensSchema,
    illuminationRangeM: z.number().positive().nullable(),
    illuminationType: z.enum(ILLUMINATION_TYPES).nullable(),
    manufacturerDoriM: doriSchema.nullable(),
    /** Every IP code printed for this model, in printed order. [] = none printed. */
    ingressRatings: z
      .array(z.string().regex(INGRESS_RATING_PATTERN, "ingress rating must look like IP67 or IP69K"))
      .default([]),
    /** IK code as printed (IK00..IK11). null = none printed. */
    ikRating: z
      .string()
      .regex(IK_RATING_PATTERN, "ikRating must be IK00..IK11")
      .nullable()
      .default(null),
    hasBuiltInMic: z.boolean().default(false),
    hasBuiltInSpeaker: z.boolean().default(false),
    /** Physical audio / line / mic input connector. */
    hasAudioInPort: z.boolean().default(false),
    /** Physical audio / line output connector. */
    hasAudioOutPort: z.boolean().default(false),
    /** On-device target classes printed on the datasheet. */
    detectionTypes: z.array(z.enum(DETECTION_TYPES)).default([]),
    sourceUrl: z.string().url(),
    sourceRetrieved: z
      .string()
      .regex(ISO_DATE_PATTERN, "sourceRetrieved must be an ISO date (YYYY-MM-DD)"),
    priceVn: priceVnSchema.nullable().default(null),
    purchaseLinks: purchaseLinksSchema.nullable().default(null),
    notes: z.string().optional(),
  })
  .superRefine((record, ctx) => {
    if (record.lens.kind === "varifocal") {
      if (record.lens.focalMaxMm <= record.lens.focalMinMm) {
        ctx.addIssue({
          code: "custom",
          message: "lens.focalMaxMm must exceed lens.focalMinMm",
          path: ["lens", "focalMaxMm"],
        });
      }
      if (record.lens.hfovWideDeg <= record.lens.hfovTeleDeg) {
        ctx.addIssue({
          code: "custom",
          message: "lens.hfovWideDeg must exceed lens.hfovTeleDeg (wide angle > tele angle)",
          path: ["lens", "hfovWideDeg"],
        });
      }
      const { vfovWideDeg, vfovTeleDeg } = record.lens;
      if ((vfovWideDeg === undefined) !== (vfovTeleDeg === undefined)) {
        ctx.addIssue({
          code: "custom",
          message: "lens.vfovWideDeg and lens.vfovTeleDeg must both be present or both absent",
          path: ["lens", "vfovWideDeg"],
        });
      } else if (vfovWideDeg !== undefined && vfovTeleDeg !== undefined && vfovWideDeg <= vfovTeleDeg) {
        ctx.addIssue({
          code: "custom",
          message: "lens.vfovWideDeg must exceed lens.vfovTeleDeg",
          path: ["lens", "vfovWideDeg"],
        });
      }
    }

    if (hasDuplicates(record.ingressRatings)) {
      ctx.addIssue({
        code: "custom",
        message: "ingressRatings must not contain duplicates",
        path: ["ingressRatings"],
      });
    }
    if (hasDuplicates(record.detectionTypes)) {
      ctx.addIssue({
        code: "custom",
        message: "detectionTypes must not contain duplicates",
        path: ["detectionTypes"],
      });
    }

    let host = "";
    try {
      host = new URL(record.sourceUrl).host;
    } catch {
      // invalid URL already flagged by z.string().url() above
    }
    const expectedDomains = BRAND_DOMAINS[record.brand];
    if (host && !expectedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
      ctx.addIssue({
        code: "custom",
        message: `sourceUrl host "${host}" must be under one of ${expectedDomains.join(", ")} for brand "${record.brand}"`,
        path: ["sourceUrl"],
      });
    }
  });

export type CameraModel = z.infer<typeof cameraModelSchema>;

export const cameraModelArraySchema = z.array(cameraModelSchema);
