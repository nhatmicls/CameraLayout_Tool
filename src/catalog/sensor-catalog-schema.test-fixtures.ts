// Shared minimal-valid-record fixtures for the sensor catalog schema tests (not a test
// file itself - excluded from Vitest's `src/**/*.test.ts` glob by name).
export const basePir = {
  id: "hikvision-test-pir",
  kind: "pir",
  brand: "hikvision",
  model: "TEST-PIR",
  coverage: { rangeM: 12, angleDeg: 85.9 },
  sourceUrl: "https://www.hikvision.com/test-datasheet.pdf",
  sourceRetrieved: "2026-10-06",
};

export const baseBeam = {
  id: "takex-test-beam",
  kind: "beam",
  brand: "takex",
  model: "TEST-BEAM",
  maxDistanceOutdoorM: 30,
  maxDistanceIndoorM: 60,
  sourceUrl: "https://takex.com/test-datasheet.pdf",
  sourceRetrieved: "2026-10-06",
};

export const baseVibration = {
  id: "bosch-test-vibration",
  kind: "vibration",
  detection: "shock",
  brand: "bosch",
  model: "TEST-VIBRATION",
  radii: [{ surface: "concrete", radiusM: 5 }],
  sourceUrl: "https://boschsecurity.com/test-datasheet.pdf",
  sourceRetrieved: "2026-10-06",
};

export const baseThermal = {
  id: "dahua-test-thermal",
  kind: "thermal",
  brand: "dahua",
  model: "TEST-THERMAL",
  pixelWidth: 256,
  pixelHeight: 192,
  focalMm: 3.5,
  hfovDeg: 50.6,
  detectionRangeM: {
    human: { detect: 146, recognize: 38, identify: 19 },
    vehicle: null,
  },
  sourceUrl: "https://www.dahuasecurity.com/test-datasheet.pdf",
  sourceRetrieved: "2026-10-06",
};
