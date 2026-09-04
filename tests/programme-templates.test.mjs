import test from "node:test";
import assert from "node:assert/strict";
import { programmeTemplate } from "../lib/programme-templates.ts";

test("programme templates provide complete 4, 8 and 12 week coach options", () => {
  for (const length of [4, 8, 12]) {
    const weeks = programmeTemplate(length);
    assert.equal(weeks.length, length);
    assert.deepEqual(
      weeks.map((week) => week[0]),
      Array.from({ length }, (_, index) => index + 1),
    );
    assert.equal(weeks[0][1], "Measure");
    assert.equal(weeks.at(-1)[1], "Perform");
    assert.equal(weeks.at(-1)[3], "Final retest");
  }
});
