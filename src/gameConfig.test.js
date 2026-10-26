import { test } from "node:test";
import assert from "node:assert/strict";
import { getElementConfig } from "./gameConfig.js";

const bitmap = {
	name: "Bitmap 1",
	type: "bitmap",
	x: 0,
	y: 35,
	scale: 0.83,
	portrait: { x: 0, y: 85, scale: 0.92 },
	align: "center",
	fontName: "numbersWin",
	fontSize: 140,
	letterSpacing: 0,
	maxWidth: 0,
	tint: "#EFE2E4",
	incrementTime: 3,
	isShort: true,
	scaleToWidth: 900,
	minFitWidthPx: 0
};

test("a bitmap gives positions, scale, its countup text style and bitmap-value props", () => {
	assert.equal(getElementConfig(bitmap), [
		"// Bitmap 1",
		"positions: { landscape: { x: 0, y: 35 }, portrait: { x: 0, y: 85 } },",
		"scale: { landscape: { x: 0.83, y: 0.83 }, portrait: { x: 0.92, y: 0.92 } },",
		"textStyle: {",
		"    align: 'center',",
		"    fontName: 'numbersWin',",
		"    fontSize: 140,",
		"    letterSpacing: 0,",
		"    tint: 0xefe2e4,",
		"},",
		"countupDuration: 3,",
		"// bitmap-value",
		"short: true,",
		"scaleToWidth: 900,"
	].join("\n"));
});

test("without its own portrait place the landscape one is used for both", () => {
	const config = getElementConfig({ name: "Image 1", type: "static", x: 10, y: -20, scale: 1 });
	assert.match(config, /positions: \{ landscape: \{ x: 10, y: -20 \}, portrait: \{ x: 10, y: -20 \} \}/);
});

test("an element in a spine slot gives the slot name and one position", () => {
	const config = getElementConfig({ ...bitmap, attach: { spineId: 1, slot: "win_amount_for_dev" }, x: 9, y: 52, portrait: null });
	assert.match(config, /^\/\/ Bitmap 1\nspineSlotName: 'win_amount_for_dev',\nposition: \{ x: 9, y: 52 \},\ntextStyle/);
});

test("text style strings are quoted, quotes inside are escaped", () => {
	const config = getElementConfig({ name: "Text 1", type: "text", x: 0, y: 0, scale: 1, style: { fontFamily: "MyriadPro", fill: ["#fff", "#f0f"], dropShadow: true, note: "it's" } });
	assert.match(config, /style: \{\n {4}fontFamily: 'MyriadPro',\n {4}fill: \['#fff', '#f0f'\],\n {4}dropShadow: true,\n {4}note: 'it\\'s',\n\},$/);
});
