// Unit tests for the catalog sidebar's combined filter predicate.
import { describe, expect, it } from "vitest";
import { cameraModelSchema, type CameraModel } from "./camera-catalog-schema";
import {
  CATALOG_FEATURE_FILTERS,
  matchesCatalogFilters,
  type CatalogFilterCriteria,
} from "./camera-catalog-feature-filters";

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

const EMPTY_CRITERIA: CatalogFilterCriteria = {
  brand: "all",
  formFactor: "all",
  pricedOnly: false,
  features: [],
};

describe("matchesCatalogFilters - old three filters, behaviour unchanged", () => {
  it("matches everything when criteria is empty", () => {
    expect(matchesCatalogFilters(buildModel(), EMPTY_CRITERIA)).toBe(true);
  });

  it("filters by brand", () => {
    const dahuaModel = buildModel({
      brand: "dahua",
      id: "dahua-test-model-2.8mm",
      sourceUrl: "https://www.dahuasecurity.com/test-datasheet.pdf",
    });
    expect(matchesCatalogFilters(dahuaModel, { ...EMPTY_CRITERIA, brand: "hikvision" })).toBe(false);
    expect(matchesCatalogFilters(dahuaModel, { ...EMPTY_CRITERIA, brand: "dahua" })).toBe(true);
  });

  it("filters by form factor", () => {
    const bulletModel = buildModel({ formFactor: "bullet" });
    expect(matchesCatalogFilters(bulletModel, { ...EMPTY_CRITERIA, formFactor: "dome" })).toBe(false);
    expect(matchesCatalogFilters(bulletModel, { ...EMPTY_CRITERIA, formFactor: "bullet" })).toBe(true);
  });

  it("filters priced-only", () => {
    const unpriced = buildModel();
    expect(matchesCatalogFilters(unpriced, { ...EMPTY_CRITERIA, pricedOnly: true })).toBe(false);

    const priced = buildModel({
      priceVn: { amountVnd: 1_000_000, sourceUrl: "https://example.vn/product", retrieved: "2026-10-05" },
    });
    expect(matchesCatalogFilters(priced, { ...EMPTY_CRITERIA, pricedOnly: true })).toBe(true);
  });
});

describe("matchesCatalogFilters - outdoor-rated", () => {
  it.each([
    [["IP67"], true],
    [["IP66", "IP67"], true],
    [["IP65"], true],
    [["IP69K"], true],
    [["IP42"], false],
    [["IP54"], false],
    [[], false],
  ])("ingressRatings %j -> %s", (ingressRatings, expected) => {
    const model = buildModel({ ingressRatings });
    expect(matchesCatalogFilters(model, { ...EMPTY_CRITERIA, features: ["outdoor-rated"] })).toBe(expected);
  });
});

describe("matchesCatalogFilters - built-in-mic", () => {
  it("true when hasBuiltInMic is true, false otherwise", () => {
    expect(matchesCatalogFilters(buildModel({ hasBuiltInMic: true }), { ...EMPTY_CRITERIA, features: ["built-in-mic"] })).toBe(true);
    expect(matchesCatalogFilters(buildModel({ hasBuiltInMic: false }), { ...EMPTY_CRITERIA, features: ["built-in-mic"] })).toBe(false);
  });
});

describe("matchesCatalogFilters - human/vehicle detection", () => {
  it("true when the detection type is listed, false otherwise", () => {
    expect(
      matchesCatalogFilters(buildModel({ detectionTypes: ["human"] }), { ...EMPTY_CRITERIA, features: ["human-detection"] }),
    ).toBe(true);
    expect(matchesCatalogFilters(buildModel(), { ...EMPTY_CRITERIA, features: ["human-detection"] })).toBe(false);

    expect(
      matchesCatalogFilters(buildModel({ detectionTypes: ["vehicle"] }), { ...EMPTY_CRITERIA, features: ["vehicle-detection"] }),
    ).toBe(true);
    expect(matchesCatalogFilters(buildModel(), { ...EMPTY_CRITERIA, features: ["vehicle-detection"] })).toBe(false);
  });
});

describe("matchesCatalogFilters - two features selected", () => {
  it("ANDs them: both must match", () => {
    const model = buildModel({ hasBuiltInMic: true, detectionTypes: ["human"] });
    expect(matchesCatalogFilters(model, { ...EMPTY_CRITERIA, features: ["built-in-mic", "human-detection"] })).toBe(true);
    expect(matchesCatalogFilters(model, { ...EMPTY_CRITERIA, features: ["built-in-mic", "vehicle-detection"] })).toBe(false);
  });
});

describe("CATALOG_FEATURE_FILTERS", () => {
  it("has a unique key per entry", () => {
    const keys = CATALOG_FEATURE_FILTERS.map((filter) => filter.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
