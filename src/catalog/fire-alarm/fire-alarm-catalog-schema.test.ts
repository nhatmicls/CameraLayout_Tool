// Unit tests for the fire-alarm catalog schema's record-level rules: discriminated-union
// parsing per kind, the sourceUrl host check, the standalone refine and id/date
// formatting (shared with camera/sensor). Compatibility-entry and capacity rules are in
// fire-alarm-catalog-kind-schemas.test.ts.
import { describe, expect, it } from "vitest";
import { fireAlarmModelSchema, fireAlarmModelArraySchema } from "./fire-alarm-catalog-schema";
import {
  baseControlPanel,
  baseWirelessHub,
  baseSmokeDetector,
  baseHeatDetector,
  baseCoDetector,
  baseExpanderModule,
  baseKeypad,
  baseManualCallPoint,
  baseSounder,
} from "./fire-alarm-catalog-schema.test-fixtures";

describe("fireAlarmModelSchema: one minimal record per kind", () => {
  it.each([
    ["control-panel", baseControlPanel],
    ["wireless-hub", baseWirelessHub],
    ["smoke-detector", baseSmokeDetector],
    ["heat-detector", baseHeatDetector],
    ["co-detector", baseCoDetector],
    ["expander-module", baseExpanderModule],
    ["keypad", baseKeypad],
    ["manual-call-point", baseManualCallPoint],
    ["sounder", baseSounder],
  ])("parses a minimal %s record and applies defaults", (_kind, record) => {
    const result = fireAlarmModelSchema.safeParse(record);
    expect(result.success, JSON.stringify(result.success ? null : result.error.issues)).toBe(true);
    if (result.success) {
      expect(result.data.priceVn).toBeNull();
      expect(result.data.purchaseLinks).toBeNull();
      expect(result.data.certificationsAsPrinted).toEqual([]);
      if (result.data.kind === "control-panel" || result.data.kind === "wireless-hub") {
        expect(result.data.capacityAsPrinted).toEqual([]);
        expect(result.data.compatibleDevices).toEqual([]);
      }
    }
  });

  it("empty array is a valid catalog", () => {
    expect(fireAlarmModelArraySchema.safeParse([]).success).toBe(true);
  });
});

describe("sourceUrl host check", () => {
  it.each(["https://www.hikvision.com/a.pdf", "https://assets.hikvision.com/a.pdf", "https://www.hikvision.vn/a.pdf"])(
    "accepts %s",
    (url) => {
      expect(fireAlarmModelSchema.safeParse({ ...baseControlPanel, sourceUrl: url }).success).toBe(true);
    },
  );

  it("rejects a non-hikvision host", () => {
    expect(fireAlarmModelSchema.safeParse({ ...baseControlPanel, sourceUrl: "https://example.com/a.pdf" }).success).toBe(
      false,
    );
  });

  it("rejects a non-https sourceUrl", () => {
    expect(
      fireAlarmModelSchema.safeParse({ ...baseControlPanel, sourceUrl: "http://www.hikvision.com/a.pdf" }).success,
    ).toBe(false);
  });
});

describe("productLine === 'standalone' requires worksStandalone: true", () => {
  it("rejects standalone + worksStandalone false", () => {
    expect(
      fireAlarmModelSchema.safeParse({ ...baseSmokeDetector, productLine: "standalone", worksStandalone: false })
        .success,
    ).toBe(false);
  });

  it("accepts standalone + worksStandalone true", () => {
    expect(
      fireAlarmModelSchema.safeParse({ ...baseSmokeDetector, productLine: "standalone", worksStandalone: true })
        .success,
    ).toBe(true);
  });

  it("accepts non-standalone productLine with worksStandalone false", () => {
    expect(fireAlarmModelSchema.safeParse(baseSmokeDetector).success).toBe(true);
  });
});

describe("id pattern", () => {
  it.each(["Hikvision-Test", "hikvision_test", "hikvision test"])("rejects %s", (id) => {
    expect(fireAlarmModelSchema.safeParse({ ...baseControlPanel, id }).success).toBe(false);
  });
});

describe("certificationsAsPrinted", () => {
  it("accepts printed certifications", () => {
    expect(
      fireAlarmModelSchema.safeParse({ ...baseSmokeDetector, certificationsAsPrinted: ["EN 14604 Certified"] })
        .success,
    ).toBe(true);
  });
});

describe("notes", () => {
  it("is optional", () => {
    const result = fireAlarmModelSchema.parse(baseControlPanel);
    expect(result.notes).toBeUndefined();
  });

  it("accepts a notes string", () => {
    expect(fireAlarmModelSchema.safeParse({ ...baseControlPanel, notes: "a note" }).success).toBe(true);
  });
});
