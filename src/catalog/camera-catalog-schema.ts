// Zod schema for the static camera catalog. Every record must be traceable to an
// official manufacturer datasheet (see docs/camera-catalog-sources.md) - no values
// from memory, resellers, or calculation. See plans/.../phase-02-*.md for the method.
import { z } from "zod";

export const BRANDS = ["hikvision", "dahua", "axis"] as const;
export const FORM_FACTORS = ["dome", "turret", "bullet", "fisheye"] as const;
export const ILLUMINATION_TYPES = ["ir", "white-light", "dual"] as const;

export type Brand = (typeof BRANDS)[number];
export type FormFactor = (typeof FORM_FACTORS)[number];
export type IlluminationType = (typeof ILLUMINATION_TYPES)[number];

// Official domain each brand's sourceUrl must resolve under (host must end with this).
const BRAND_DOMAIN: Record<Brand, string> = {
  hikvision: "hikvision.com",
  dahua: "dahuasecurity.com",
  axis: "axis.com",
};

const fixedLensSchema = z.object({
  kind: z.literal("fixed"),
  focalMm: z.number().positive(),
  hfovDeg: z.number().positive().max(360),
});

const varifocalLensSchema = z.object({
  kind: z.literal("varifocal"),
  focalMinMm: z.number().positive(),
  focalMaxMm: z.number().positive(),
  hfovWideDeg: z.number().positive().max(360),
  hfovTeleDeg: z.number().positive().max(360),
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
    sourceUrl: z.string().url(),
    sourceRetrieved: z
      .string()
      .regex(ISO_DATE_PATTERN, "sourceRetrieved must be an ISO date (YYYY-MM-DD)"),
    priceVn: priceVnSchema.nullable().default(null),
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
    }

    let host = "";
    try {
      host = new URL(record.sourceUrl).host;
    } catch {
      // invalid URL already flagged by z.string().url() above
    }
    const expectedDomain = BRAND_DOMAIN[record.brand];
    if (host && !host.endsWith(expectedDomain)) {
      ctx.addIssue({
        code: "custom",
        message: `sourceUrl host "${host}" must end with "${expectedDomain}" for brand "${record.brand}"`,
        path: ["sourceUrl"],
      });
    }
  });

export type CameraModel = z.infer<typeof cameraModelSchema>;

export const cameraModelArraySchema = z.array(cameraModelSchema);
