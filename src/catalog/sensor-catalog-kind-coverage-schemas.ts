// Coverage-shape schemas for each sensor kind. Plain z.object() definitions only (no
// .refine()/.superRefine() here) so sensor-catalog-schema.ts can still call
// .extend(sensorCommonFields) on each of them before building the discriminated union -
// once a schema carries its own refinement it becomes a ZodEffects and loses .extend().
// All cross-field checks (radii dedup, beam needing a distance, DRI ordering, the
// sourceUrl host check) live in that single outer superRefine instead, mirroring how
// camera-catalog-schema.ts checks lens fields. See docs/sensor-catalog-sources.md for
// the field-form survey (C1-C9) that shaped these shapes.
import { z } from "zod";

// Human/vehicle detection-recognition-identification distances for one thermal lens, as
// printed. detect > recognize > identify is enforced in sensor-catalog-schema.ts.
export const driSchema = z.object({
  detect: z.number().positive(),
  recognize: z.number().positive(),
  identify: z.number().positive(),
});

export type Dri = z.infer<typeof driSchema>;

// PIR coverage: a single detection sector (range + angle), as every surveyed PIR
// datasheet prints it - wall-mount and ceiling-mount alike. angleDeg up to 360 covers a
// ceiling detector's full-circle pattern. No fetched datasheet printed a height-keyed
// diameter table, so that table shape is not modelled here (YAGNI - see C2).
export const pirSchema = z.object({
  kind: z.literal("pir"),
  coverage: z.object({
    rangeM: z.number().positive(),
    angleDeg: z.number().positive().max(360),
    vfovDeg: z.number().positive().max(360).optional(),
  }),
});

// Active IR photoelectric beam (TX+RX pair): outdoor and/or indoor max distance, as
// printed. At least one of the two must be present. Which one applies to a given
// placement (indoor/outdoor) is a Phase 2 PlacedSensor field, not a catalog value.
export const beamSchema = z.object({
  kind: z.literal("beam"),
  maxDistanceOutdoorM: z.number().positive().nullable(),
  maxDistanceIndoorM: z.number().positive().nullable(),
});

// Shock or acoustic glass-break detector: one or more detection radii (one row per
// printed surface/material; surface is the printed material name, or null when the
// datasheet prints a single unqualified radius), plus the glass types printed for a
// glass-break model ([] for shock).
export const vibrationSchema = z.object({
  kind: z.literal("vibration"),
  detection: z.enum(["shock", "glass-break"]),
  radii: z
    .array(
      z.object({
        surface: z.string().nullable(),
        radiusM: z.number().positive(),
      }),
    )
    .min(1),
  glassTypes: z.array(z.string()).default([]),
});

// Thermal sensor: resolution, one lens's focal length and HFOV (VFOV optional, printed
// only - same rule as the camera catalog's vfov*), plus human (always printed) and
// vehicle (nullable - not every datasheet separates it) DRI distances for that lens.
// Bi-spectrum (thermal + visible) models store the thermal channel only; the visible
// channel is described in `notes`, never modelled here and never added to the camera
// catalog (C7).
export const thermalSchema = z.object({
  kind: z.literal("thermal"),
  pixelWidth: z.number().int().positive(),
  pixelHeight: z.number().int().positive(),
  focalMm: z.number().positive(),
  hfovDeg: z.number().positive().max(360),
  vfovDeg: z.number().positive().max(360).optional(),
  detectionRangeM: z.object({
    human: driSchema,
    vehicle: driSchema.nullable(),
  }),
});

export type PirSpec = z.infer<typeof pirSchema>;
export type BeamSpec = z.infer<typeof beamSchema>;
export type VibrationSpec = z.infer<typeof vibrationSchema>;
export type ThermalSpec = z.infer<typeof thermalSchema>;
