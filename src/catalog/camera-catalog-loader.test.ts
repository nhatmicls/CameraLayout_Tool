import { describe, expect, it } from "vitest";
import {
  cameraModelArraySchema,
  DETECTION_TYPES,
  type Brand,
  type CameraModel,
} from "./camera-catalog-schema";
import { cameraModelById, cameraModels } from "./camera-catalog-loader";
import hikvisionRaw from "./data/hikvision-camera-models.json?raw";
import dahuaRaw from "./data/dahua-camera-models.json?raw";
import axisRaw from "./data/axis-camera-models.json?raw";

const BRANDS: readonly Brand[] = ["hikvision", "dahua", "axis"];
const MIN_RECORDS_PER_BRAND = 4;

describe("camera catalog data files", () => {
  it.each([
    ["hikvision-camera-models.json", hikvisionRaw],
    ["dahua-camera-models.json", dahuaRaw],
    ["axis-camera-models.json", axisRaw],
  ])("%s parses and matches the camera model schema", (_fileLabel, raw) => {
    const parsed: unknown = JSON.parse(raw);
    const result = cameraModelArraySchema.safeParse(parsed);
    expect(result.success).toBe(true);
  });
});

// Schema defaults would hide a record that was never transcribed, so these checks
// read the RAW JSON: every record must state all seven fields explicitly.
const TRANSCRIBED_FEATURE_KEYS = [
  "ingressRatings",
  "ikRating",
  "hasBuiltInMic",
  "hasBuiltInSpeaker",
  "hasAudioInPort",
  "hasAudioOutPort",
  "detectionTypes",
] as const;

describe("protection / audio / detection transcription", () => {
  it.each([
    ["hikvision-camera-models.json", hikvisionRaw],
    ["dahua-camera-models.json", dahuaRaw],
    ["axis-camera-models.json", axisRaw],
  ])("%s states all seven fields on every raw record", (_fileLabel, raw) => {
    const records = JSON.parse(raw) as Record<string, unknown>[];
    for (const record of records) {
      const missing = TRANSCRIBED_FEATURE_KEYS.filter((key) => !Object.hasOwn(record, key));
      expect(missing, `record ${String(record.id)}`).toEqual([]);
    }
  });

  it("lists detectionTypes in canonical order (human, vehicle, face)", () => {
    for (const model of cameraModels) {
      const canonical = DETECTION_TYPES.filter((type) => model.detectionTypes.includes(type));
      expect(model.detectionTypes, model.id).toEqual(canonical);
    }
  });

  it("gives lens variants of one body (same sourceUrl + model) identical values", () => {
    const byBody = new Map<string, string>();
    for (const model of cameraModels) {
      const bodyKey = `${model.sourceUrl}|${model.model}`;
      const values = JSON.stringify(TRANSCRIBED_FEATURE_KEYS.map((key) => model[key]));
      const seen = byBody.get(bodyKey);
      if (seen === undefined) {
        byBody.set(bodyKey, values);
      } else {
        expect(values, model.id).toBe(seen);
      }
    }
  });
});

describe("cameraModels (loaded + validated catalog)", () => {
  it("has no duplicate ids", () => {
    const ids = cameraModels.map((model) => model.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every sourceUrl host matches the record's brand domain", () => {
    const brandDomain: Record<Brand, string> = {
      hikvision: "hikvision.com",
      dahua: "dahuasecurity.com",
      axis: "axis.com",
    };
    for (const model of cameraModels) {
      const host = new URL(model.sourceUrl).host;
      expect(host.endsWith(brandDomain[model.brand])).toBe(true);
    }
  });

  it("every varifocal lens has wide HFOV greater than tele HFOV, and max focal greater than min", () => {
    for (const model of cameraModels) {
      if (model.lens.kind === "varifocal") {
        expect(model.lens.hfovWideDeg).toBeGreaterThan(model.lens.hfovTeleDeg);
        expect(model.lens.focalMaxMm).toBeGreaterThan(model.lens.focalMinMm);
      }
    }
  });

  it("every HFOV value (fixed or varifocal) is within (0, 360]", () => {
    for (const model of cameraModels) {
      const hfovValues =
        model.lens.kind === "fixed"
          ? [model.lens.hfovDeg]
          : [model.lens.hfovWideDeg, model.lens.hfovTeleDeg];
      for (const hfov of hfovValues) {
        expect(hfov).toBeGreaterThan(0);
        expect(hfov).toBeLessThanOrEqual(360);
      }
    }
  });

  it.each(BRANDS)("has at least %i sourced records for brand %s", (brand) => {
    const count = cameraModels.filter((model) => model.brand === brand).length;
    expect(count).toBeGreaterThanOrEqual(MIN_RECORDS_PER_BRAND);
  });

  it.each(BRANDS)("brand %s covers dome/turret + bullet + wide-or-varifocal", (brand) => {
    const brandModels = cameraModels.filter((model) => model.brand === brand);
    const hasDomeOrTurret = brandModels.some(
      (m) => m.formFactor === "dome" || m.formFactor === "turret",
    );
    const hasBullet = brandModels.some((m) => m.formFactor === "bullet");
    const hasWideOrVarifocalOrFisheye = brandModels.some(
      (m) =>
        m.formFactor === "fisheye" ||
        m.lens.kind === "varifocal" ||
        (m.lens.kind === "fixed" && m.lens.hfovDeg >= 120),
    );
    expect(hasDomeOrTurret).toBe(true);
    expect(hasBullet).toBe(true);
    expect(hasWideOrVarifocalOrFisheye).toBe(true);
  });

  it("flags (does not silently ship) HFOV values in the unreliable 140-179deg rectilinear range", () => {
    // Rectilinear cone math is unreliable at very wide fixed angles; records in this
    // band must carry a note calling that out instead of shipping unflagged.
    const flagged: CameraModel[] = [];
    for (const model of cameraModels) {
      const hfovValues =
        model.lens.kind === "fixed"
          ? [model.lens.hfovDeg]
          : [model.lens.hfovWideDeg, model.lens.hfovTeleDeg];
      const inWarnRange = hfovValues.some((hfov) => hfov >= 140 && hfov <= 179);
      if (inWarnRange) {
        flagged.push(model);
      }
    }
    // None of the current records fall in this band (max fixed HFOV is 130deg, the
    // Dahua fisheye is modeled separately at 185deg). This test documents the rule
    // and will fail loudly if a future record lands in the band without review.
    expect(flagged).toHaveLength(0);
  });

  it("cameraModelById returns the matching record and undefined for unknown ids", () => {
    const first = cameraModels[0];
    expect(first).toBeDefined();
    expect(cameraModelById(first!.id)).toEqual(first);
    expect(cameraModelById("does-not-exist")).toBeUndefined();
  });
});
