// Unit tests for the protection / audio / detection / vertical-FOV fields of the catalog schema.
import { describe, expect, it } from "vitest";
import { cameraModelSchema } from "./camera-catalog-schema";

// Minimal valid fixed-lens record carrying none of the defaulted fields.
const baseRecord = {
  id: "hikvision-test-model-2.8mm",
  brand: "hikvision",
  model: "TEST-MODEL",
  formFactor: "dome",
  resolutionMp: 4,
  pixelWidth: 2688,
  pixelHeight: 1520,
  lens: { kind: "fixed", focalMm: 2.8, hfovDeg: 103 },
  illuminationRangeM: 30,
  illuminationType: "ir",
  manufacturerDoriM: null,
  sourceUrl: "https://www.hikvision.com/test-datasheet.pdf",
  sourceRetrieved: "2026-10-05",
};

function parses(extra: Record<string, unknown>): boolean {
  return cameraModelSchema.safeParse({ ...baseRecord, ...extra }).success;
}

describe("cameraModelSchema protection/audio/detection defaults", () => {
  it("parses a record without any new key and applies the defaults", () => {
    const model = cameraModelSchema.parse(baseRecord);
    expect(model.ingressRatings).toEqual([]);
    expect(model.ikRating).toBeNull();
    expect(model.hasBuiltInMic).toBe(false);
    expect(model.hasBuiltInSpeaker).toBe(false);
    expect(model.hasAudioInPort).toBe(false);
    expect(model.hasAudioOutPort).toBe(false);
    expect(model.detectionTypes).toEqual([]);
  });
});

describe("ingressRatings", () => {
  it.each([[["IP67"]], [["IP66", "IP67"]], [["IP69K"]], [["IP42"]]])("accepts %j", (value) => {
    expect(parses({ ingressRatings: value })).toBe(true);
  });

  it.each([[["IP6"]], [["ip67"]], [["IP66/IP67"]], [["IP 67"]], [["IP67", "IP67"]]])(
    "rejects %j",
    (value) => {
      expect(parses({ ingressRatings: value })).toBe(false);
    },
  );

  it("reports duplicates on the ingressRatings path", () => {
    const result = cameraModelSchema.safeParse({ ...baseRecord, ingressRatings: ["IP67", "IP67"] });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === "ingressRatings")).toBe(true);
  });
});

describe("ikRating", () => {
  it.each(["IK08", "IK10", null])("accepts %j", (value) => {
    expect(parses({ ikRating: value })).toBe(true);
  });

  it.each(["IK12", "IK8", "ik10", "10"])("rejects %j", (value) => {
    expect(parses({ ikRating: value })).toBe(false);
  });
});

describe("detectionTypes", () => {
  it("accepts known target classes", () => {
    expect(parses({ detectionTypes: ["human", "vehicle"] })).toBe(true);
  });

  it.each([[["person"]], [["human", "human"]]])("rejects %j", (value) => {
    expect(parses({ detectionTypes: value })).toBe(false);
  });
});

describe("audio flags", () => {
  it.each(["hasBuiltInMic", "hasBuiltInSpeaker", "hasAudioInPort", "hasAudioOutPort"])(
    "rejects a non-boolean %s",
    (key) => {
      expect(parses({ [key]: "yes" })).toBe(false);
      expect(parses({ [key]: true })).toBe(true);
    },
  );
});

describe("datasheet vertical FOV", () => {
  const varifocal = { kind: "varifocal", focalMinMm: 2.7, focalMaxMm: 13.5, hfovWideDeg: 104, hfovTeleDeg: 29 };

  it("fixed lens: optional, kept as printed (fisheye values above 180 allowed)", () => {
    expect(cameraModelSchema.parse(baseRecord).lens).not.toHaveProperty("vfovDeg");
    expect(parses({ lens: { ...baseRecord.lens, vfovDeg: 54 } })).toBe(true);
    expect(parses({ lens: { ...baseRecord.lens, vfovDeg: 185 } })).toBe(true);
    expect(parses({ lens: { ...baseRecord.lens, vfovDeg: 0 } })).toBe(false);
    expect(parses({ lens: { ...baseRecord.lens, vfovDeg: 361 } })).toBe(false);
  });

  it("varifocal lens: both ends or neither", () => {
    expect(parses({ lens: varifocal })).toBe(true);
    expect(parses({ lens: { ...varifocal, vfovWideDeg: 54, vfovTeleDeg: 16 } })).toBe(true);
    expect(parses({ lens: { ...varifocal, vfovWideDeg: 54 } })).toBe(false);
    expect(parses({ lens: { ...varifocal, vfovTeleDeg: 16 } })).toBe(false);
  });

  it("varifocal lens: wide must exceed tele", () => {
    expect(parses({ lens: { ...varifocal, vfovWideDeg: 16, vfovTeleDeg: 16 } })).toBe(false);
    expect(parses({ lens: { ...varifocal, vfovWideDeg: 16, vfovTeleDeg: 54 } })).toBe(false);
  });
});
