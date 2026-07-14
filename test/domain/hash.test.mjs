import assert from "node:assert/strict";
import test from "node:test";

import { canonicalJson } from "../../src/platform/domain/hash.mjs";

test("canonicalJson sorts object keys recursively", () => {
  assert.equal(
    canonicalJson({ z: 1, nested: { beta: true, alpha: false }, a: 2 }),
    '{"a":2,"nested":{"alpha":false,"beta":true},"z":1}',
  );
});

test("canonicalJson rejects values that JSON cannot represent safely", () => {
  assert.throws(() => canonicalJson({ value: undefined }), { code: "non_json_value" });
  assert.throws(() => canonicalJson({ value: Number.NaN }), { code: "non_json_value" });

  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalJson(cyclic), { code: "cyclic_value" });
});

