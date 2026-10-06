// Unit tests for the per-kind coverage rules enforced by sensor-catalog-schema.ts's
// superRefine (beam distance, radii dedup, DRI ordering) plus the pir angle bound that
// lives directly on pirSchema. Record-level rules (host, id, convertedFromFeet) are in
// sensor-catalog-schema.test.ts.
import { describe, expect, it } from "vitest";
import { sensorModelSchema } from "./sensor-catalog-schema";
import { basePir, baseBeam, baseVibration, baseThermal } from "./sensor-catalog-schema.test-fixtures";

describe("pir coverage", () => {
  it.each([85.9, 360, 1])("accepts angleDeg %s", (angleDeg) => {
    expect(sensorModelSchema.safeParse({ ...basePir, coverage: { ...basePir.coverage, angleDeg } }).success).toBe(
      true,
    );
  });

  it.each([0, 361, -10])("rejects angleDeg %s", (angleDeg) => {
    expect(sensorModelSchema.safeParse({ ...basePir, coverage: { ...basePir.coverage, angleDeg } }).success).toBe(
      false,
    );
  });

  it("accepts an optional vfovDeg", () => {
    expect(
      sensorModelSchema.safeParse({ ...basePir, coverage: { ...basePir.coverage, vfovDeg: 54 } }).success,
    ).toBe(true);
  });
});

describe("beam distances", () => {
  it("accepts outdoor only", () => {
    expect(sensorModelSchema.safeParse({ ...baseBeam, maxDistanceIndoorM: null }).success).toBe(true);
  });

  it("accepts indoor only", () => {
    expect(sensorModelSchema.safeParse({ ...baseBeam, maxDistanceOutdoorM: null }).success).toBe(true);
  });

  it("rejects both null", () => {
    const result = sensorModelSchema.safeParse({
      ...baseBeam,
      maxDistanceOutdoorM: null,
      maxDistanceIndoorM: null,
    });
    expect(result.success).toBe(false);
  });
});

describe("vibration radii and glassTypes", () => {
  it("defaults glassTypes to []", () => {
    const result = sensorModelSchema.safeParse(baseVibration);
    expect(result.success).toBe(true);
    if (result.success && result.data.kind === "vibration") {
      expect(result.data.glassTypes).toEqual([]);
    }
  });

  it("accepts multiple distinct radii rows", () => {
    expect(
      sensorModelSchema.safeParse({
        ...baseVibration,
        radii: [
          { surface: "concrete", radiusM: 5 },
          { surface: "drywall", radiusM: 3 },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects duplicate radii rows", () => {
    const result = sensorModelSchema.safeParse({
      ...baseVibration,
      radii: [
        { surface: "concrete", radiusM: 5 },
        { surface: "concrete", radiusM: 5 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty radii array", () => {
    expect(sensorModelSchema.safeParse({ ...baseVibration, radii: [] }).success).toBe(false);
  });

  it("accepts a glass-break record with glass types", () => {
    expect(
      sensorModelSchema.safeParse({
        ...baseVibration,
        detection: "glass-break",
        radii: [{ surface: null, radiusM: 8 }],
        glassTypes: ["Float", "Plate"],
      }).success,
    ).toBe(true);
  });
});

describe("thermal DRI ordering", () => {
  it("accepts a non-null vehicle DRI that also decreases", () => {
    expect(
      sensorModelSchema.safeParse({
        ...baseThermal,
        detectionRangeM: {
          human: { detect: 146, recognize: 38, identify: 19 },
          vehicle: { detect: 389, recognize: 97, identify: 49 },
        },
      }).success,
    ).toBe(true);
  });

  it("rejects human detect <= recognize", () => {
    const result = sensorModelSchema.safeParse({
      ...baseThermal,
      detectionRangeM: { human: { detect: 30, recognize: 38, identify: 19 }, vehicle: null },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-null vehicle DRI that does not decrease", () => {
    const result = sensorModelSchema.safeParse({
      ...baseThermal,
      detectionRangeM: {
        human: { detect: 146, recognize: 38, identify: 19 },
        vehicle: { detect: 49, recognize: 97, identify: 389 },
      },
    });
    expect(result.success).toBe(false);
  });
});
