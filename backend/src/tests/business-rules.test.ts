import assert from "node:assert/strict";
import test from "node:test";
import { toPrimaryQuantity } from "../services/stock.service";
import { sanitizeRequestMiddleware } from "../middleware/sanitize";
import { listQuerySchema } from "../models/common.model";
import { HttpError } from "../lib/http";

test("toPrimaryQuantity keeps primary quantity unchanged", () => {
  const result = toPrimaryQuantity({
    enteredQuantity: 5,
    unitType: "PRIMARY",
  });
  assert.equal(result, 5);
});

test("toPrimaryQuantity converts secondary using factor", () => {
  const result = toPrimaryQuantity({
    enteredQuantity: 2.5,
    unitType: "SECONDARY",
    factor: 12,
  });
  assert.equal(result, 30);
});

test("toPrimaryQuantity rejects secondary conversion without factor", () => {
  try {
    toPrimaryQuantity({
      enteredQuantity: 1,
      unitType: "SECONDARY",
    });
    assert.fail("Expected missing conversion factor to throw");
  } catch (error) {
    assert.ok(error instanceof HttpError);
    assert.equal(error.statusCode, 400);
  }
});

test("sanitizeRequestMiddleware strips script/html recursively", () => {
  const req = {
    body: {
      name: "  <script>alert('x')</script> John <b>Doe</b> ",
      tags: [" <img> ", "<script>bad()</script>ok"],
      nested: { note: " <b>safe</b> text " },
    },
    query: { search: "  <script>x</script>milk  " },
    params: { id: " <abc> " },
  } as unknown as Parameters<typeof sanitizeRequestMiddleware>[0];

  let nextCalled = false;
  sanitizeRequestMiddleware(
    req,
    {} as Parameters<typeof sanitizeRequestMiddleware>[1],
    () => {
      nextCalled = true;
    },
  );

  assert.equal(nextCalled, true);
  assert.deepEqual(req.body, {
    name: "John bDoe/b",
    tags: ["img", "ok"],
    nested: { note: "bsafe/b text" },
  });
  assert.deepEqual(req.query, { search: "milk" });
  assert.deepEqual(req.params, { id: "abc" });
});

test("listQuerySchema applies defaults and bounds", () => {
  const defaults = listQuerySchema.parse({});
  assert.equal(defaults.page, 1);
  assert.equal(defaults.pageSize, 20);

  const parsed = listQuerySchema.parse({ page: "2", pageSize: "50", search: "abc" });
  assert.equal(parsed.page, 2);
  assert.equal(parsed.pageSize, 50);
  assert.equal(parsed.search, "abc");

  assert.throws(() => listQuerySchema.parse({ page: 0 }));
  assert.throws(() => listQuerySchema.parse({ pageSize: 201 }));
});
