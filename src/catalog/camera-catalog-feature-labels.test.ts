// Unit tests for card badge / properties-panel label formatting.
import { describe, expect, it } from "vitest";
import { cameraModelSchema, type CameraModel } from "./camera-catalog-schema";
import { audioLabel, cameraFeatureBadgeLabels, detectionLabel, ipRateLabel } from "./camera-catalog-feature-labels";

// Minimal valid fixed-lens record; defaults apply for every field not given here.
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

function buildModel(extra: Record<string, unknown> = {}): CameraModel {
  return cameraModelSchema.parse({ ...baseRecord, ...extra });
}

describe("cameraFeatureBadgeLabels", () => {
  it("returns [] when none of the fields are listed", () => {
    expect(cameraFeatureBadgeLabels(buildModel())).toEqual([]);
  });

  it("orders ingress ratings, IK rating, Mic, Speaker, then capitalized detection types", () => {
    const model = buildModel({
      ingressRatings: ["IP66", "IP67"],
      ikRating: "IK10",
      hasBuiltInMic: true,
      hasBuiltInSpeaker: true,
      detectionTypes: ["human", "vehicle", "face", "license-plate"],
    });
    expect(cameraFeatureBadgeLabels(model)).toEqual(["IP66", "IP67", "IK10", "Mic", "Speaker", "Human", "Vehicle", "Face", "License plate"]);
  });
});

describe("ipRateLabel", () => {
  it("reads None when no ingress rating is printed", () => {
    expect(ipRateLabel(buildModel())).toBe("None");
  });

  it("joins ingress ratings with '/' and appends the IK rating", () => {
    expect(ipRateLabel(buildModel({ ingressRatings: ["IP66", "IP67"], ikRating: "IK10" }))).toBe("IP66/IP67, IK10");
  });

  it("handles ingress-only, and IK with no ingress rating", () => {
    expect(ipRateLabel(buildModel({ ingressRatings: ["IP67"] }))).toBe("IP67");
    expect(ipRateLabel(buildModel({ ikRating: "IK10" }))).toBe("None, IK10");
  });
});

describe("audioLabel", () => {
  it("returns null when nothing is listed", () => {
    expect(audioLabel(buildModel())).toBeNull();
  });

  it("wording for audio-in only", () => {
    expect(audioLabel(buildModel({ hasAudioInPort: true }))).toBe("Input");
  });

  it("wording for audio-out only", () => {
    expect(audioLabel(buildModel({ hasAudioOutPort: true }))).toBe("Output");
  });

  it("wording for both ports plus mic and speaker", () => {
    const model = buildModel({
      hasBuiltInMic: true,
      hasBuiltInSpeaker: true,
      hasAudioInPort: true,
      hasAudioOutPort: true,
    });
    expect(audioLabel(model)).toBe("Built-in mic, built-in speaker, IO");
  });
});

describe("detectionLabel", () => {
  it("returns null when empty", () => {
    expect(detectionLabel(buildModel())).toBeNull();
  });

  it("joins in stored order, capitalizing only the first word", () => {
    expect(detectionLabel(buildModel({ detectionTypes: ["human", "vehicle"] }))).toBe("Human, vehicle");
    expect(detectionLabel(buildModel({ detectionTypes: ["vehicle", "human"] }))).toBe("Vehicle, human");
    expect(detectionLabel(buildModel({ detectionTypes: ["human", "license-plate"] }))).toBe("Human, license plate");
  });
});
