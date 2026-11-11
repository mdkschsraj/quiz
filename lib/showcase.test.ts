import { test } from "node:test";
import assert from "node:assert/strict";
import { sniffImage } from "./imageType.ts";
import { splitRemaining } from "./countdown.ts";

test("recognises JPEG, PNG and WebP by content", () => {
  assert.equal(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]))?.ext, "jpg");
  assert.equal(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.ext, "png");
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]);
  assert.equal(sniffImage(webp)?.type, "image/webp");
});

test("rejects other files, including scripts and SVG", () => {
  const enc = new TextEncoder();
  assert.equal(sniffImage(enc.encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>")), null);
  assert.equal(sniffImage(enc.encode("<script>alert(1)</script>")), null);
  assert.equal(sniffImage(new Uint8Array([])), null);
  assert.equal(sniffImage(new Uint8Array([0xff, 0xd8])), null);
});

test("countdown splits into days, hours, minutes and seconds", () => {
  assert.deepEqual(splitRemaining(((2 * 24 + 3) * 3600 + 4 * 60 + 5) * 1000), { days: 2, hours: 3, minutes: 4, seconds: 5 });
  assert.deepEqual(splitRemaining(-5000), { days: 0, hours: 0, minutes: 0, seconds: 0 });
  assert.deepEqual(splitRemaining(999), { days: 0, hours: 0, minutes: 0, seconds: 0 });
});
