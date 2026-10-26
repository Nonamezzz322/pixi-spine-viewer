import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_MASK_POINTS, findPolygonHandle, getEdgeMiddle, isInsidePolygon } from "./polygon.js";

test("isInsidePolygon works for a square and a concave shape", () => {
	assert.equal(isInsidePolygon(DEFAULT_MASK_POINTS, 0, 0), true);
	assert.equal(isInsidePolygon(DEFAULT_MASK_POINTS, 250, 0), false);
	// a "U": the notch between the arms is outside
	const u = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 30 }, { x: 20, y: 30 }, { x: 20, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 30 }, { x: 0, y: 30 }];
	assert.equal(isInsidePolygon(u, 5, 20), true);
	assert.equal(isInsidePolygon(u, 15, 20), false);
});

test("findPolygonHandle prefers points, then edge middles", () => {
	assert.deepEqual(findPolygonHandle(DEFAULT_MASK_POINTS, 196, -203, 9), { kind: "point", index: 1 });
	assert.deepEqual(findPolygonHandle(DEFAULT_MASK_POINTS, 3, -200, 9), { kind: "edge", index: 0 });
	assert.deepEqual(findPolygonHandle(DEFAULT_MASK_POINTS, -200, 4, 9), { kind: "edge", index: 3 });
	assert.equal(findPolygonHandle(DEFAULT_MASK_POINTS, 0, 0, 9), null);
});

test("getEdgeMiddle wraps from the last point to the first", () => {
	assert.deepEqual(getEdgeMiddle(DEFAULT_MASK_POINTS, 3), { x: -200, y: 0 });
});
