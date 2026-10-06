// Pure formatting of the protection / audio / detection fields into card badge strings
// and properties-panel sentences. Lives in src/catalog (see camera-catalog-feature-filters.ts
// for why). The datasheet being silent on a field is never printed as "no" / "none" -
// callers show the caller-chosen "not listed" fallback when these return null.
import type { CameraModel, DetectionType } from "./camera-catalog-schema";

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

// Lower-case wording per detection type; badges capitalize each, the row capitalizes once.
const DETECTION_WORDING: Record<DetectionType, string> = {
  human: "human",
  vehicle: "vehicle",
  face: "face",
  "license-plate": "license plate",
};

/** Card badge chips, in order: each ingress rating, IK rating, Mic, Speaker, then capitalized detection types. Positives only. */
export function cameraFeatureBadgeLabels(model: CameraModel): string[] {
  const labels: string[] = [...model.ingressRatings];
  if (model.ikRating) labels.push(model.ikRating);
  if (model.hasBuiltInMic) labels.push("Mic");
  if (model.hasBuiltInSpeaker) labels.push("Speaker");
  labels.push(...model.detectionTypes.map((type) => capitalize(DETECTION_WORDING[type])));
  return labels;
}

/** Properties panel "IP rate" row, e.g. "IP66/IP67, IK10". No ingress rating printed reads "None". */
export function ipRateLabel(model: CameraModel): string {
  const ingress = model.ingressRatings.length > 0 ? model.ingressRatings.join("/") : "None";
  return model.ikRating ? `${ingress}, ${model.ikRating}` : ingress;
}

/** Properties panel "Audio" row, e.g. "Built-in mic, built-in speaker, IO" (ports: Input / Output / IO). null = nothing listed. */
export function audioLabel(model: CameraModel): string | null {
  const parts: string[] = [];
  if (model.hasBuiltInMic) parts.push("built-in mic");
  if (model.hasBuiltInSpeaker) parts.push("built-in speaker");
  if (model.hasAudioInPort && model.hasAudioOutPort) parts.push("IO");
  else if (model.hasAudioInPort) parts.push("input");
  else if (model.hasAudioOutPort) parts.push("output");
  return parts.length > 0 ? capitalize(parts.join(", ")) : null;
}

/** Properties panel "Detection" row, e.g. "Human, vehicle" (stored order, sentence-cased). null = nothing listed. */
export function detectionLabel(model: CameraModel): string | null {
  if (model.detectionTypes.length === 0) return null;
  return capitalize(model.detectionTypes.map((type) => DETECTION_WORDING[type]).join(", "));
}
