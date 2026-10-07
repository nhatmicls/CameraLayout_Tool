// Zod schema for the static Hikvision fire-alarm catalog (control panels, wireless
// hubs, expander modules, keypads, smoke/heat/co detectors, manual call points,
// sounders). Every value must be traceable to an official Hikvision datasheet or user
// manual PDF (see docs/fire-alarm-catalog-sources.md, decisions C1-C9) - no values from
// memory, resellers or calculation. priceVn/purchaseLinks are shop data, not datasheet
// values, exactly like the camera and sensor catalogs.
//
// Third family beside cameras and sensors (own schema/loader/file) - see plan.md "Key
// decisions": the sensor union has no marker-only shape and fire-only concepts
// (compatibility, capacity) do not belong on intrusion sensors.
import { z } from "zod";
import {
  CATALOG_ID_PATTERN,
  ISO_DATE_PATTERN,
  priceVnSchema,
  purchaseLinksSchema,
} from "../shared/catalog-shared-price-and-provenance-schema";
import {
  ACCESSORY_KINDS,
  CONTROLLER_KINDS,
  DETECTOR_KINDS,
  accessorySchemaFor,
  controllerSchemaFor,
  detectorSchemaFor,
} from "./fire-alarm-catalog-kind-schemas";

export const FIRE_ALARM_KINDS = [...CONTROLLER_KINDS, ...DETECTOR_KINDS, ...ACCESSORY_KINDS] as const;
export type FireAlarmKind = (typeof FIRE_ALARM_KINDS)[number];

export const FIRE_ALARM_PRODUCT_LINES = ["ax-hybrid", "ax-pro", "standalone"] as const;
export type FireAlarmProductLine = (typeof FIRE_ALARM_PRODUCT_LINES)[number];

// Single brand catalog (Hikvision only) - this is not a cross-brand family like
// cameras/sensors, so brand is a literal rather than an enum of hosts.
export const FIRE_ALARM_BRAND = "hikvision" as const;

// Accepted hosts for every sourceUrl in this catalog (record-level and every
// compatibleDevices entry). CLAUDE.md: hikvision.vn accepted alongside hikvision.com
// for Hikvision datasheets; subdomains of either accepted.
export const FIRE_ALARM_OFFICIAL_HOSTS = ["hikvision.com", "hikvision.vn"] as const;

function isAllowedFireAlarmHost(url: string): boolean {
  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    return false;
  }
  return FIRE_ALARM_OFFICIAL_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

const fireAlarmCommonFields = {
  id: z.string().regex(CATALOG_ID_PATTERN, "id must be kebab-case (lowercase, digits, '-', '.')"),
  brand: z.literal(FIRE_ALARM_BRAND),
  model: z.string().min(1),
  productLine: z.enum(FIRE_ALARM_PRODUCT_LINES),
  worksStandalone: z.boolean(),
  certificationsAsPrinted: z.array(z.string()).default([]),
  sourceUrl: z.string().url().regex(/^https:\/\//, "sourceUrl must be an https URL"),
  sourceRetrieved: z.string().regex(ISO_DATE_PATTERN, "sourceRetrieved must be an ISO date (YYYY-MM-DD)"),
  priceVn: priceVnSchema.nullable().default(null),
  purchaseLinks: purchaseLinksSchema.nullable().default(null),
  notes: z.string().optional(),
};

export const fireAlarmModelSchema = z
  .discriminatedUnion("kind", [
    controllerSchemaFor("control-panel").extend(fireAlarmCommonFields),
    controllerSchemaFor("wireless-hub").extend(fireAlarmCommonFields),
    detectorSchemaFor("smoke-detector").extend(fireAlarmCommonFields),
    detectorSchemaFor("heat-detector").extend(fireAlarmCommonFields),
    detectorSchemaFor("co-detector").extend(fireAlarmCommonFields),
    accessorySchemaFor("expander-module").extend(fireAlarmCommonFields),
    accessorySchemaFor("keypad").extend(fireAlarmCommonFields),
    accessorySchemaFor("manual-call-point").extend(fireAlarmCommonFields),
    accessorySchemaFor("sounder").extend(fireAlarmCommonFields),
  ])
  .superRefine((record, ctx) => {
    if (record.productLine === "standalone" && !record.worksStandalone) {
      ctx.addIssue({
        code: "custom",
        message: "productLine 'standalone' requires worksStandalone: true",
        path: ["worksStandalone"],
      });
    }

    if (!isAllowedFireAlarmHost(record.sourceUrl)) {
      ctx.addIssue({
        code: "custom",
        message: `sourceUrl must be under one of ${FIRE_ALARM_OFFICIAL_HOSTS.join(", ")}`,
        path: ["sourceUrl"],
      });
    }

    if ("compatibleDevices" in record) {
      const seen = new Set<string>();
      record.compatibleDevices.forEach((entry, index) => {
        if (seen.has(entry.modelId)) {
          ctx.addIssue({
            code: "custom",
            message: `duplicate compatibleDevices target "${entry.modelId}"`,
            path: ["compatibleDevices", index, "modelId"],
          });
        }
        seen.add(entry.modelId);

        if (!isAllowedFireAlarmHost(entry.sourceUrl)) {
          ctx.addIssue({
            code: "custom",
            message: `compatibleDevices[${index}].sourceUrl must be under one of ${FIRE_ALARM_OFFICIAL_HOSTS.join(", ")}`,
            path: ["compatibleDevices", index, "sourceUrl"],
          });
        }
      });
    }
  });

export type FireAlarmModel = z.infer<typeof fireAlarmModelSchema>;

export const fireAlarmModelArraySchema = z.array(fireAlarmModelSchema);

export type { CompatibilityEntry } from "./fire-alarm-catalog-kind-schemas";
