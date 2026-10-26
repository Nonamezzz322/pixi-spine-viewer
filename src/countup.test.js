import { test } from "node:test";
import assert from "node:assert/strict";
import { createBitmapCountup, easeCountup, formatBitmapValue, shortValue, toNumberText } from "./countup.js";

test("shortValue shortens like the game", () => {
	assert.equal(shortValue("999"), "999");
	assert.equal(shortValue("12500"), "12.50k");
	assert.equal(shortValue("1250000"), "1.25m");
	assert.equal(shortValue("1000"), "1.00k");
	assert.equal(shortValue("-2500"), "-2.50k");
	assert.equal(shortValue("12.5"), "12.5");
});

test("toNumberText keeps digits and the first separator", () => {
	assert.equal(toNumberText("12a5"), "125");
	assert.equal(toNumberText("12,50"), "12,50");
	assert.equal(toNumberText("0.5.."), "0.5");
	assert.equal(toNumberText("1.2,3"), "1.23");
	assert.equal(toNumberText("WIN"), "");
});

test("formatBitmapValue shows cents with the typed separator", () => {
	assert.equal(formatBitmapValue("12", { decimals: 2 }), "12.00");
	assert.equal(formatBitmapValue("12,5", { decimals: 2 }), "12,50");
	assert.equal(formatBitmapValue("12.567", { decimals: 2 }), "12.57");
	assert.equal(formatBitmapValue("12.5", {}), "12.5");
	assert.equal(formatBitmapValue("12500", { isShort: true }), "12.50k");
	assert.equal(formatBitmapValue("12500,75", { decimals: 2, isShort: true }), "12,50k");
	assert.equal(formatBitmapValue("999,5", { decimals: 2, isShort: true }), "999,50");
	assert.equal(formatBitmapValue("", { decimals: 2 }), "");
});

test("createBitmapCountup steps keep decimals and separator", () => {
	const cents = createBitmapCountup("12,5", { decimals: 2 });
	assert.equal(cents.target, 12.5);
	assert.equal(cents.format(0), "0,00");
	assert.equal(cents.format(12.5), "12,50");
	assert.equal(createBitmapCountup("12.50", { decimals: 0 }).format(3), "3.00");
	assert.equal(createBitmapCountup("1250000", { isShort: true }).format(999), "999");
	assert.equal(createBitmapCountup("1250000", { isShort: true }).format(1500), "1.50k");
	assert.equal(createBitmapCountup("", {}), null);
});

test("easeCountup starts fast and ends at the target", () => {
	assert.equal(easeCountup(0), 0);
	assert.equal(easeCountup(1), 1);
	assert.ok(easeCountup(0.5) > 0.5);
});
