// Zod schema for the static sensor catalog (PIR motion, active IR beam, shock/acoustic
// glass-break vibration, thermal). Every value must be traceable to an official
// manufacturer datasheet or install manual PDF (see docs/sensor-catalog-sources.md) - no
// values from memory, resellers or calculation, with one exception below.
//
// convertedFromFeet: set true when a datasheet prints feet only and the stored metre
// value is printed-ft x 0.3048 rounded to 0.1 m. Omitted when the datasheet prints
// metres (always copied as printed, never converted). The only calculation permitted in
// this catalog. priceVn/purchaseLinks are shop data, not datasheet values, exactly like
// the camera catalog.
import { z } from "zod";
import {
  CATALOG_ID_PATTERN,
  ISO_DATE_PATTERN,
  priceVnSchema,
  purchaseLinksSchema,
} from "../shared/catalog-shared-price-and-provenance-schema";
import { beamSchema, pirSchema, thermalSchema, vibrationSchema } from "./sensor-catalog-kind-coverage-schemas";

export const SENSOR_BRANDS = ["hikvision", "dahua", "bosch", "takex"] as const;
export type SensorBrand = (typeof SENSOR_BRANDS)[number];

// Official domains each sensor record's sourceUrl must resolve under (host must end
// with one). dahuatech.com accepted alongside dahuasecurity.com for sensor records only,
// by owner decision.
export const SENSOR_BRAND_OFFICIAL_HOSTS: Record<SensorBrand, readonly string[]> = {
  hikvision: ["hikvision.com"],
  dahua: ["dahuasecurity.com", "dahuatech.com"],
  bosch: ["boschsecurity.com"],
  takex: ["takex.com"],
};

const sensorCommonFields = {
  id: z.string().regex(CATALOG_ID_PATTERN, "id must be kebab-case (lowercase, digits, '-', '.')"),
  brand: z.enum(SENSOR_BRANDS),
  model: z.string().min(1),
  // https only, matching purchaseLinksSchema's purchase-link convention - a datasheet link
  // the UI renders as a clickable href must never silently fall back to plain http.
  sourceUrl: z.string().url().regex(/^https:\/\//, "sourceUrl must be an https URL"),
  sourceRetrieved: z.string().regex(ISO_DATE_PATTERN, "sourceRetrieved must be an ISO date (YYYY-MM-DD)"),
  /** true when a feet-only datasheet was converted to metres (x0.3048, rounded to 0.1 m). */
  convertedFromFeet: z.boolean().optional(),
  priceVn: priceVnSchema.nullable().default(null),
  purchaseLinks: purchaseLinksSchema.nullable().default(null),
  notes: z.string().optional(),
};

// True if any two rows serialize identically (used for the `radii` array - row order is
// not significant, exact duplicates are a transcription mistake).
function hasDuplicateRows(rows: readonly unknown[]): boolean {
  const seen = new Set(rows.map((row) => JSON.stringify(row)));
  return seen.size !== rows.length;
}

export const sensorModelSchema = z
  .discriminatedUnion("kind", [
    pirSchema.extend(sensorCommonFields),
    beamSchema.extend(sensorCommonFields),
    vibrationSchema.extend(sensorCommonFields),
    thermalSchema.extend(sensorCommonFields),
  ])
  .superRefine((record, ctx) => {
    if (record.kind === "beam" && record.maxDistanceOutdoorM === null && record.maxDistanceIndoorM === null) {
      ctx.addIssue({
        code: "custom",
        message: "beam needs at least one of maxDistanceOutdoorM / maxDistanceIndoorM",
        path: ["maxDistanceOutdoorM"],
      });
    }

    if (record.kind === "vibration" && hasDuplicateRows(record.radii)) {
      ctx.addIssue({ code: "custom", message: "radii must not contain duplicate rows", path: ["radii"] });
    }

    if (record.kind === "thermal") {
      const { human, vehicle } = record.detectionRangeM;
      for (const [label, dri] of [["human", human] as const, ["vehicle", vehicle] as const]) {
        if (dri && !(dri.detect > dri.recognize && dri.recognize > dri.identify)) {
          ctx.addIssue({
            code: "custom",
            message: `detectionRangeM.${label} must have detect > recognize > identify`,
            path: ["detectionRangeM", label],
          });
        }
      }
    }

    // z.string().url() above already guarantees record.sourceUrl parses, so this never throws
    // in practice; kept defensive in case that guarantee ever weakens.
    let host = "";
    try {
      host = new URL(record.sourceUrl).host;
    } catch {
      // unreachable per the above; host stays "" and fails the mismatch check below
    }
    const expectedHosts = SENSOR_BRAND_OFFICIAL_HOSTS[record.brand];
    if (!expectedHosts.some((domain) => host === domain || host.endsWith(`.${domain}`))) {
      ctx.addIssue({
        code: "custom",
        message: `sourceUrl host "${host}" must be under one of ${expectedHosts.join(", ")} for brand "${record.brand}"`,
        path: ["sourceUrl"],
      });
    }
  });

export type SensorModel = z.infer<typeof sensorModelSchema>;

export const sensorModelArraySchema = z.array(sensorModelSchema);
