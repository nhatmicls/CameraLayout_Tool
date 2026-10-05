// Loads, validates and indexes the static camera catalog. Bundled at build time
// (via Vite's `?raw` text import) - no runtime network fetch. Throws at import
// time if any record fails schema validation or ids collide, so a broken catalog
// fails the build instead of shipping silently.
import hikvisionRaw from "./data/hikvision-camera-models.json?raw";
import dahuaRaw from "./data/dahua-camera-models.json?raw";
import axisRaw from "./data/axis-camera-models.json?raw";
import { cameraModelArraySchema, type CameraModel } from "./camera-catalog-schema";

function parseBrandCatalog(raw: string, fileLabel: string): CameraModel[] {
  const parsed: unknown = JSON.parse(raw);
  const result = cameraModelArraySchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `Invalid camera catalog data in ${fileLabel}: ${result.error.message}`,
    );
  }
  return result.data;
}

function assertUniqueIds(models: CameraModel[]): void {
  const seen = new Set<string>();
  for (const model of models) {
    if (seen.has(model.id)) {
      throw new Error(`Duplicate camera catalog id: "${model.id}"`);
    }
    seen.add(model.id);
  }
}

const allModels: CameraModel[] = [
  ...parseBrandCatalog(hikvisionRaw, "hikvision-camera-models.json"),
  ...parseBrandCatalog(dahuaRaw, "dahua-camera-models.json"),
  ...parseBrandCatalog(axisRaw, "axis-camera-models.json"),
];

assertUniqueIds(allModels);

/** All validated camera models, bundled statically from the three brand JSON files. */
export const cameraModels: readonly CameraModel[] = allModels;

const modelsById = new Map<string, CameraModel>(allModels.map((model) => [model.id, model]));

/** Look up a single camera model by its catalog id. Returns undefined if not found. */
export function cameraModelById(id: string): CameraModel | undefined {
  return modelsById.get(id);
}

export type { CameraModel, Brand, FormFactor, Lens, ManufacturerDori } from "./camera-catalog-schema";
