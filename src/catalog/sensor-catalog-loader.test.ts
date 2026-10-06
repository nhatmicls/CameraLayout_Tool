// Integration tests for the bundled sensor catalog data files: every record parses,
// ids are unique and disjoint from the camera catalog, and each kind obtained during
// the Phase 1 survey has at least one record.
import { describe, expect, it } from "vitest";
import { sensorModelArraySchema, type SensorBrand } from "./sensor-catalog-schema";
import { sensorModelById, sensorModels } from "./sensor-catalog-loader";
import { cameraModels } from "./camera-catalog-loader";
import hikvisionRaw from "./data/hikvision-sensor-models.json?raw";
import dahuaRaw from "./data/dahua-sensor-models.json?raw";
import boschRaw from "./data/bosch-sensor-models.json?raw";
import takexRaw from "./data/takex-sensor-models.json?raw";

const SENSOR_BRANDS: readonly SensorBrand[] = ["hikvision", "dahua", "bosch", "takex"];

describe("sensor catalog data files", () => {
  it.each([
    ["hikvision-sensor-models.json", hikvisionRaw],
    ["dahua-sensor-models.json", dahuaRaw],
    ["bosch-sensor-models.json", boschRaw],
    ["takex-sensor-models.json", takexRaw],
  ])("%s parses and matches the sensor model schema", (_fileLabel, raw) => {
    const parsed: unknown = JSON.parse(raw);
    const result = sensorModelArraySchema.safeParse(parsed);
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(true);
  });
});

describe("sensorModels (loaded + validated catalog)", () => {
  it("has no duplicate ids", () => {
    const ids = sensorModels.map((model) => model.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("shares no id with the camera catalog", () => {
    const cameraIds = new Set(cameraModels.map((model) => model.id));
    for (const model of sensorModels) {
      expect(cameraIds.has(model.id), model.id).toBe(false);
    }
  });

  it("every brand present in the data is a known SENSOR_BRANDS value", () => {
    for (const model of sensorModels) {
      expect(SENSOR_BRANDS).toContain(model.brand);
    }
  });

  // G1 requires >= 1 verified record per obtainable kind. All six survey targets
  // (PIR wall, PIR ceiling, IR beam, shock, acoustic glass-break, thermal) were
  // obtainable this round, so every kind (and both pir/vibration sub-forms) has data.
  it("has at least one record for pir, beam, vibration (shock), vibration (glass-break) and thermal", () => {
    const byKind = (kind: string) => sensorModels.filter((model) => model.kind === kind);
    expect(byKind("pir").length).toBeGreaterThanOrEqual(1);
    expect(byKind("beam").length).toBeGreaterThanOrEqual(1);
    expect(byKind("thermal").length).toBeGreaterThanOrEqual(1);

    const vibrationModels = byKind("vibration") as Array<{ detection: string }>;
    expect(vibrationModels.some((model) => model.detection === "shock")).toBe(true);
    expect(vibrationModels.some((model) => model.detection === "glass-break")).toBe(true);
  });

  it("a kind with zero records does not fail the loader (empty array parses)", () => {
    expect(sensorModelArraySchema.safeParse([]).success).toBe(true);
  });

  it("sensorModelById returns the matching record and undefined for unknown ids", () => {
    const first = sensorModels[0];
    expect(first).toBeDefined();
    expect(sensorModelById(first!.id)).toEqual(first);
    expect(sensorModelById("does-not-exist")).toBeUndefined();
  });

  it("thermal records have no id or model collision with the camera catalog's thermal-free set", () => {
    // Thermal sensors and cameras are disjoint catalogs by design (plan decision: one
    // model in exactly one catalog); this just re-confirms via model string too.
    const sensorThermalModels = sensorModels.filter((m) => m.kind === "thermal").map((m) => m.model);
    const cameraModelStrings = new Set(cameraModels.map((m) => m.model));
    for (const model of sensorThermalModels) {
      expect(cameraModelStrings.has(model)).toBe(false);
    }
  });
});
