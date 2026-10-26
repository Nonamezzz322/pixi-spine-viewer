import { BaseTexture, BitmapFont, BitmapFontData, Rectangle, Texture, autoDetectFormat } from "pixi.js";
import { downloadFile } from "./scene";

// frame names the game's bitmap loader turns into characters (core: bitmap-loader.behaviour.ts)
const NAMED_CHARS = { dot: ".", comma: ",", usd: "$", eur: "€", space: " ", dash: "-", plus: "+" };

export const getCharFromName = (name) => ([...name].length === 1 ? name : NAMED_CHARS[name.toLowerCase()] ?? "");

const getBaseName = (path) => path.split("/").pop().replace(/\.[^.]+$/, "");

const loadImage = (url) => new Promise((resolve, reject) => {
	const image = new Image();
	image.onload = () => resolve(image);
	image.onerror = () => reject(new Error(`can not load image ${url}`));
	image.src = url;
});

// a loaded image stays drawable after its blob URL is revoked
const loadFileImage = async (file) => {
	const url = URL.createObjectURL(file);
	try {
		return await loadImage(url);
	} finally {
		URL.revokeObjectURL(url);
	}
};

const PRESET_PREFIX = "@preset/";

// file is the path of the glyph's image, so a saved scene can point to it
const createGlyph = (char, image, rect, metrics = {}, file = "") => {
	const { x, y, w, h } = rect;
	const preview = document.createElement("canvas");
	const size = Math.min(1, 40 / Math.max(w, h, 1));
	preview.width = Math.max(1, Math.round(w * size));
	preview.height = Math.max(1, Math.round(h * size));
	if (w > 0 && h > 0) preview.getContext("2d").drawImage(image, x, y, w, h, 0, 0, preview.width, preview.height);
	return {
		char,
		file,
		image,
		x,
		y,
		w,
		h,
		xoffset: metrics.xoffset ?? 0,
		yoffset: metrics.yoffset ?? 0,
		xadvance: metrics.xadvance ?? w,
		texture: new Texture(BaseTexture.from(image), new Rectangle(x, y, w, h)),
		preview: preview.toDataURL()
	};
};

// TexturePacker / @gamzix/packer sheet; frame names are characters or dot, comma, usd…
export async function readSheetGlyphs(files) {
	const jsonFile = files.find((file) => file.name.toLowerCase().endsWith(".json"));
	if (!jsonFile) throw new Error("pick the sheet .json together with its image");
	const json = JSON.parse(await jsonFile.text());
	const imageName = (json.meta?.image || "").split("/").pop();
	const imageFile = files.find((file) => file.name.split("/").pop() === imageName) || files.find((file) => file !== jsonFile);
	if (!imageFile) throw new Error(`sheet image ${imageName} not found`);
	const image = await loadFileImage(imageFile);
	const frames = Array.isArray(json.frames) ? json.frames.map((frame) => [frame.filename, frame]) : Object.entries(json.frames);
	const glyphs = frames.map(([name, data]) => {
		if (data.rotated) throw new Error(`frame ${name} is rotated, pack the sheet without rotation`);
		const { x, y, w, h } = data.frame;
		const metrics = data.trimmed ? { xoffset: data.spriteSourceSize.x, yoffset: data.spriteSourceSize.y, xadvance: data.sourceSize.w } : {};
		return createGlyph(getCharFromName(getBaseName(name) || name), image, { x, y, w, h }, metrics, imageFile.name);
	});
	return { name: getBaseName(jsonFile.name), glyphs };
}

// one image per glyph, named like the game's raw folder: 0.png, 1.png, dot.png…
export async function readImageGlyphs(files) {
	// sorted like the game's packer, because the first glyph sets the font size
	const images = files
		.filter((file) => file.type.startsWith("image/"))
		.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
	return Promise.all(images.map(async (file) => {
		const image = await loadFileImage(file);
		return createGlyph(getCharFromName(getBaseName(file.name)), image, { x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight }, {}, file.name);
	}));
}

// BMFont .fnt (text or XML) with its pages; offsets and advance stay per glyph
export async function readFntGlyphs(files) {
	const fntFile = files.find((file) => /\.(fnt|xml)$/i.test(file.name));
	if (!fntFile) throw new Error("pick the .fnt file together with its .png pages");
	const text = await fntFile.text();
	const format = autoDetectFormat(text);
	if (!format) throw new Error("unknown .fnt format");
	const data = format.parse(text);
	const pages = {};
	for (const page of data.page) {
		const file = files.find((item) => item.name.split("/").pop() === page.file.split("/").pop());
		if (!file) throw new Error(`page image ${page.file} not found`);
		pages[page.id] = { image: await loadFileImage(file), file: file.name };
	}
	const glyphs = data.char.map((c) => createGlyph(String.fromCodePoint(c.id), pages[c.page].image, { x: c.x, y: c.y, w: c.width, h: c.height }, c, pages[c.page].file));
	return { name: data.info[0]?.face || getBaseName(fntFile.name), glyphs, size: data.info[0]?.size, lineHeight: data.common[0]?.lineHeight };
}

// glyphs without a character are left out; of a repeated character only the first glyph is used
const getUsableGlyphs = (glyphs) => glyphs.filter((glyph, i) => glyph.char && glyphs.findIndex((other) => other.char === glyph.char) === i);

// built the way the game builds it: one page per glyph, size and line height from the first glyph
export const installBitmapFont = (name, font) => {
	const glyphs = getUsableGlyphs(font.glyphs);
	if (glyphs.length === 0) throw new Error(`font ${name} has no glyphs with a character`);
	const data = new BitmapFontData();
	glyphs.forEach((glyph, i) => {
		data.page.push({ id: i, file: "" });
		data.char.push({ id: glyph.char.codePointAt(0), page: i, x: 0, y: 0, width: glyph.w, height: glyph.h, xoffset: glyph.xoffset, yoffset: glyph.yoffset, xadvance: glyph.xadvance });
	});
	data.common.push({ lineHeight: font.lineHeight || glyphs[0].h });
	data.info.push({ face: name, size: font.size || glyphs[0].h });
	BitmapFont.available[name]?.destroy();
	BitmapFont.available[name] = new BitmapFont(data, glyphs.map((glyph) => glyph.texture), false);
};

export const removeBitmapFont = (name) => {
	BitmapFont.available[name]?.destroy();
	delete BitmapFont.available[name];
};

// the sheet the game loads: one frame per glyph, the frame named by its character
export const createSheet = (name, glyphs) => {
	const usable = getUsableGlyphs(glyphs);
	const padding = 3;
	const maxRowWidth = 2048;
	const cellHeight = Math.max(1, ...usable.map((glyph) => glyph.yoffset + glyph.h));
	const frames = {};
	const cells = [];
	let x = padding;
	let y = padding;
	let width = padding;
	for (const glyph of usable) {
		// offsets are drawn into the frame, so the game's layout (advance = frame width) gives the same result
		const w = Math.max(1, glyph.xadvance, glyph.xoffset + glyph.w);
		if (x + w + padding > maxRowWidth && x > padding) {
			x = padding;
			y += cellHeight + padding;
		}
		frames[glyph.char] = { frame: { x, y, w, h: cellHeight }, rotated: false, trimmed: false, spriteSourceSize: { x: 0, y: 0, w, h: cellHeight }, sourceSize: { w, h: cellHeight } };
		cells.push({ glyph, x, y });
		x += w + padding;
		width = Math.max(width, x);
	}
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = y + cellHeight + padding;
	const ctx = canvas.getContext("2d");
	for (const { glyph, x: cellX, y: cellY } of cells) {
		if (glyph.w > 0 && glyph.h > 0) ctx.drawImage(glyph.image, glyph.x, glyph.y, glyph.w, glyph.h, cellX + glyph.xoffset, cellY + glyph.yoffset, glyph.w, glyph.h);
	}
	const json = { frames, meta: { app: "pixi-spine-viewer", image: `${name}.png`, format: "RGBA8888", size: { w: canvas.width, h: canvas.height }, scale: 1 } };
	return { json, canvas };
};

export async function exportSheet(name, glyphs) {
	const { json, canvas } = createSheet(name, glyphs);
	downloadFile(`${name}.json`, new Blob([JSON.stringify(json, null, 2)], { type: "application/json" }));
	downloadFile(`${name}.png`, await new Promise((resolve) => canvas.toBlob(resolve, "image/png")));
}

let defaultFont = null;

// the "numbers" font of base-slot (public/assets/fonts/bitmap/numbers)
export const loadDefaultBitmapFont = () => {
	defaultFont ||= (async () => {
		const base = `${import.meta.env.BASE_URL}presets/bitmap/`;
		const [json, image] = await Promise.all([fetch(`${base}numbers_1080p.json`).then((r) => r.json()), loadImage(`${base}numbers_1080p.png`)]);
		const glyphs = Object.entries(json.frames).map(([name, data]) => createGlyph(getCharFromName(name), image, data.frame, {}, `${PRESET_PREFIX}bitmap/numbers_1080p.png`));
		return { name: "numbers", glyphs };
	})().catch((err) => {
		defaultFont = null;
		throw err;
	});
	return defaultFont;
};

// a font in a saved scene: every glyph points to its image file and rectangle, so edited characters are kept
export const serializeFont = (name, font) => ({
	name,
	size: font.size,
	lineHeight: font.lineHeight,
	glyphs: font.glyphs.map(({ char, file, x, y, w, h, xoffset, yoffset, xadvance }) => ({ char, file, x, y, w, h, xoffset, yoffset, xadvance }))
});

// the user files a saved font needs (built-in images are not counted)
export const getFontFiles = (data) => [...new Set(data.glyphs.map((glyph) => glyph.file))].filter((path) => path && !path.startsWith(PRESET_PREFIX));

// builds a saved font again; getFile gives the file for a path, built-in images come from the presets
export async function readSavedFont(data, getFile) {
	const images = {};
	for (const path of new Set(data.glyphs.map((glyph) => glyph.file))) {
		if (path.startsWith(PRESET_PREFIX)) {
			images[path] = await loadImage(`${import.meta.env.BASE_URL}presets/${path.slice(PRESET_PREFIX.length)}`);
		} else {
			const file = getFile(path);
			if (!file) throw new Error(`file ${path} not found`);
			images[path] = await loadFileImage(file);
		}
	}
	return {
		size: data.size,
		lineHeight: data.lineHeight,
		glyphs: data.glyphs.map((glyph) => createGlyph(glyph.char, images[glyph.file], glyph, glyph, glyph.file))
	};
}
