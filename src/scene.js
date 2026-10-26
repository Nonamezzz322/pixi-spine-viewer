import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

export const SCENE_KEY = "pixi-spine-viewer.constructor-scene";

// rebuilt when the scene is loaded, so not saved
const RUNTIME_KEYS = ["imageUrl", "animations", "skins", "slots", "missing"];

export const serializeElement = (el) => Object.fromEntries(Object.entries(el).filter(([key]) => !RUNTIME_KEYS.includes(key)));

// the user files an element is made from
export const getElementFiles = (el) => (el.type === "static" ? [el.file] : el.type === "spine" ? el.files : []).filter(Boolean);

// a file for a saved path: the same path, then a path ending the same way, then the same file name
export const findAssetFile = (files, path) => {
	if (files.has(path)) return files.get(path);
	const lowerPath = path.toLowerCase();
	for (const [key, file] of files) {
		const lowerKey = key.toLowerCase();
		if (lowerKey.endsWith("/" + lowerPath) || lowerPath.endsWith("/" + lowerKey)) return file;
	}
	const name = lowerPath.split("/").pop();
	for (const [key, file] of files) if (key.split("/").pop().toLowerCase() === name) return file;
	return null;
};

const MIME_TYPES = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", json: "application/json", atlas: "text/plain", fnt: "text/plain", xml: "text/xml" };

// loaders pick images by MIME type, which unzipped files do not have on their own
const getMimeType = (path) => MIME_TYPES[path.split(".").pop().toLowerCase()] || "";

// scene.json plus every file the scene uses, under assets/<saved path>
export async function createSceneZip(scene, files) {
	const entries = { "scene.json": strToU8(JSON.stringify(scene, null, 2)) };
	for (const [path, file] of files) entries[`assets/${path}`] = new Uint8Array(await file.arrayBuffer());
	return new Blob([zipSync(entries)], { type: "application/zip" });
}

export async function readSceneZip(zipFile) {
	const entries = unzipSync(new Uint8Array(await zipFile.arrayBuffer()));
	if (!entries["scene.json"]) throw new Error("scene.json not found in the zip");
	const scene = JSON.parse(strFromU8(entries["scene.json"]));
	if (!Array.isArray(scene.elements)) throw new Error("scene.json has no elements");
	const files = new Map();
	for (const [path, data] of Object.entries(entries)) {
		if (!path.startsWith("assets/") || path.endsWith("/")) continue;
		const name = path.slice("assets/".length);
		files.set(name, new File([data], name, { type: getMimeType(name) }));
	}
	return { scene, files };
}

export const downloadFile = (fileName, blob) => {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
};
