// Compile-time proof that `src/domain/sensor-types.ts`'s `SensorModelSpec` has not
// drifted from the frozen catalog schema (`sensor-catalog-schema.ts` +
// `sensor-catalog-kind-coverage-schemas.ts`). Sibling to `sensor-catalog-loader.test.ts`
// in spirit: if the two shapes diverge, this file fails `tsc`/`vitest` to build at all,
// not just one assertion. Domain code itself must never import this catalog module -
// this is the one place the structural mirror is checked.
import { describe, expect, it } from "vitest";
import type { SensorModelSpec } from "../domain/sensor-types";
import { sensorModels } from "./sensor-catalog-loader";

describe("SensorModelSpec mirrors the sensor catalog schema", () => {
  it("every loaded sensor model is assignable to the domain SensorModelSpec", () => {
    // The assignment itself is the proof: it only compiles if every catalog
    // variant (pir/beam/vibration/thermal) structurally satisfies SensorModelSpec.
    const specs: readonly SensorModelSpec[] = sensorModels;
    expect(specs.length).toBe(sensorModels.length);
  });
});
