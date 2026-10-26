import { test } from "node:test";
import assert from "node:assert/strict";
import { createSceneZip, findAssetFile, getElementFiles, readSceneZip, serializeElement } from "./scene.js";

test("a scene goes through a zip and comes back with its files", async () => {
	const scene = { version: 1, elements: [{ id: 1, type: "static", file: "img/a.png" }] };
	const files = new Map([["img/a.png", new File([new Uint8Array([1, 2, 3])], "img/a.png")]]);
	const zip = await createSceneZip(scene, files);
	const read = await readSceneZip(new File([zip], "scene.zip"));
	assert.deepEqual(read.scene, scene);
	const file = read.files.get("img/a.png");
	assert.equal(file.type, "image/png");
	assert.deepEqual([...new Uint8Array(await file.arrayBuffer())], [1, 2, 3]);
});

test("readSceneZip needs scene.json", async () => {
	const files = new Map([["a.png", new File(["x"], "a.png")]]);
	const zip = await createSceneZip({ elements: [] }, files);
	await assert.doesNotReject(readSceneZip(new File([zip], "ok.zip")));
	const { zipSync } = await import("fflate");
	await assert.rejects(readSceneZip(new File([zipSync({ "a.txt": new Uint8Array([1]) })], "bad.zip")), /scene.json/);
});

test("findAssetFile finds a saved path in picked files", () => {
	const picked = new Map([["export/hero/images/eye.png", "eye"], ["bg.png", "bg"]]);
	assert.equal(findAssetFile(picked, "hero/images/eye.png"), "eye");
	assert.equal(findAssetFile(picked, "bg.png"), "bg");
	assert.equal(findAssetFile(picked, "old/folder/BG.png"), "bg");
	assert.equal(findAssetFile(picked, "none.png"), null);
});

test("saved elements leave out what is rebuilt on load", () => {
	assert.deepEqual(serializeElement({ id: 1, type: "spine", files: ["a.json"], animations: ["x"], slots: [], missing: true }), { id: 1, type: "spine", files: ["a.json"] });
	assert.deepEqual(getElementFiles({ type: "spine", files: ["a.json", "a.png"] }), ["a.json", "a.png"]);
	assert.deepEqual(getElementFiles({ type: "text" }), []);
});
