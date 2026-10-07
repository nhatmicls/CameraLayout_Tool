// Compile-time proof that `src/domain/fire-alarm/fire-alarm-device-types.ts`'s
// `FireAlarmModelSpec` has not drifted from the frozen catalog schema
// (`fire-alarm-catalog-schema.ts` + `fire-alarm-catalog-kind-schemas.ts`). Sibling to
// `sensor-model-spec-assignability.test.ts` in spirit: if the two shapes diverge, this file
// fails `tsc`/`vitest` to build at all, not just one assertion. Domain code itself must
// never import this catalog module - this is the one place the structural mirror is checked.
import { describe, expect, it } from "vitest";
import type { FireAlarmModelSpec } from "../../domain/fire-alarm/fire-alarm-device-types";
import { fireAlarmModels } from "./fire-alarm-catalog-loader";

describe("FireAlarmModelSpec mirrors the fire-alarm catalog schema", () => {
  it("every loaded fire-alarm model is assignable to the domain FireAlarmModelSpec", () => {
    // The assignment itself is the proof: it only compiles if every catalog variant
    // (controller/detector/accessory) structurally satisfies FireAlarmModelSpec.
    const specs: readonly FireAlarmModelSpec[] = fireAlarmModels;
    expect(specs.length).toBe(fireAlarmModels.length);
  });
});
