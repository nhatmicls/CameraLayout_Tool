// Per-kind shape schemas for the fire-alarm catalog: controller (control-panel,
// wireless-hub), detector (smoke/heat/co) and accessory (expander-module, keypad,
// manual-call-point, sounder). Plain z.object() factories only (no .refine()/
// .superRefine() here) so fire-alarm-catalog-schema.ts can still call
// .extend(fireAlarmCommonFields) on each before building the discriminated union -
// once a schema carries its own refinement it becomes a ZodEffects and loses .extend().
// Mirrors src/catalog/sensor/sensor-catalog-kind-coverage-schemas.ts.
//
// Phase 1 survey (docs/fire-alarm-catalog-sources.md, C1/C2): no detector datasheet
// prints a protection radius or area, so detectors here carry no extra fields beyond
// `kind` - YAGNI. C7: capacity is printed only on controllers (panels/hubs), as
// label/value pairs copied exactly from the datasheet's "Device management" (and
// "Zones") rows; display only, never validated against placed devices.
import { z } from "zod";
import { CATALOG_ID_PATTERN, ISO_DATE_PATTERN } from "../shared/catalog-shared-price-and-provenance-schema";

export const CONTROLLER_KINDS = ["control-panel", "wireless-hub"] as const;
export type ControllerKind = (typeof CONTROLLER_KINDS)[number];

export const DETECTOR_KINDS = ["smoke-detector", "heat-detector", "co-detector"] as const;
export type DetectorKind = (typeof DETECTOR_KINDS)[number];

export const ACCESSORY_KINDS = ["expander-module", "keypad", "manual-call-point", "sounder"] as const;
export type AccessoryKind = (typeof ACCESSORY_KINDS)[number];

// One printed compatibility reference, stored once on the controller record (C3).
// Plain object (no discriminated union): every pair found in the phase 1 survey names
// a specific peripheral model, so there is no series-level shape to model (YAGNI).
// `note` records a judgement call (e.g. the source names the panel only by family) -
// omitted when the source statement needs no caveat.
export const compatibilityEntrySchema = z.object({
  modelId: z.string().regex(CATALOG_ID_PATTERN, "modelId must be kebab-case (lowercase, digits, '-', '.')"),
  sourceUrl: z.string().url().regex(/^https:\/\//, "sourceUrl must be an https URL"),
  sourceRetrieved: z.string().regex(ISO_DATE_PATTERN, "sourceRetrieved must be an ISO date (YYYY-MM-DD)"),
  note: z.string().optional(),
});

export type CompatibilityEntry = z.infer<typeof compatibilityEntrySchema>;

// One printed capacity row (e.g. { label: "Zones", value: "96 (up to 48 PIRCAMs)" }) -
// display only, copied exactly as printed, never computed or checked against placed
// devices.
const capacityRowSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});

/** Controller shape (control-panel, wireless-hub): capacity + compatible devices. */
export function controllerSchemaFor(kind: ControllerKind) {
  return z.object({
    kind: z.literal(kind),
    capacityAsPrinted: z.array(capacityRowSchema).default([]),
    compatibleDevices: z.array(compatibilityEntrySchema).default([]),
  });
}

/** Detector shape (smoke/heat/co): no extra fields - nothing printed to model (C1/C2). */
export function detectorSchemaFor(kind: DetectorKind) {
  return z.object({ kind: z.literal(kind) });
}

/** Accessory shape (expander-module, keypad, manual-call-point, sounder): no extra fields. */
export function accessorySchemaFor(kind: AccessoryKind) {
  return z.object({ kind: z.literal(kind) });
}
