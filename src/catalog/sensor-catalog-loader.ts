// Loads, validates and indexes the static sensor catalog. Bundled at build time (via
// Vite's `?raw` text import) - no runtime network fetch. Throws at import time if any
// record fails schema validation, ids collide with each other, or an id collides with a
// camera catalog id (a thermal sensor must never share an id with a thermal camera -
// they are different catalogs and never both store the same physical model).
import hikvisionRaw from "./data/hikvision-sensor-models.json?raw";
import dahuaRaw from "./data/dahua-sensor-models.json?raw";
import boschRaw from "./data/bosch-sensor-models.json?raw";
import takexRaw from "./data/takex-sensor-models.json?raw";
import { sensorModelArraySchema, type SensorModel } from "./sensor-catalog-schema";
import { cameraModels } from "./camera-catalog-loader";

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

const allModels: SensorModel[] = [
  ...parseBrandCatalog(hikvisionRaw, "hikvision-sensor-models.json"),
  ...parseBrandCatalog(dahuaRaw, "dahua-sensor-models.json"),
  ...parseBrandCatalog(boschRaw, "bosch-sensor-models.json"),
  ...parseBrandCatalog(takexRaw, "takex-sensor-models.json"),
];

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
