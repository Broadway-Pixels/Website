import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

test("automatic theme follows the visitor's local time", async () => {
  const source = await readFile(new URL("../theme.js", import.meta.url), "utf8");
  const documentElement = { dataset: {}, style: {} };
  const context = {
    Date,
    document: {
      documentElement,
      querySelector: () => null,
      querySelectorAll: () => [],
    },
    localStorage: {
      getItem: () => null,
      removeItem: () => {},
      setItem: () => {},
    },
    window: { setInterval: () => 0 },
  };
  vm.runInNewContext(source, context);

  assert.equal(context.window.BroadwayPixelsTheme.themeForTime(new Date(2026, 6, 22, 6, 59)), "dark");
  assert.equal(context.window.BroadwayPixelsTheme.themeForTime(new Date(2026, 6, 22, 7, 0)), "light");
  assert.equal(context.window.BroadwayPixelsTheme.themeForTime(new Date(2026, 6, 22, 18, 59)), "light");
  assert.equal(context.window.BroadwayPixelsTheme.themeForTime(new Date(2026, 6, 22, 19, 0)), "dark");
});

