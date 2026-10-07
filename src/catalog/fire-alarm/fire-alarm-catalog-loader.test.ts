// Integration tests for the bundled fire-alarm catalog data files: every record
// parses, ids are unique and disjoint from the camera and sensor catalogs, every
// compatibleDevices reference resolves to a non-controller record in this catalog, and
// an empty / zero-record kind does not fail the loader.
import { describe, expect, it } from "vitest";
import { fireAlarmModelArraySchema } from "./fire-alarm-catalog-schema";
import { fireAlarmCatalogDataFiles, fireAlarmModelById, fireAlarmModels } from "./fire-alarm-catalog-loader";
import { cameraModels } from "../camera/camera-catalog-loader";
import { sensorModels } from "../sensor/sensor-catalog-loader";

// [label, raw text, brand folder, device-type folder] of every bundled data file
// (data/<brand>/fire-alarm-<kind>/).
const FILES = fireAlarmCatalogDataFiles.map(
  (file) => [file.label, file.raw, file.brandFolder, file.deviceTypeFolder] as const,
);

describe("fire-alarm catalog data files", () => {
  it.each(FILES)("%s parses and matches the fire-alarm model schema", (_fileLabel, raw) => {
    const parsed: unknown = JSON.parse(raw);
    const result = fireAlarmModelArraySchema.safeParse(parsed);
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(true);
  });

  it.each(FILES)(
    "%s holds only records of its brand and device-type folder",
    (_fileLabel, raw, brandFolder, deviceTypeFolder) => {
      const records = JSON.parse(raw) as Array<{ id: string; brand: string; kind: string }>;
      for (const record of records) {
        expect(record.brand, record.id).toBe(brandFolder);
        expect(`fire-alarm-${record.kind}`, record.id).toBe(deviceTypeFolder);
      }
    },
  );
});

describe("fireAlarmModels (loaded + validated catalog)", () => {
  it("has no duplicate ids", () => {
    const ids = fireAlarmModels.map((model) => model.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("shares no id with the camera or sensor catalog", () => {
    const otherIds = new Set([...cameraModels.map((m) => m.id), ...sensorModels.map((m) => m.id)]);
    for (const model of fireAlarmModels) {
      expect(otherIds.has(model.id), model.id).toBe(false);
    }
  });

  it("has at least one control-panel, wireless-hub and smoke-detector record (G1 kinds obtained in phase 1)", () => {
    const byKind = (kind: string) => fireAlarmModels.filter((model) => model.kind === kind);
    expect(byKind("control-panel").length).toBeGreaterThanOrEqual(1);
    expect(byKind("wireless-hub").length).toBeGreaterThanOrEqual(1);
    expect(byKind("smoke-detector").length).toBeGreaterThanOrEqual(1);
  });

  it("a kind with zero records does not fail the loader (empty array parses)", () => {
    expect(fireAlarmModelArraySchema.safeParse([]).success).toBe(true);
  });

  it("fireAlarmModelById returns the matching record and undefined for unknown ids", () => {
    const first = fireAlarmModels[0];
    expect(first).toBeDefined();
    expect(fireAlarmModelById(first!.id)).toEqual(first);
    expect(fireAlarmModelById("does-not-exist")).toBeUndefined();
  });

  it("every compatibleDevices reference resolves to a non-controller record in this catalog", () => {
    const byId = new Map(fireAlarmModels.map((model) => [model.id, model]));
    const controllerKinds = new Set(["control-panel", "wireless-hub"]);
    for (const model of fireAlarmModels) {
      if (!("compatibleDevices" in model)) continue;
      for (const entry of model.compatibleDevices) {
        const target = byId.get(entry.modelId);
        expect(target, `${model.id} -> ${entry.modelId}`).toBeDefined();
        expect(controllerKinds.has(target!.kind), `${model.id} -> ${entry.modelId}`).toBe(false);
        expect(target!.id, `${model.id} must not reference itself`).not.toBe(model.id);
      }
    }
  });

  it("has at least one printed compatibility pair (G0 requirement)", () => {
    const pairCount = fireAlarmModels
      .filter((model) => "compatibleDevices" in model)
      .reduce((sum, model) => sum + (model as { compatibleDevices: unknown[] }).compatibleDevices.length, 0);
    expect(pairCount).toBeGreaterThanOrEqual(1);
  });
});
