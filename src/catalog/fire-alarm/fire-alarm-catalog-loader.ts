// Loads, validates and indexes the static fire-alarm catalog. Bundled at build time
// (via Vite's eager `?raw` glob over `data/<brand>/fire-alarm-<kind>/*.json`, numbered
// files in number order) - no runtime network fetch. Throws at import time if any
// record fails schema validation, ids collide with each other, an id collides with a
// camera or sensor catalog id, or a compatibleDevices reference does not resolve to a
// non-controller record in this same catalog.
import { FIRE_ALARM_BRAND, fireAlarmModelArraySchema, type FireAlarmModel } from "./fire-alarm-catalog-schema";
import { CONTROLLER_KINDS } from "./fire-alarm-catalog-kind-schemas";
import { orderCatalogDataFiles } from "../shared/catalog-data-file-ordering";
import { cameraModels } from "../camera/camera-catalog-loader";
import { sensorModels } from "../sensor/sensor-catalog-loader";

/** Every bundled fire-alarm data file, in load order (brand folder, then file number). */
export const fireAlarmCatalogDataFiles = orderCatalogDataFiles(
  import.meta.glob<string>("../../../data/*/fire-alarm-*/*.json", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
  [FIRE_ALARM_BRAND],
);

function parseBrandCatalog(raw: string, fileLabel: string): FireAlarmModel[] {
  const parsed: unknown = JSON.parse(raw);
  const result = fireAlarmModelArraySchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid fire-alarm catalog data in ${fileLabel}: ${result.error.message}`);
  }
  return result.data;
}

function assertUniqueIds(models: FireAlarmModel[]): void {
  const seen = new Set<string>();
  for (const model of models) {
    if (seen.has(model.id)) {
      throw new Error(`Duplicate fire-alarm catalog id: "${model.id}"`);
    }
    seen.add(model.id);
  }
}

function assertDisjointFromOtherCatalogs(models: FireAlarmModel[]): void {
  const otherIds = new Set([...cameraModels.map((model) => model.id), ...sensorModels.map((model) => model.id)]);
  for (const model of models) {
    if (otherIds.has(model.id)) {
      throw new Error(`Fire-alarm catalog id "${model.id}" collides with a camera or sensor catalog id`);
    }
  }
}

// Every compatibleDevices[].modelId must resolve to a record in this catalog that is
// neither a controller nor the controller entry itself (compatibility is stored once,
// pointing from controller -> peripheral, never controller -> controller).
function assertCompatibilityReferencesResolve(models: FireAlarmModel[]): void {
  const byId = new Map(models.map((model) => [model.id, model]));
  const controllerKinds = new Set<string>(CONTROLLER_KINDS);
  for (const model of models) {
    if (!("compatibleDevices" in model)) continue;
    for (const entry of model.compatibleDevices) {
      const target = byId.get(entry.modelId);
      if (!target) {
        throw new Error(
          `Fire-alarm catalog "${model.id}" compatibleDevices references unknown modelId "${entry.modelId}"`,
        );
      }
      if (target.id === model.id) {
        throw new Error(`Fire-alarm catalog "${model.id}" compatibleDevices references itself`);
      }
      if (controllerKinds.has(target.kind)) {
        throw new Error(
          `Fire-alarm catalog "${model.id}" compatibleDevices references controller "${entry.modelId}"`,
        );
      }
    }
  }
}

const allModels: FireAlarmModel[] = fireAlarmCatalogDataFiles.flatMap((file) =>
  parseBrandCatalog(file.raw, file.label),
);

assertUniqueIds(allModels);
assertDisjointFromOtherCatalogs(allModels);
assertCompatibilityReferencesResolve(allModels);

/** All validated fire-alarm models, bundled statically from the brand JSON files. */
export const fireAlarmModels: readonly FireAlarmModel[] = allModels;

const modelsById = new Map<string, FireAlarmModel>(allModels.map((model) => [model.id, model]));

/** Look up a single fire-alarm model by its catalog id. Returns undefined if not found. */
export function fireAlarmModelById(id: string): FireAlarmModel | undefined {
  return modelsById.get(id);
}

export type { FireAlarmModel, FireAlarmKind, FireAlarmProductLine } from "./fire-alarm-catalog-schema";
