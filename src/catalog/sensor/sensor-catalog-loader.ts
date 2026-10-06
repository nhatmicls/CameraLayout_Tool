// Loads, validates and indexes the static sensor catalog. Bundled at build time (via
// Vite's eager `?raw` glob over `data/<brand>/sensor-<kind>/*.json`, numbered files in
// number order) - no runtime network fetch. Throws at import time if any
// record fails schema validation, ids collide with each other, or an id collides with a
// camera catalog id (a thermal sensor must never share an id with a thermal camera -
// they are different catalogs and never both store the same physical model).
import { SENSOR_BRANDS, sensorModelArraySchema, type SensorModel } from "./sensor-catalog-schema";
import { orderCatalogDataFiles } from "../shared/catalog-data-file-ordering";
import { cameraModels } from "../camera/camera-catalog-loader";

/** Every bundled sensor data file, in load order (brand order, then folder, then file number). */
export const sensorCatalogDataFiles = orderCatalogDataFiles(
  import.meta.glob<string>("../../../data/*/sensor-*/*.json", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
  SENSOR_BRANDS,
);

function parseBrandCatalog(raw: string, fileLabel: string): SensorModel[] {
  const parsed: unknown = JSON.parse(raw);
  const result = sensorModelArraySchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid sensor catalog data in ${fileLabel}: ${result.error.message}`);
  }
  return result.data;
}

function assertUniqueIds(models: SensorModel[]): void {
  const seen = new Set<string>();
  for (const model of models) {
    if (seen.has(model.id)) {
      throw new Error(`Duplicate sensor catalog id: "${model.id}"`);
    }
    seen.add(model.id);
  }
}

function assertDisjointFromCameraIds(models: SensorModel[]): void {
  const cameraIds = new Set(cameraModels.map((model) => model.id));
  for (const model of models) {
    if (cameraIds.has(model.id)) {
      throw new Error(`Sensor catalog id "${model.id}" collides with a camera catalog id`);
    }
  }
}

const allModels: SensorModel[] = sensorCatalogDataFiles.flatMap((file) =>
  parseBrandCatalog(file.raw, file.label),
);

assertUniqueIds(allModels);
assertDisjointFromCameraIds(allModels);

/** All validated sensor models, bundled statically from the brand JSON files. */
export const sensorModels: readonly SensorModel[] = allModels;

const modelsById = new Map<string, SensorModel>(allModels.map((model) => [model.id, model]));

/** Look up a single sensor model by its catalog id. Returns undefined if not found. */
export function sensorModelById(id: string): SensorModel | undefined {
  return modelsById.get(id);
}

export type { SensorModel, SensorBrand } from "./sensor-catalog-schema";
