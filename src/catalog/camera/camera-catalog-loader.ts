// Loads, validates and indexes the static camera catalog. Bundled at build time
// (via Vite's eager `?raw` glob over `data/<brand>/camera-<formFactor>/*.json`) - no
// runtime network fetch. A form factor's records may span several numbered files
// (`..._01.json`, `..._02.json`); they load in number order. Throws at import
// time if any record fails schema validation or ids collide, so a broken catalog
// fails the build instead of shipping silently.
import { BRANDS, cameraModelArraySchema, type CameraModel } from "./camera-catalog-schema";
import { orderCatalogDataFiles } from "../shared/catalog-data-file-ordering";

/** Every bundled camera data file, in load order (brand order, then folder, then file number). */
export const cameraCatalogDataFiles = orderCatalogDataFiles(
  import.meta.glob<string>("../../../data/*/camera-*/*.json", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
  BRANDS,
);

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

const allModels: CameraModel[] = cameraCatalogDataFiles.flatMap((file) =>
  parseBrandCatalog(file.raw, file.label),
);

assertUniqueIds(allModels);

/** All validated camera models, bundled statically from the brand JSON files. */
export const cameraModels: readonly CameraModel[] = allModels;

const modelsById = new Map<string, CameraModel>(allModels.map((model) => [model.id, model]));

/** Look up a single camera model by its catalog id. Returns undefined if not found. */
export function cameraModelById(id: string): CameraModel | undefined {
  return modelsById.get(id);
}

export type { CameraModel, Brand, DetectionType, FormFactor, Lens, ManufacturerDori } from "./camera-catalog-schema";
