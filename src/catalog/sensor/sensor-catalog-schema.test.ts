// Unit tests for the sensor catalog schema's record-level rules: discriminated-union
// parsing per kind, the sourceUrl host check, id/date formatting (shared with the
// camera catalog) and convertedFromFeet. Per-kind coverage-shape rules (pir/beam/
// vibration/thermal) are in sensor-catalog-kind-coverage-schemas.test.ts.
import { describe, expect, it } from "vitest";
import { sensorModelSchema, sensorModelArraySchema } from "./sensor-catalog-schema";
import { basePir, baseBeam, baseVibration, baseThermal } from "./sensor-catalog-schema.test-fixtures";

describe("sensorModelSchema: one minimal record per kind", () => {
  it.each([
    ["pir", basePir],
    ["beam", baseBeam],
    ["vibration", baseVibration],
    ["thermal", baseThermal],
  ])("parses a minimal %s record and applies defaults", (_kind, record) => {
    const result = sensorModelSchema.safeParse(record);
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(true);
    if (result.success) {
      expect(result.data.priceVn).toBeNull();
      expect(result.data.purchaseLinks).toBeNull();
    }
  });

  it("empty array is a valid catalog", () => {
    expect(sensorModelArraySchema.safeParse([]).success).toBe(true);
  });
});

describe("sourceUrl host per brand", () => {
  it.each([
    ["hikvision", "https://assets.hikvision.com/a.pdf", basePir],
    ["dahua", "https://material.dahuasecurity.com/a.pdf", baseThermal],
    ["dahua", "https://france.dahuatech.com/a.pdf", baseThermal],
    ["bosch", "https://cdn.commerce.boschsecurity.com/a.pdf", baseVibration],
    ["takex", "https://takex.com/a.pdf", baseBeam],
  ] as const)("accepts %s host %s", (brand, url, record) => {
    expect(sensorModelSchema.safeParse({ ...record, brand, sourceUrl: url }).success).toBe(true);
  });

  it("rejects a hikvision record hosted elsewhere", () => {
    expect(sensorModelSchema.safeParse({ ...basePir, sourceUrl: "https://example.com/a.pdf" }).success).toBe(false);
  });

  it("rejects a dahua record on a non dahuasecurity/dahuatech host", () => {
    expect(
      sensorModelSchema.safeParse({ ...baseThermal, sourceUrl: "https://www.dahua.com/a.pdf" }).success,
    ).toBe(false);
  });

  it("rejects a non-https sourceUrl", () => {
    expect(sensorModelSchema.safeParse({ ...basePir, sourceUrl: "http://www.hikvision.com/a.pdf" }).success).toBe(
      false,
    );
  });

  // "https:///a.pdf" parses with host "a.pdf" (not an empty host) - this covers that host
  // failing the brand-host mismatch check, same as any other wrong host.
  it("rejects a sourceUrl whose host doesn't match the brand (e.g. a malformed https:///a.pdf)", () => {
    expect(sensorModelSchema.safeParse({ ...basePir, sourceUrl: "https:///a.pdf" }).success).toBe(false);
  });
});

describe("convertedFromFeet", () => {
  it("is optional and defaults to absent", () => {
    const result = sensorModelSchema.parse(basePir);
    expect(result.convertedFromFeet).toBeUndefined();
  });

  it("accepts true", () => {
    expect(sensorModelSchema.safeParse({ ...basePir, convertedFromFeet: true }).success).toBe(true);
  });
});

describe("id pattern", () => {
  it.each(["Hikvision-Test", "hikvision_test", "hikvision test"])("rejects %s", (id) => {
    expect(sensorModelSchema.safeParse({ ...basePir, id }).success).toBe(false);
  });
});
