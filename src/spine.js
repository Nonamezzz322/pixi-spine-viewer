import { BaseTexture } from "pixi.js";
import { Spine, TextureAtlas } from "pixi-spine";
import { AtlasAttachmentLoader, SkeletonJson } from "@pixi-spine/runtime-4.1";
import { findImageFile, findSpineFiles } from "./files";

function expandSequencePath(basePath, seq) {
	const count = seq.count || 0;
	const digits = seq.digits || 0;
	const start = seq.start !== undefined ? seq.start : 1;
	const paths = [];
	for (let i = 0; i < count; i++) {
		const frame = String(start + i);
		paths.push(basePath + "0".repeat(Math.max(0, digits - frame.length)) + frame);
	}
	return paths;
}

function extractImageNames(jsonData) {
	const imageNames = new Set();
	const skins = jsonData.skins;
	if (!skins) return imageNames;
	const skinList = Array.isArray(skins)
		? skins
		: Object.keys(skins).map((k) => ({ attachments: skins[k] }));
	for (const skin of skinList) {
		const slots = skin.attachments;
		if (!slots || typeof slots !== "object") continue;
		for (const slotName in slots) {
			const atts = slots[slotName];
			for (const attKey in atts) {
				const att = atts[attKey];
				const type = att.type || "region";
				if (type === "region" || type === "mesh" || type === "linkedmesh" || type === "weightedmesh" || type === "skinnedmesh") {
					const name = att.name || attKey;
					const path = att.path || name;
					if (att.sequence) {
						for (const framePath of expandSequencePath(path, att.sequence)) {
							imageNames.add(framePath);
						}
					} else {
						imageNames.add(path);
					}
				}
			}
		}
	}
	return imageNames;
}

const PLACEHOLDER_URL = (() => {
	const c = document.createElement("canvas");
	c.width = 2; c.height = 2;
	return c.toDataURL();
})();

function generateAtlasFromImages(jsonData, fileURLs) {
	return new Promise((resolve, reject) => {
		const imageNames = extractImageNames(jsonData);
		if (imageNames.size === 0) {
			reject(new Error("No image references found in JSON"));
			return;
		}
		console.log(`[SpineViewer] generateAtlasFromImages: ${imageNames.size} images to load`);
		const entries = [];
		let pending = imageNames.size;
		const checkDone = () => {
			if (pending > 0) return;
			if (entries.length === 0) {
				reject(new Error("Could not load any referenced images"));
				return;
			}
			console.log(`[SpineViewer] All ${entries.length} images loaded, generating atlas`);
			// group regions by fileName (multiple regions can share the same image file)
			const pages = new Map();
			for (const e of entries) {
				if (!pages.has(e.fileName)) pages.set(e.fileName, { width: e.width, height: e.height, regions: [] });
				pages.get(e.fileName).regions.push(e);
			}
			let atlas = "";
			let first = true;
			for (const [fileName, page] of pages) {
				if (!first) atlas += "\n";
				first = false;
				atlas += `${fileName}\nsize: ${page.width},${page.height}\nformat: RGBA8888\nfilter: Linear,Linear\nrepeat: none\n`;
				for (const r of page.regions) {
					atlas += `${r.regionName}\n  rotate: false\n  xy: 0, 0\n  size: ${r.width}, ${r.height}\n  orig: ${r.width}, ${r.height}\n  offset: 0, 0\n  index: -1\n`;
				}
			}
			resolve(atlas);
		};
		for (const imgName of imageNames) {
			const match = findImageFile(imgName, fileURLs);
			if (!match) {
				// create placeholder so region still exists in atlas
				console.warn("Image not found for region:", imgName, "— using placeholder");
				const placeholderKey = "__placeholder_" + imgName + ".png";
				fileURLs[placeholderKey] = PLACEHOLDER_URL;
				entries.push({ regionName: imgName, fileName: placeholderKey, width: 2, height: 2 });
				pending--;
				checkDone();
				continue;
			}
			const img = new Image();
			img.onload = () => {
				entries.push({ regionName: imgName, fileName: match.fileName, width: img.naturalWidth, height: img.naturalHeight });
				pending--;
				checkDone();
			};
			img.onerror = () => {
				console.warn("Failed to load image for region:", imgName, "— using placeholder");
				const placeholderKey = "__placeholder_" + imgName + ".png";
				fileURLs[placeholderKey] = PLACEHOLDER_URL;
				entries.push({ regionName: imgName, fileName: placeholderKey, width: 2, height: 2 });
				pending--;
				checkDone();
			};
			img.src = match.url;
		}
	});
}

// new BaseTexture, not BaseTexture.from: a cached texture would be shared, and destroying one spine would break the others
function getTextureForLine(line, fileURLs) {
	if (fileURLs[line]) return new BaseTexture(fileURLs[line]);
	const lowerLine = line.toLowerCase();
	for (const key in fileURLs) {
		if (key.toLowerCase() === lowerLine) return new BaseTexture(fileURLs[key]);
	}
	const baseLine = lowerLine.split("/").pop();
	for (const key in fileURLs) {
		if (key.split("/").pop().toLowerCase() === baseLine) return new BaseTexture(fileURLs[key]);
	}
	return null;
}

// Reads the dropped spine files. The caller owns the returned blob URLs and must revoke them.
export async function readSpineFiles(files) {
	const filesMap = {};
	for (let i = 0; i < files.length; i++) {
		filesMap[files[i].name] = files[i];
	}
	const { jsonFileName, atlasFileName, error } = findSpineFiles(Object.keys(filesMap));
	if (error) throw new Error(error);
	const fileURLs = {};
	for (const name in filesMap) {
		fileURLs[name] = URL.createObjectURL(filesMap[name]);
	}
	try {
		const jsonData = JSON.parse(await filesMap[jsonFileName].text());
		const atlasText = atlasFileName
			? await filesMap[atlasFileName].text()
			: await generateAtlasFromImages(jsonData, fileURLs);
		return { jsonData, atlasText, fileURLs, jsonFileName };
	} catch (err) {
		for (const url of Object.values(fileURLs)) URL.revokeObjectURL(url);
		throw err;
	}
}

// Waits for the atlas page textures, then reads the skeleton. The caller owns pageTextures and must destroy them.
export async function createSkeletonData(jsonData, atlasText, fileURLs) {
	const pageTextures = [];
	try {
		const spineAtlas = new TextureAtlas(atlasText, (line, callback) => {
			let texture = getTextureForLine(line, fileURLs);
			if (!texture) {
				console.warn("Texture not found for page:", line, "— using placeholder");
				texture = new BaseTexture(PLACEHOLDER_URL);
			}
			pageTextures.push(texture);
			callback(texture);
		});
		const pendingTextures = pageTextures.filter((t) => !t.valid);
		console.log(`[Spine] Atlas: ${spineAtlas.pages.length} pages, ${spineAtlas.regions.length} regions, ${pendingTextures.length} pending textures`);
		await Promise.all(pendingTextures.map((t) => new Promise((resolve) => {
			t.once("loaded", resolve);
			t.once("error", resolve);
		})));
		const skeletonData = new SkeletonJson(new AtlasAttachmentLoader(spineAtlas)).readSkeletonData(jsonData);
		// Pre-set region for sequence attachments so Spine constructor
		// can create meshes with valid textures
		for (const skin of skeletonData.skins) {
			if (skin.attachments) {
				for (let si = 0; si < skin.attachments.length; si++) {
					const slotAtts = skin.attachments[si];
					if (!slotAtts) continue;
					for (const attName in slotAtts) {
						const att = slotAtts[attName];
						if (att && att.sequence && !att.region) {
							att.region = att.sequence.regions[att.sequence.setupIndex];
						}
					}
				}
			}
		}
		return { skeletonData, pageTextures };
	} catch (err) {
		for (const texture of pageTextures) texture.destroy();
		throw err;
	}
}

export function createSpine(skeletonData) {
	const spine = new Spine(skeletonData);
	// Patch setMeshRegion to guard against null textures
	const origSetMeshRegion = spine.setMeshRegion.bind(spine);
	spine.setMeshRegion = (attachment, mesh, region) => {
		if (!region || !region.texture) return;
		origSetMeshRegion(attachment, mesh, region);
	};
	return spine;
}
