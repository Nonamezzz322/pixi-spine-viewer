import { test } from "node:test";
import assert from "node:assert/strict";
import { findImageFile, findSpineFiles } from "./files.js";

test("findImageFile keeps same-named files in different folders apart", () => {
	const urls = { "spine/images/sym1/bg.png": "u1", "spine/images/sym2/bg.png": "u2" };
	assert.equal(findImageFile("sym1/bg", urls).url, "u1");
	assert.equal(findImageFile("sym2/bg", urls).url, "u2");
});

test("findImageFile falls back to the file name", () => {
	assert.equal(findImageFile("old/path/eye", { "images/Eye.PNG": "u" }).url, "u");
	assert.equal(findImageFile("eye", {}), null);
});

test("findSpineFiles pairs JSON and atlas by name", () => {
	assert.deepEqual(findSpineFiles(["hero.json", "hero.atlas", "hero.png"]), { jsonFileName: "hero.json", atlasFileName: "hero.atlas" });
	assert.deepEqual(findSpineFiles(["hero.json", "bg.atlas", "hero.atlas"]), { jsonFileName: "hero.json", atlasFileName: "hero.atlas" });
	assert.deepEqual(findSpineFiles(["hero_ske.json", "hero.atlas"]), { jsonFileName: "hero_ske.json", atlasFileName: "hero.atlas" });
	assert.deepEqual(findSpineFiles(["a/hero.json", "a/settings.json", "a/hero.atlas"]), { jsonFileName: "a/hero.json", atlasFileName: "a/hero.atlas" });
	assert.deepEqual(findSpineFiles(["hero.json", "hero.png"]), { jsonFileName: "hero.json", atlasFileName: null });
});

test("findSpineFiles reports files it cannot pick", () => {
	assert.ok(findSpineFiles(["hero.png"]).error);
	assert.ok(findSpineFiles(["bg.json", "bg.atlas", "hero.json", "hero.atlas"]).error);
	assert.ok(findSpineFiles(["hero.json", "a.atlas", "b.atlas"]).error);
});
