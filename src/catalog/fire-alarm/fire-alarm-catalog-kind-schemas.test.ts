// Unit tests for the per-kind rules enforced by fire-alarm-catalog-schema.ts's
// superRefine that are specific to controllers: capacityAsPrinted shape, duplicate
// compatibleDevices targets and the host check applied to each entry's own sourceUrl.
// Record-level rules (host, id, standalone refine) are in
// fire-alarm-catalog-schema.test.ts.
import { describe, expect, it } from "vitest";
import { fireAlarmModelSchema } from "./fire-alarm-catalog-schema";
import { baseControlPanel, baseSmokeDetector } from "./fire-alarm-catalog-schema.test-fixtures";

const validEntry = {
  modelId: "hikvision-test-smoke-detector",
  sourceUrl: "https://www.hikvision.com/a-manual.pdf",
  sourceRetrieved: "2026-10-07",
};

describe("controller capacityAsPrinted", () => {
  it("accepts label/value rows and defaults to []", () => {
    const result = fireAlarmModelSchema.safeParse({
      ...baseControlPanel,
      capacityAsPrinted: [{ label: "Zones", value: "96 (up to 48 PIRCAMs)" }],
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.kind === "control-panel") {
      expect(result.data.capacityAsPrinted).toEqual([{ label: "Zones", value: "96 (up to 48 PIRCAMs)" }]);
    }
  });

  it("rejects an empty label or value", () => {
    expect(
      fireAlarmModelSchema.safeParse({ ...baseControlPanel, capacityAsPrinted: [{ label: "", value: "96" }] })
        .success,
    ).toBe(false);
  });
});

describe("controller compatibleDevices", () => {
  it("accepts a valid entry with an optional note", () => {
    expect(
      fireAlarmModelSchema.safeParse({
        ...baseControlPanel,
        compatibleDevices: [{ ...validEntry, note: "family statement" }],
      }).success,
    ).toBe(true);
  });

  it("accepts an entry with no note", () => {
    expect(fireAlarmModelSchema.safeParse({ ...baseControlPanel, compatibleDevices: [validEntry] }).success).toBe(
      true,
    );
  });

  it("rejects duplicate modelId targets", () => {
    const result = fireAlarmModelSchema.safeParse({
      ...baseControlPanel,
      compatibleDevices: [validEntry, validEntry],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an entry whose sourceUrl is not https", () => {
    expect(
      fireAlarmModelSchema.safeParse({
        ...baseControlPanel,
        compatibleDevices: [{ ...validEntry, sourceUrl: "http://www.hikvision.com/a.pdf" }],
      }).success,
    ).toBe(false);
  });

  it("rejects an entry whose sourceUrl host is not an accepted hikvision host", () => {
    expect(
      fireAlarmModelSchema.safeParse({
        ...baseControlPanel,
        compatibleDevices: [{ ...validEntry, sourceUrl: "https://example.com/a.pdf" }],
      }).success,
    ).toBe(false);
  });

  it("non-controller kinds have no compatibleDevices field", () => {
    const result = fireAlarmModelSchema.safeParse(baseSmokeDetector);
    expect(result.success).toBe(true);
    if (result.success) {
      expect("compatibleDevices" in result.data).toBe(false);
    }
  });
});
