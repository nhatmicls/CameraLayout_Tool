// Pure sidebar filter logic for the camera catalog: brand / form-factor / priced-only
// (ported verbatim from the sidebar) plus a data-driven list of "feature" filters
// (outdoor rating, mic, detection types). Lives in src/catalog, not src/domain, because
// it needs the CameraModel type and src/domain may not import src/catalog.
import type { Brand, CameraModel, DetectionType, FormFactor } from "./camera-catalog-schema";

export type CatalogFeatureFilterKey =
  | "outdoor-rated"
  | "built-in-mic"
  | "human-detection"
  | "vehicle-detection";

interface CatalogFeatureFilter {
  key: CatalogFeatureFilterKey;
  label: string;
  matches: (model: CameraModel) => boolean;
}

// Captures the two digits right after "IP", ignoring a trailing "K" (e.g. "IP69K").
const INGRESS_DIGITS_PATTERN = /^IP(\d)(\d)K?$/;

// "Outdoor (IP65+)": a runtime reading of printed ingress codes, never stored on the
// catalog record. First digit (dust) >= 6 and second digit (water) >= 5 on any listed
// rating - the IP65 floor named in the filter label.
function isOutdoorRated(model: CameraModel): boolean {
  return model.ingressRatings.some((rating) => {
    const match = INGRESS_DIGITS_PATTERN.exec(rating);
    if (!match) return false;
    const dustDigit = Number(match[1]);
    const waterDigit = Number(match[2]);
    return dustDigit >= 6 && waterDigit >= 5;
  });
}

function hasDetectionType(model: CameraModel, type: DetectionType): boolean {
  return model.detectionTypes.includes(type);
}

/** One entry = one checkbox in the sidebar, one AND-combined condition in `matchesCatalogFilters`. */
export const CATALOG_FEATURE_FILTERS: readonly CatalogFeatureFilter[] = [
  { key: "outdoor-rated", label: "Outdoor (IP65+)", matches: isOutdoorRated },
  { key: "built-in-mic", label: "Built-in mic", matches: (model) => model.hasBuiltInMic },
  { key: "human-detection", label: "Human detection", matches: (model) => hasDetectionType(model, "human") },
  { key: "vehicle-detection", label: "Vehicle detection", matches: (model) => hasDetectionType(model, "vehicle") },
];

const FEATURE_FILTERS_BY_KEY = new Map(CATALOG_FEATURE_FILTERS.map((filter) => [filter.key, filter]));

export interface CatalogFilterCriteria {
  brand: Brand | "all";
  formFactor: FormFactor | "all";
  pricedOnly: boolean;
  features: readonly CatalogFeatureFilterKey[];
}

/** AND-combines brand / form-factor / priced-only (the pre-existing three filters, unchanged) with every selected feature filter. */
export function matchesCatalogFilters(model: CameraModel, criteria: CatalogFilterCriteria): boolean {
  return (
    (criteria.brand === "all" || model.brand === criteria.brand) &&
    (criteria.formFactor === "all" || model.formFactor === criteria.formFactor) &&
    (!criteria.pricedOnly || model.priceVn !== null) &&
    criteria.features.every((key) => FEATURE_FILTERS_BY_KEY.get(key)?.matches(model) ?? false)
  );
}
