import test from "node:test";
import assert from "node:assert/strict";
import { generateCircleFaviconSvg, faviconDataUri } from "./favicon";

test("generateCircleFaviconSvg returns GB badge when logo is null or empty", () => {
  const emptySvg = generateCircleFaviconSvg("");
  assert.ok(emptySvg.includes("<circle"));
  assert.ok(emptySvg.includes(">GB</text>"));

  const nullSvg = generateCircleFaviconSvg(null);
  assert.ok(nullSvg.includes(">GB</text>"));

  const undefinedSvg = generateCircleFaviconSvg(undefined);
  assert.ok(undefinedSvg.includes(">GB</text>"));
});

test("generateCircleFaviconSvg wraps provided logo in a circle clipPath", () => {
  const customSvg = generateCircleFaviconSvg("https://example.com/logo.png");
  assert.ok(customSvg.includes('<clipPath id="circleClip">'));
  assert.ok(customSvg.includes('<circle cx="32" cy="32" r="29" />'));
  assert.ok(customSvg.includes('href="https://example.com/logo.png"'));
  assert.ok(!customSvg.includes(">GB</text>"));
});

test("generateCircleFaviconSvg safely escapes XML entities in logo URL", () => {
  const logoWithQuotes = 'https://example.com/logo.png?v=1&type=main"';
  const customSvg = generateCircleFaviconSvg(logoWithQuotes);
  assert.ok(!customSvg.includes('"https://example.com/logo.png?v=1&type=main""'));
  assert.ok(customSvg.includes('&amp;'));
  assert.ok(customSvg.includes('&quot;'));
});

test("faviconDataUri produces valid data:image/svg+xml URI", () => {
  const uri = faviconDataUri("data:image/png;base64,iVBORw0KGgo=");
  assert.ok(uri.startsWith("data:image/svg+xml;utf8,"));
  assert.ok(uri.includes("circleClip"));
});
