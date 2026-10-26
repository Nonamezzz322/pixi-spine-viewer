import React, { useState, useRef, useEffect } from "react";
import { Application, BitmapFont, BitmapText, Color, Container, Graphics, Matrix, Point, Sprite, Text, Texture, filters } from "pixi.js";
import { Emitter, upgradeConfig } from "@pixi/particle-emitter";
import { createSkeletonData, createSpine, readSpineFiles } from "./spine";
import { Field, JsonBox, NumberInput } from "./fields";
import { COIN_FRAMES, EMITTER_PRESETS, createPresetConfig, loadCoinFrames } from "./presets";
import { exportSheet, getFontFiles, installBitmapFont, loadDefaultBitmapFont, readFntGlyphs, readImageGlyphs, readSavedFont, readSheetGlyphs, removeBitmapFont, serializeFont } from "./bitmapFonts";
import { SCENE_KEY, createSceneZip, downloadFile, findAssetFile, getElementFiles, readSceneZip, serializeElement } from "./scene";
import { canKeepFileAccess, clearSavedFiles, getImportedZip, getPickedSource, pickFilesKeepingAccess, readSavedFile, saveImportedZip, saveSource } from "./fileSources";
import { DEFAULT_MASK_POINTS, findPolygonHandle, getEdgeMiddle, isInsidePolygon } from "./polygon";
import TextStyleEditor from "./TextStyleEditor";
import BitmapFontEditor from "./BitmapFontEditor";
import { textFontsReady } from "./fonts";
import { createBitmapCountup, easeCountup, formatBitmapValue, toNumberText } from "./countup";
import { getElementConfig } from "./gameConfig";

const TYPE_LABELS = { static: "Image", spine: "Spine", bitmap: "Bitmap", text: "Text", emitter: "Emitter", fader: "Fader", mask: "Mask" };
// screen pixels around a mask point or edge middle that grab it
const MASK_HANDLE_RADIUS = 9;
const DEFAULT_PARTICLE = "particle";
// coin rain presets start below the scene centre, the coins fly up from there
const PRESET_EMITTER_Y = 500;
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 10;
const UI_KEY = "pixi-spine-viewer.constructor-ui";

// iPhone 16 Pro screen in points: 402 x 874, corners about 55 pt, Dynamic Island 126 x 37 pt, 11 pt from the edge
const IPHONE = { width: 402, height: 874, radius: 55, islandWidth: 126, islandHeight: 37, islandOffset: 11 };
// design sizes of base-slot games (4 Clovers Express resizer config); on a phone the stage fits them like the game does
const DESIGN_SIZES = { landscape: { x: 1920, y: 1080 }, portrait: { x: 1080, y: 1820 } };
const PHONE_MARGIN = 48;
const PHONE_BEZEL = 10;

// the phone screen fitted into the scene area, in pixels; the margin keeps room for the scene buttons
const getPhoneFrame = (viewport, area, margin) => {
	const portrait = viewport === "portrait";
	const screenWidth = portrait ? IPHONE.width : IPHONE.height;
	const screenHeight = portrait ? IPHONE.height : IPHONE.width;
	const k = Math.max(0.05, Math.min((area.width - margin * 2) / screenWidth, (area.height - margin * 2) / screenHeight));
	const width = screenWidth * k;
	const height = screenHeight * k;
	const left = (area.width - width) / 2;
	const top = (area.height - height) / 2;
	const islandLong = IPHONE.islandWidth * k;
	const islandShort = IPHONE.islandHeight * k;
	const islandOffset = IPHONE.islandOffset * k;
	return {
		screenWidth,
		screenHeight,
		left,
		top,
		width,
		height,
		radius: IPHONE.radius * k,
		island: portrait
			? { left: left + (width - islandLong) / 2, top: top + islandOffset, width: islandLong, height: islandShort }
			: { left: left + islandOffset, top: top + (height - islandLong) / 2, width: islandShort, height: islandLong }
	};
};

const ICON_SHAPES = {
	desktop: <><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M9 20h6M12 16v4" /></>,
	landscape: <><rect x="2" y="7" width="20" height="10" rx="2.5" /><path d="M5 10.5v3" /></>,
	portrait: <><rect x="7" y="2" width="10" height="20" rx="2.5" /><path d="M10.5 5h3" /></>,
	leftPanel: <><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M9 4v16" /></>,
	rightPanel: <><rect x="3" y="4" width="18" height="16" rx="1.5" /><path d="M15 4v16" /></>
};

const Icon = ({ name }) => (
	<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
		{ICON_SHAPES[name]}
	</svg>
);

const VIEWPORTS = [["desktop", "Desktop"], ["landscape", "iPhone 16 Pro landscape"], ["portrait", "iPhone 16 Pro portrait"]];

// soft white dot, registered by name so emitter configs stay short and readable
Texture.addToCache((() => {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = 32;
	const ctx = canvas.getContext("2d");
	const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
	gradient.addColorStop(0, "rgba(255,255,255,1)");
	gradient.addColorStop(1, "rgba(255,255,255,0)");
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, 32, 32);
	return Texture.from(canvas);
})(), DEFAULT_PARTICLE);

const list = (start, end) => ({ list: [{ value: start, time: 0 }, { value: end, time: 1 }] });

// behaviors the form edits as a start -> end pair; `conflicts` are removed when one is turned on
const LIST_BEHAVIORS = [
	{ type: "alpha", key: "alpha", label: "Alpha", step: 0.05, conflicts: ["alphaStatic"], create: () => ({ alpha: list(1, 0) }) },
	{ type: "scale", key: "scale", label: "Scale", step: 0.05, conflicts: ["scaleStatic"], create: () => ({ scale: list(1, 0.3), minMult: 1 }) },
	{ type: "color", key: "color", label: "Color", conflicts: ["colorStatic"], create: () => ({ color: list("#ffffff", "#ffffff") }) },
	{ type: "moveSpeed", key: "speed", label: "Speed", step: 10, conflicts: ["moveSpeedStatic", "moveAcceleration", "movePath"], create: () => ({ speed: list(200, 50), minMult: 1 }) }
];
const ACCELERATION = { type: "moveAcceleration", conflicts: ["moveSpeed", "moveSpeedStatic", "movePath"], create: () => ({ accel: { x: 0, y: 500 }, minStart: 300, maxStart: 300, rotate: true, maxSpeed: 0 }) };
const DIRECTION = { type: "rotationStatic", conflicts: ["rotation", "noRotation"], create: () => ({ min: 0, max: 360 }) };
const SPAWN_TYPES = ["spawnPoint", "spawnShape", "spawnBurst"];
const SHAPES = {
	point: () => ({ type: "spawnPoint", config: {} }),
	torus: () => ({ type: "spawnShape", config: { type: "torus", data: { x: 0, y: 0, radius: 100, innerRadius: 0, affectRotation: false } } }),
	rect: () => ({ type: "spawnShape", config: { type: "rect", data: { x: -100, y: -50, w: 200, h: 100 } } }),
	burst: () => ({ type: "spawnBurst", config: { start: 0, spacing: 30, distance: 0 } })
};
const TEXTURE_TYPES = ["textureSingle", "textureRandom", "textureOrdered", "animatedSingle", "animatedRandom"];

const createEmitterConfig = () => ({
	lifetime: { min: 0.5, max: 1.5 },
	frequency: 0.02,
	spawnChance: 1,
	particlesPerWave: 1,
	emitterLifetime: -1,
	maxParticles: 500,
	pos: { x: 0, y: 0 },
	addAtBack: false,
	behaviors: [
		{ type: "alpha", config: { alpha: list(1, 0) } },
		{ type: "scale", config: { scale: list(1, 0.3), minMult: 1 } },
		{ type: "color", config: { color: list("#ffdd55", "#ff4400") } },
		{ type: "moveSpeed", config: { speed: list(200, 50), minMult: 1 } },
		{ type: "rotationStatic", config: DIRECTION.create() },
		SHAPES.point(),
		{ type: "textureSingle", config: { texture: DEFAULT_PARTICLE } }
	]
});

// particle-emitter keeps only the first node of a list whose values are all the same, then crashes on every update,
// so the emitter gets a copy with one more node in such lists
const fixFlatLists = (config) => {
	const copy = structuredClone(config);
	for (const behavior of copy.behaviors) {
		for (const value of Object.values(behavior.config || {})) {
			const nodes = value?.list;
			if (Array.isArray(nodes) && nodes.length > 0 && nodes.length <= 2 && nodes.every((node) => node.value === nodes[0].value)) {
				value.list = [0, 0.5, 1].map((time) => ({ value: nodes[0].value, time }));
			}
		}
	}
	return copy;
};

const slotMatrix = new Matrix();
const FLIP_Y = new Matrix(1, 0, 0, -1, 0, 0);

// the box an emitter is grabbed by: particles fly everywhere, so they are not used for picking
const createEmitterHandle = () => {
	const handle = new Graphics();
	handle.lineStyle(2, 0xffffff, 0.9);
	handle.beginFill(0x00aaff, 0.35);
	handle.drawRoundedRect(-18, -18, 36, 36, 6);
	handle.endFill();
	for (let i = 0; i < 8; i++) {
		const angle = (i / 8) * Math.PI * 2;
		handle.moveTo(Math.cos(angle) * 5, Math.sin(angle) * 5).lineTo(Math.cos(angle) * 11, Math.sin(angle) * 11);
	}
	return handle;
};

// base-slot's fader: a black full-screen sprite (pixelBlack, alpha 0.9) in a root whose alpha is tweened
const createFaderCurtain = () => {
	const container = new Container();
	const curtain = new Sprite(Texture.WHITE);
	curtain.tint = 0x000000;
	container.addChild(curtain);
	return container;
};

// gsap's default ease, which the game's fader tween uses
const easeFade = (progress) => 1 - (1 - progress) ** 2;

const findBehavior = (config, types) => config.behaviors.find((b) => types.includes(b.type));
const removeBehaviors = (config, types) => {
	config.behaviors = config.behaviors.filter((b) => !types.includes(b.type));
};
const toggleBehavior = (config, def, on) => {
	if (on) {
		removeBehaviors(config, def.conflicts);
		config.behaviors.push({ type: def.type, config: def.create() });
	} else {
		removeBehaviors(config, [def.type]);
	}
};
const getShapeName = (b) => (!b || b.type === "spawnPoint" ? "point" : b.type === "spawnBurst" ? "burst" : b.config.type);
const getTextureNames = (config) => {
	const b = findBehavior(config, TEXTURE_TYPES);
	if (b?.type === "textureSingle") return [b.config.texture];
	if (b?.type === "textureRandom" || b?.type === "textureOrdered") return b.config.textures;
	return null;
};
const toColor = (value) => (String(value).startsWith("#") ? value : "#" + value);
const getBaseName = (path) => path.split("/").pop().replace(/\.[^.]+$/, "");
const isImage = (file) => file.type.startsWith("image/");
// bitmap-value's scaleText: shrinks the bitmap to the width budget, never grows it;
// minFitWidthPx makes short texts count as at least that wide, so "5" and "1.25k" get the same size
const fitBitmap = (obj, el, scale) => {
	const fitWidth = Math.max(obj.textWidth, el.minFitWidthPx || 0);
	const fitScale = el.scaleToWidth > 0 && fitWidth > el.scaleToWidth ? el.scaleToWidth / fitWidth : 1;
	obj.scale.set(scale * fitScale);
};

export default function Constructor({ styles, active }) {
	const [elements, setElements] = useState([]);
	const [selectedId, setSelectedId] = useState(null);
	const [bitmapFonts, setBitmapFonts] = useState({});
	const [zoom, setZoom] = useState(1);
	// viewport and panels are a per-browser preference
	const [ui, setUi] = useState(() => {
		const defaults = { viewport: "desktop", leftPanel: true, rightPanel: true };
		try {
			return { ...defaults, ...JSON.parse(localStorage.getItem(UI_KEY) || "{}") };
		} catch {
			return defaults;
		}
	});
	const [area, setArea] = useState({ width: 0, height: 0 });
	const [errorMsg, setErrorMsg] = useState("");
	const [missingFiles, setMissingFiles] = useState([]);
	const [filesToAllow, setFilesToAllow] = useState([]);

	const pixiContainerRef = useRef(null);
	const appRef = useRef(null);
	const rootRef = useRef(null);
	const outlineRef = useRef(null);
	const objectsRef = useRef({});
	const emittersRef = useRef({});
	const emitterPartsRef = useRef({});
	const slotHoldersRef = useRef({});
	const incrementsRef = useRef({});
	const fadesRef = useRef({});
	const faderLevelsRef = useRef({});
	const faderTargetsRef = useRef({});
	const maskGraphicsRef = useRef({});
	// every picked user file by its path: a scene export packs them, a restored scene looks its files up here
	const assetsRef = useRef(new Map());
	const particleFilesRef = useRef({});
	const missingFontsRef = useRef({});
	const bitmapFontsRef = useRef({});
	// nothing is autosaved until the saved scene is back, or a half-built scene would replace it
	const sceneLoadingRef = useRef(true);
	const restoreStartedRef = useRef(false);
	const spineFilesRef = useRef({});
	const elementsRef = useRef([]);
	const selectedIdRef = useRef(null);
	const nextIdRef = useRef(1);
	const zoomRef = useRef(1);
	const viewportRef = useRef(ui.viewport);
	const dropZoneRef = useRef(null);
	const panRef = useRef({ x: 0, y: 0 });
	const dragRef = useRef(null);
	const fileInputRef = useRef(null);
	const onFilesRef = useRef(null);

	const selected = elements.find((el) => el.id === selectedId);
	bitmapFontsRef.current = bitmapFonts;

	viewportRef.current = ui.viewport;

	// like the game's { landscape, portrait } configs: the portrait view has its own x, y and scale once one is changed there;
	// landscape and desktop use the element's main ones
	const getPlace = (el) => (viewportRef.current === "portrait" && el.portrait ? el.portrait : el);

	const placeRoot = () => {
		const app = appRef.current;
		// on a phone the stage fits the game's design size, like the game's resizer; the zoom works on top of that
		const design = DESIGN_SIZES[viewportRef.current];
		const fit = design ? Math.min(app.screen.width / design.x, app.screen.height / design.y) : 1;
		rootRef.current.position.set(app.screen.width / 2 + panRef.current.x, app.screen.height / 2 + panRef.current.y);
		rootRef.current.scale.set(fit * zoomRef.current);
	};

	const changeUi = (changes) => {
		setUi((prev) => {
			const next = { ...prev, ...changes };
			try {
				localStorage.setItem(UI_KEY, JSON.stringify(next));
			} catch {
				// only a convenience, the scene works without it
			}
			return next;
		});
	};

	// an emitter is picked and outlined by its handle, everything else by its own bounds
	const getPickTarget = (id) => emitterPartsRef.current[id]?.handle || objectsRef.current[id];

	const drawOutline = () => {
		const g = outlineRef.current;
		g.clear();
		const obj = objectsRef.current[selectedIdRef.current];
		const selectedEl = elementsRef.current.find((item) => item.id === selectedIdRef.current);
		// a mask shows its polygon and handles, even while its clipping is off
		if (obj && selectedEl?.type === "mask") {
			drawMaskEditor(g, selectedEl);
			return;
		}
		if (!obj || !obj.visible || selectedEl?.type === "fader") return;
		g.lineStyle(1, 0x00aaff, 1);
		const bounds = getPickTarget(selectedIdRef.current).getBounds();
		if (bounds.width > 0 && bounds.height > 0) g.drawRect(bounds.x, bounds.y, bounds.width, bounds.height);
		// emitters have no size of their own, so the origin is always marked
		const p = obj.getGlobalPosition();
		g.moveTo(p.x - 8, p.y).lineTo(p.x + 8, p.y).moveTo(p.x, p.y - 8).lineTo(p.x, p.y + 8);
		// the scaleToWidth budget of a bitmap, drawn in the bitmap's own unscaled space
		const el = elementsRef.current.find((item) => item.id === selectedIdRef.current);
		if (el?.type === "bitmap" && el.scaleToWidth > 0) {
			const halfWidth = el.scaleToWidth / 2;
			const halfHeight = obj.textHeight / 2;
			const corners = [[-halfWidth, -halfHeight], [halfWidth, -halfHeight], [halfWidth, halfHeight], [-halfWidth, halfHeight]];
			g.lineStyle(1, 0xffaa00, 1).drawPolygon(corners.map(([x, y]) => obj.toGlobal(new Point(x, y))));
		}
	};

	useEffect(() => {
		if (appRef.current || !pixiContainerRef.current) return;
		const app = new Application({
			width: Math.max(1, pixiContainerRef.current.clientWidth),
			height: Math.max(1, pixiContainerRef.current.clientHeight),
			backgroundColor: 0x888888,
			resolution: window.devicePixelRatio || 1,
			autoDensity: true
		});
		pixiContainerRef.current.appendChild(app.view);
		const root = new Container();
		const outline = new Graphics();
		app.stage.addChild(root, outline);
		appRef.current = app;
		rootRef.current = root;
		outlineRef.current = outline;
		app.ticker.add(() => {
			const dt = app.ticker.deltaMS / 1000;
			for (const [id, emitter] of Object.entries(emittersRef.current)) {
				// an error here would stop the pixi ticker and freeze the whole scene
				try {
					emitter.update(dt);
				} catch (err) {
					delete emittersRef.current[id];
					try {
						emitter.destroy();
					} catch {
						// already broken, nothing more to clean
					}
					setErrorMsg("Emitter stopped: " + err.message);
				}
			}
			for (const [id, fade] of Object.entries(fadesRef.current)) {
				fade.elapsed += dt;
				const progress = fade.duration > 0 ? Math.min(1, fade.elapsed / fade.duration) : 1;
				faderLevelsRef.current[id] = fade.from + (fade.to - fade.from) * easeFade(progress);
				const el = elementsRef.current.find((item) => item.id === Number(id));
				if (el) applyFader(el);
				if (!el || progress === 1) delete fadesRef.current[id];
			}
			// a scene fader covers the visible canvas at any zoom and pan
			for (const el of elementsRef.current) {
				if (el.type !== "fader" || el.target) continue;
				const obj = objectsRef.current[el.id];
				const topLeft = obj.toLocal(new Point(0, 0));
				const bottomRight = obj.toLocal(new Point(app.screen.width, app.screen.height));
				obj.children[0].position.copyFrom(topLeft);
				obj.children[0].width = bottomRight.x - topLeft.x;
				obj.children[0].height = bottomRight.y - topLeft.y;
			}
			// bitmap increments show in-between values; the element keeps the final text
			for (const [id, run] of Object.entries(incrementsRef.current)) {
				const obj = objectsRef.current[id];
				run.elapsed += dt;
				const progress = run.duration > 0 ? Math.min(1, run.elapsed / run.duration) : 1;
				if (obj) {
					obj.text = progress < 1 ? run.format(run.target * easeCountup(progress)) : run.finalText;
					// the game fits the bitmap again on every value it sets
					const el = elementsRef.current.find((item) => item.id === Number(id));
					if (el) fitBitmap(obj, el, getPlace(el).scale);
				}
				if (!obj || progress === 1) delete incrementsRef.current[id];
			}
			// the handle keeps one size on screen at any zoom and element scale
			for (const { handle } of Object.values(emitterPartsRef.current)) {
				const wt = handle.parent.worldTransform;
				handle.scale.set(1 / (Math.hypot(wt.a, wt.b) || 1));
			}
			drawOutline();
		});
	}, []);

	useEffect(() => {
		const ticker = appRef.current?.ticker;
		if (!ticker) return;
		if (active) ticker.start();
		else ticker.stop();
	}, [active]);

	useEffect(() => {
		const observer = new ResizeObserver(([entry]) => {
			const { width, height } = entry.contentRect;
			// the hidden tab has no size
			if (!appRef.current || width === 0 || height === 0) return;
			appRef.current.renderer.resize(width, height);
			placeRoot();
		});
		observer.observe(pixiContainerRef.current);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		const observer = new ResizeObserver(([entry]) => setArea({ width: entry.contentRect.width, height: entry.contentRect.height }));
		observer.observe(dropZoneRef.current);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (!appRef.current) return;
		placeRoot();
		for (const el of elementsRef.current) syncObject(el, el);
	}, [ui.viewport]);

	useEffect(() => {
		// texts made before the font was ready were drawn with a fallback font
		textFontsReady
			.then(() => {
				for (const el of elementsRef.current) if (el.type === "text") objectsRef.current[el.id].updateText(false);
			})
			.catch((err) => setErrorMsg("Text fonts failed to load: " + err.message));
		loadDefaultBitmapFont()
			.then(({ name, glyphs }) => setFont(name, { glyphs }))
			.catch((err) => setErrorMsg("Default bitmap font failed to load: " + err.message))
			.then(() => restoreSavedScene());
	}, []);

	useEffect(() => {
		const timer = setTimeout(() => saveScene(), 300);
		return () => clearTimeout(timer);
	}, [elements, bitmapFonts]);

	const changeElements = (next) => {
		elementsRef.current = next;
		setElements(next);
	};

	const selectElement = (id) => {
		selectedIdRef.current = id;
		setSelectedId(id);
	};

	const syncObject = (el, prev) => {
		const obj = objectsRef.current[el.id];
		const place = getPlace(el);
		obj.position.set(place.x, place.y);
		obj.scale.set(place.scale);
		obj.angle = el.rotation;
		obj.alpha = el.alpha;
		obj.visible = el.visible;
		// a restored element without its files is an empty placeholder
		if (el.missing) return;
		if (el.type === "text") {
			obj.text = el.text;
			obj.style = el.style;
		} else if (el.type === "bitmap") {
			// a new value stops a running increment
			if (el.text !== prev?.text || el.isShort !== prev?.isShort || el.decimals !== prev?.decimals) delete incrementsRef.current[el.id];
			if (!incrementsRef.current[el.id]) obj.text = formatBitmapValue(el.text, el);
			obj.fontName = el.fontName;
			obj.fontSize = el.fontSize;
			obj.tint = el.tint;
			obj.align = el.align;
			obj.letterSpacing = el.letterSpacing;
			obj.maxWidth = el.maxWidth;
			fitBitmap(obj, el, place.scale);
		} else if (el.type === "fader") {
			applyFader(el);
		} else if (el.type === "mask") {
			applyMask(el);
		} else if (el.type === "spine") {
			obj.state.timeScale = el.speed;
			if (el.skin && el.skin !== prev?.skin) {
				obj.skeleton.setSkinByName(el.skin);
				obj.skeleton.setSlotsToSetupPose();
			}
			// every track plays at the same time; only a changed track restarts
			el.tracks.forEach((track, i) => {
				const before = prev?.tracks[i];
				if (!before || before.animation !== track.animation || before.loop !== track.loop) {
					if (track.animation) obj.state.setAnimation(i, track.animation, track.loop);
					else obj.state.setEmptyAnimation(i, 0);
				}
				if (obj.state.tracks[i]) obj.state.tracks[i].alpha = track.alpha;
			});
			for (let i = el.tracks.length; i < (prev?.tracks.length || 0); i++) obj.state.setEmptyAnimation(i, 0);
		}
	};

	const updateElement = (id, changes) => {
		const prev = elementsRef.current.find((el) => el.id === id);
		const next = { ...prev, ...toPlaceChanges(prev, changes) };
		syncObject(next, prev);
		changeElements(elementsRef.current.map((el) => (el.id === id ? next : el)));
	};

	// in the portrait view x, y and scale go to the element's portrait place; changes that set "portrait" themselves stay as they are
	const toPlaceChanges = (el, changes) => {
		if (viewportRef.current !== "portrait" || el.attach || "portrait" in changes || !["x", "y", "scale"].some((key) => key in changes)) return changes;
		const { x, y, scale } = getPlace(el);
		const { x: newX = x, y: newY = y, scale: newScale = scale, ...rest } = changes;
		return { ...rest, portrait: { x: newX, y: newY, scale: newScale } };
	};

	const addElement = (type, obj, props) => {
		const id = nextIdRef.current++;
		const count = elementsRef.current.filter((el) => el.type === type).length + 1;
		const el = { id, type, name: `${TYPE_LABELS[type]} ${count}`, x: 0, y: 0, scale: 1, rotation: 0, alpha: 1, visible: true, ...props };
		objectsRef.current[id] = obj;
		rootRef.current.addChild(obj);
		syncObject(el);
		changeElements([...elementsRef.current, el]);
		selectElement(id);
		return id;
	};

	// one holder per used slot; the element objects inside it follow the slot's bone
	const getSlotHolder = (spineId, slotName) => {
		const holders = (slotHoldersRef.current[spineId] ||= {});
		return (holders[slotName] ||= new Container());
	};

	// puts every element object into its parent, the scene or a spine slot, in layer order
	const placeObjects = () => {
		for (const el of elementsRef.current) {
			const parent = el.attach ? getSlotHolder(el.attach.spineId, el.attach.slot) : rootRef.current;
			parent.addChild(objectsRef.current[el.id]);
		}
	};

	// runs right after the spine's update(), where pixi-spine sets slot visibility and transforms (as the viewer's slot markers do)
	const updateSlotHolders = (spineId) => {
		const spine = objectsRef.current[spineId];
		for (const [slotName, holder] of Object.entries(slotHoldersRef.current[spineId] || {})) {
			const slot = spine.skeleton.findSlot(slotName);
			const users = elementsRef.current.filter((el) => el.visible && el.attach?.spineId === spineId && el.attach.slot === slotName);
			if (!slot || users.length === 0) continue;
			const container = spine.slotContainers[slot.data.index];
			// pixi-spine adds new attachment sprites on top, so keep the holder last
			if (container.children[container.children.length - 1] !== holder) container.addChild(holder);
			const showArt = container.visible && !users.some((el) => el.attach.mode === "replace");
			// pixi-spine hides empty slots, but what we put there should still show
			container.visible = true;
			if (!showArt) {
				for (const child of container.children) if (child !== holder) child.renderable = false;
			}
			// only region slots get the bone transform from pixi-spine; the flip turns y-up bone space into the scene's y-down
			container.transform.updateLocalTransform();
			slotMatrix.copyFrom(container.transform.localTransform).invert().append(slot.bone.matrix).append(FLIP_Y);
			holder.transform.setFromMatrix(slotMatrix);
		}
	};

	const setElementSlot = (id, attach) => {
		const el = elementsRef.current.find((item) => item.id === id);
		// the slot moves with its spine's own place, so an element in a slot has one place for every view
		const changes = { attach };
		if (attach && !el.attach) Object.assign(changes, { x: 0, y: 0, portrait: null });
		if (!attach && el.attach) {
			// leaving a slot keeps the element where it is on screen
			const p = rootRef.current.toLocal(objectsRef.current[id].getGlobalPosition());
			Object.assign(changes, { x: Math.round(p.x), y: Math.round(p.y), portrait: null });
		}
		updateElement(id, changes);
		placeObjects();
	};

	// true when the element sits, maybe through other spines, in the given spine
	const isInSpine = (el, spineId) => {
		for (let item = el; item?.attach; item = elementsRef.current.find((other) => other.id === item.attach.spineId)) {
			if (item.attach.spineId === spineId) return true;
		}
		return false;
	};

	const restartSpine = (id) => {
		for (const entry of objectsRef.current[id].state.tracks) if (entry) entry.trackTime = 0;
	};

	const setZoomValue = (value) => {
		const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
		zoomRef.current = next;
		setZoom(next);
		placeRoot();
	};

	const resetView = () => {
		panRef.current = { x: 0, y: 0 };
		setZoomValue(1);
	};

	// registered once, so everything used here must read refs, not state
	useEffect(() => {
		const view = appRef.current.view;
		const onPointerDown = (e) => {
			if (e.button !== 0) return;
			const rect = view.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;
			// a selected mask is edited here: a point is dragged, a dot between points adds one, a drag inside moves the mask
			const selectedEl = elementsRef.current.find((el) => el.id === selectedIdRef.current);
			let hit = null;
			if (selectedEl?.type === "mask") {
				const handle = findPolygonHandle(getMaskScreenPoints(selectedEl), x, y, MASK_HANDLE_RADIUS);
				if (handle) {
					let index = handle.index;
					if (handle.kind === "edge") {
						const middle = getEdgeMiddle(selectedEl.points, index);
						index += 1;
						updateElement(selectedEl.id, { points: selectedEl.points.toSpliced(index, 0, { x: Math.round(middle.x), y: Math.round(middle.y) }) });
					}
					dragRef.current = { id: selectedEl.id, maskPoint: index, startX: e.clientX, startY: e.clientY };
					return;
				}
				if (isInsidePolygon(getMaskScreenPoints(selectedEl), x, y)) hit = selectedEl;
			}
			// faders and masks cover a lot, so they are picked in the layers list only
			hit ||= [...elementsRef.current].reverse().find((el) => el.type !== "fader" && el.type !== "mask" && objectsRef.current[el.id].visible && getPickTarget(el.id).getBounds().contains(x, y));
			if (hit) {
				selectElement(hit.id);
				// moved in its parent's space: a rotated, scaled bone when the element sits in a slot
				const start = objectsRef.current[hit.id].parent.toLocal(new Point(x, y));
				dragRef.current = { id: hit.id, start, startX: e.clientX, startY: e.clientY, origX: getPlace(hit).x, origY: getPlace(hit).y };
			} else {
				dragRef.current = { pan: true, startX: e.clientX, startY: e.clientY, origX: panRef.current.x, origY: panRef.current.y };
			}
		};
		const onPointerMove = (e) => {
			const drag = dragRef.current;
			if (!drag) return;
			const dx = e.clientX - drag.startX;
			const dy = e.clientY - drag.startY;
			if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
			if (drag.pan) {
				panRef.current = { x: drag.origX + dx, y: drag.origY + dy };
				placeRoot();
			} else if (drag.maskPoint !== undefined) {
				const el = elementsRef.current.find((item) => item.id === drag.id);
				const obj = objectsRef.current[drag.id];
				if (!el || !obj) return;
				const rect = view.getBoundingClientRect();
				const local = obj.toLocal(new Point(e.clientX - rect.left, e.clientY - rect.top));
				updateElement(drag.id, { points: el.points.map((point, i) => (i === drag.maskPoint ? { x: Math.round(local.x), y: Math.round(local.y) } : point)) });
			} else {
				const obj = objectsRef.current[drag.id];
				if (!obj) return;
				const rect = view.getBoundingClientRect();
				const now = obj.parent.toLocal(new Point(e.clientX - rect.left, e.clientY - rect.top));
				updateElement(drag.id, { x: Math.round(drag.origX + now.x - drag.start.x), y: Math.round(drag.origY + now.y - drag.start.y) });
			}
		};
		const onPointerUp = () => {
			// a click on empty space clears the selection, a drag pans the view
			if (dragRef.current?.pan && !dragRef.current.moved) selectElement(null);
			dragRef.current = null;
		};
		const onWheel = (e) => {
			e.preventDefault();
			setZoomValue(zoomRef.current * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
		};
		// a double click on a point of the selected mask deletes it; a polygon keeps at least 3 points
		const onDoubleClick = (e) => {
			const el = elementsRef.current.find((item) => item.id === selectedIdRef.current);
			if (el?.type !== "mask" || el.points.length <= 3) return;
			const rect = view.getBoundingClientRect();
			const handle = findPolygonHandle(getMaskScreenPoints(el), e.clientX - rect.left, e.clientY - rect.top, MASK_HANDLE_RADIUS);
			if (handle?.kind === "point") updateElement(el.id, { points: el.points.filter((_, i) => i !== handle.index) });
		};
		view.addEventListener("pointerdown", onPointerDown);
		view.addEventListener("dblclick", onDoubleClick);
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		view.addEventListener("wheel", onWheel, { passive: false });
		return () => {
			view.removeEventListener("pointerdown", onPointerDown);
			view.removeEventListener("dblclick", onDoubleClick);
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
			view.removeEventListener("wheel", onWheel);
		};
	}, []);

	const pickFiles = async (accept, onFiles, folder = false) => {
		// with the File System Access API the same files can be read again after a reload
		if (canKeepFileAccess()) {
			try {
				const files = await pickFilesKeepingAccess(accept, folder);
				if (files.length > 0) onFiles(files);
			} catch (err) {
				if (err.name !== "AbortError") setErrorMsg("File pick error: " + err.message);
			}
			return;
		}
		const input = fileInputRef.current;
		input.accept = accept;
		input.webkitdirectory = folder;
		onFilesRef.current = onFiles;
		input.click();
	};

	const onFileInputChange = (e) => {
		// folder picks name files by their path, like the viewer does
		const files = Array.from(e.target.files).map((f) => (f.webkitRelativePath ? new File([f], f.webkitRelativePath, { type: f.type }) : f));
		e.target.value = "";
		if (files.length > 0) onFilesRef.current(files);
	};

	const addAssets = (files) => {
		for (const file of files) {
			assetsRef.current.set(file.name, file);
			const source = getPickedSource(file);
			// if this fails, the file is just asked for again after a reload
			if (source) saveSource(file.name, source).catch(() => {});
		}
	};

	const getAssetFile = (path) => findAssetFile(assetsRef.current, path);

	const addImages = (files) => {
		addAssets(files);
		for (const file of files.filter(isImage)) addImageElement(file);
	};

	const addImageElement = (file, props = {}) => {
		const url = URL.createObjectURL(file);
		const sprite = Sprite.from(url);
		sprite.anchor.set(0.5);
		return addElement("static", sprite, { name: getBaseName(file.name), ...props, imageUrl: url, file: file.name });
	};

	const setElementImage = (id, files) => {
		const file = files.find(isImage);
		if (!file) return;
		const el = elementsRef.current.find((item) => item.id === id);
		const sprite = objectsRef.current[id];
		const oldTexture = sprite.texture;
		const url = URL.createObjectURL(file);
		sprite.texture = Texture.from(url);
		oldTexture.destroy(true);
		URL.revokeObjectURL(el.imageUrl);
		addAssets([file]);
		updateElement(id, { imageUrl: url, file: file.name });
	};

	const addSpine = async (files) => {
		setErrorMsg("");
		addAssets(files);
		try {
			await addSpineElement(files);
		} catch (err) {
			console.error("Error loading spine:", err);
			setErrorMsg("Error loading spine: " + err.message);
		}
	};

	// props come from a saved scene; a track with an animation this spine does not have is left empty
	const addSpineElement = async (files, props = {}) => {
		let fileURLs = {};
		let pageTextures = [];
		try {
			const spineFiles = await readSpineFiles(files);
			fileURLs = spineFiles.fileURLs;
			const loaded = await createSkeletonData(spineFiles.jsonData, spineFiles.atlasText, fileURLs);
			pageTextures = loaded.pageTextures;
			const spine = createSpine(loaded.skeletonData);
			const animations = loaded.skeletonData.animations.map((anim) => anim.name);
			const skins = loaded.skeletonData.skins.map((skin) => skin.name);
			const tracks = (props.tracks || [{ animation: animations[0] || "", loop: true, alpha: 1 }])
				.map((track) => (!track.animation || animations.includes(track.animation) ? track : { ...track, animation: "" }));
			const id = addElement("spine", spine, {
				name: getBaseName(spineFiles.jsonFileName),
				speed: 1,
				...props,
				animations,
				skins,
				slots: loaded.skeletonData.slots.map((slot) => slot.name),
				tracks,
				skin: skins.includes(props.skin) ? props.skin : skins[0] || "",
				files: files.map((file) => file.name)
			});
			spineFilesRef.current[id] = { pageTextures, fileURLs };
			// pixi-spine updates slots inside update() during render, so the slot holders follow right after it
			const origUpdate = spine.update.bind(spine);
			spine.update = (dt) => {
				origUpdate(dt);
				updateSlotHolders(id);
			};
			return id;
		} catch (err) {
			for (const texture of pageTextures) texture.destroy();
			for (const url of Object.values(fileURLs)) URL.revokeObjectURL(url);
			throw err;
		}
	};

	const setFont = (name, font) => {
		try {
			installBitmapFont(name, font);
		} catch (err) {
			setErrorMsg(err.message);
			return false;
		}
		setBitmapFonts((prev) => ({ ...prev, [name]: font }));
		return true;
	};

	const getFreeFontName = (name) => {
		let freeName = name;
		for (let i = 2; bitmapFonts[freeName]; i++) freeName = `${name} ${i}`;
		return freeName;
	};

	const importFont = async (elementId, readFont, files) => {
		addAssets(files);
		try {
			const { name, ...font } = await readFont(files);
			const fontName = getFreeFontName(name);
			if (setFont(fontName, font)) updateElement(elementId, { fontName });
		} catch (err) {
			setErrorMsg("Font import error: " + err.message);
		}
	};

	// a folder like the game's raw/fonts/bitmap/numbers: the folder name becomes the font name
	const readGlyphFolder = async (files) => ({ name: files[0].name.split("/").slice(-2, -1)[0] || "glyphs", glyphs: await readImageGlyphs(files) });

	const addGlyphs = async (name, files) => {
		addAssets(files);
		try {
			const glyphs = await readImageGlyphs(files);
			setFont(name, { ...bitmapFonts[name], glyphs: [...bitmapFonts[name].glyphs, ...glyphs] });
		} catch (err) {
			setErrorMsg("Glyph import error: " + err.message);
		}
	};

	const renameFont = (oldName, newName) => {
		if (bitmapFonts[newName]) {
			setErrorMsg(`Font ${newName} already exists`);
			return;
		}
		if (!setFont(newName, bitmapFonts[oldName])) return;
		for (const el of elementsRef.current) if (el.type === "bitmap" && el.fontName === oldName) updateElement(el.id, { fontName: newName });
		removeBitmapFont(oldName);
		setBitmapFonts(({ [oldName]: _, ...rest }) => rest);
	};

	const deleteFont = (name) => {
		const users = elementsRef.current.filter((el) => el.type === "bitmap" && el.fontName === name).length;
		if (users > 0) {
			setErrorMsg(`Font ${name} is used by ${users} bitmap(s), switch them to another font first`);
			return;
		}
		removeBitmapFont(name);
		setBitmapFonts(({ [name]: _, ...rest }) => rest);
	};

	const addBitmap = (props = {}) => {
		// a saved font that could not be loaded falls back to the first loaded one
		const fontName = BitmapFont.available[props.fontName] ? props.fontName : Object.keys(BitmapFont.available)[0];
		if (!fontName) {
			setErrorMsg("Bitmap fonts are still loading");
			return null;
		}
		const text = new BitmapText("", { fontName, fontSize: 64 });
		text.anchor.set(0.5);
		return addElement("bitmap", text, {
			text: "12500",
			isShort: false,
			decimals: 0,
			scaleToWidth: 0,
			minFitWidthPx: 0,
			fontSize: 64,
			tint: "#ffffff",
			align: "center",
			letterSpacing: 0,
			maxWidth: 0,
			incrementTime: 3,
			...props,
			fontName
		});
	};

	// counts from 0 to the value with the ease of the game's countup; every step is shown like the final value
	const startIncrement = (el) => {
		const countup = createBitmapCountup(el.text, el);
		if (!countup) {
			setErrorMsg("Increment needs a value");
			return;
		}
		setErrorMsg("");
		incrementsRef.current[el.id] = { ...countup, finalText: formatBitmapValue(el.text, el), duration: el.incrementTime, elapsed: 0 };
	};

	// the game's BitmapText node config (bitmapTextStyle + tint) and the bitmap-value props
	const getBitmapJson = (el) => JSON.stringify({
		bitmapTextStyle: { fontName: el.fontName, fontSize: el.fontSize, align: el.align, letterSpacing: el.letterSpacing, ...(el.maxWidth ? { maxWidth: el.maxWidth } : {}) },
		tint: el.tint,
		short: el.isShort,
		...(el.scaleToWidth ? { scaleToWidth: el.scaleToWidth } : {}),
		...(el.minFitWidthPx ? { minFitWidthPx: el.minFitWidthPx } : {})
	}, null, 2);

	const applyBitmapJson = (el, text) => {
		try {
			const parsed = JSON.parse(text);
			const style = parsed.bitmapTextStyle || parsed;
			if (style.fontName && !bitmapFonts[style.fontName]) throw new Error(`font ${style.fontName} is not loaded, import it first`);
			const changes = { fontName: style.fontName, fontSize: style.fontSize, align: style.align, letterSpacing: style.letterSpacing, maxWidth: style.maxWidth };
			if (parsed.tint !== undefined) changes.tint = new Color(parsed.tint).toHex();
			if (parsed.short !== undefined) changes.isShort = !!parsed.short;
			if (parsed.scaleToWidth !== undefined) changes.scaleToWidth = Number(parsed.scaleToWidth) || 0;
			if (parsed.minFitWidthPx !== undefined) changes.minFitWidthPx = Number(parsed.minFitWidthPx) || 0;
			updateElement(el.id, Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)));
		} catch (err) {
			setErrorMsg("Bitmap JSON error: " + err.message);
		}
	};

	const addText = (props = {}) => {
		const text = new Text("");
		text.anchor.set(0.5);
		return addElement("text", text, { text: "Text", style: { fontFamily: "MyriadPro", fontSize: 64, fill: "#ffffff", align: "center" }, ...props });
	};

	// a broken config keeps the old emitter running and only shows the error
	const setEmitterConfig = (id, config) => {
		let emitter;
		try {
			emitter = new Emitter(emitterPartsRef.current[id].particles, fixFlatLists(config));
		} catch (err) {
			setErrorMsg("Emitter config error: " + err.message);
			return;
		}
		emittersRef.current[id]?.destroy();
		emittersRef.current[id] = emitter;
		emitter.emit = true;
		setErrorMsg("");
		updateElement(id, { config });
	};

	// the element is a container you drag by the handle; particles live in their own layer under it
	const addEmitter = (config = createEmitterConfig(), props = {}) => {
		const container = new Container();
		const particles = new Container();
		const handle = createEmitterHandle();
		container.addChild(particles, handle);
		const emitter = new Emitter(particles, fixFlatLists(config));
		emitter.emit = true;
		const id = addElement("emitter", container, { config, ...props });
		emittersRef.current[id] = emitter;
		emitterPartsRef.current[id] = { particles, handle };
		return id;
	};

	// level is how far the fader is shown (0..1), like the alpha of the game's fader root
	const applyFader = (el) => {
		const obj = objectsRef.current[el.id];
		const level = faderLevelsRef.current[el.id] ?? 0;
		const target = el.target ? objectsRef.current[el.target] : null;
		const current = faderTargetsRef.current[el.id];
		if (current && current.obj !== target) {
			current.obj.filters = (current.obj.filters || []).filter((filter) => filter !== current.filter);
			delete faderTargetsRef.current[el.id];
		}
		if (target) {
			if (!faderTargetsRef.current[el.id]) {
				const filter = new filters.ColorMatrixFilter();
				target.filters = [...(target.filters || []), filter];
				faderTargetsRef.current[el.id] = { obj: target, filter };
			}
			// the same as a black overlay of that alpha, but only on the element's own pixels
			const { filter } = faderTargetsRef.current[el.id];
			filter.brightness(1 - el.faderAlpha * level, false);
			filter.enabled = el.visible && level > 0;
			obj.visible = false;
		} else {
			obj.alpha = level;
			obj.children[0].alpha = el.faderAlpha;
			obj.visible = el.visible && level > 0;
		}
	};

	// show / hide like the game's FaderComponent: a new fade replaces the running one
	const fadeTo = (el, level) => {
		fadesRef.current[el.id] = { from: faderLevelsRef.current[el.id] ?? 0, to: level, elapsed: 0, duration: el.fadeDuration };
		updateElement(el.id, { shown: level > 0 });
	};

	const getMaskScreenPoints = (el) => el.points.map((point) => objectsRef.current[el.id].toGlobal(new Point(point.x, point.y)));

	const drawMaskEditor = (g, el) => {
		const points = getMaskScreenPoints(el);
		g.lineStyle(2, 0xff3dae, 1).drawPolygon(points);
		g.lineStyle(1, 0xffffff, 1);
		for (let i = 0; i < points.length; i++) {
			const middle = getEdgeMiddle(points, i);
			g.beginFill(0xff3dae, 0.8).drawCircle(middle.x, middle.y, 4).endFill();
		}
		g.lineStyle(1, 0xff3dae, 1);
		for (const point of points) g.beginFill(0xffffff).drawRect(point.x - 5, point.y - 5, 10, 10).endFill();
	};

	// every clipped element gets its own copy of the polygon: in pixi a mask belongs to one object;
	// the copies are children of the mask, so its position, scale and rotation move them all
	const applyMask = (el) => {
		const container = objectsRef.current[el.id];
		const graphicsByTarget = (maskGraphicsRef.current[el.id] ||= new Map());
		const wanted = new Set(el.visible ? el.targets.filter((id) => objectsRef.current[id]) : []);
		for (const [targetId, graphics] of graphicsByTarget) {
			if (wanted.has(targetId)) continue;
			const target = objectsRef.current[targetId];
			if (target?.mask === graphics) target.mask = null;
			graphics.destroy();
			graphicsByTarget.delete(targetId);
		}
		for (const targetId of wanted) {
			let graphics = graphicsByTarget.get(targetId);
			if (!graphics) {
				graphics = new Graphics();
				container.addChild(graphics);
				graphicsByTarget.set(targetId, graphics);
			}
			graphics.clear().beginFill(0xffffff).drawPolygon(el.points.flatMap((point) => [point.x, point.y])).endFill();
			objectsRef.current[targetId].mask = graphics;
		}
	};

	const addMask = (props = {}) => addElement("mask", new Container(), { points: DEFAULT_MASK_POINTS, targets: [], ...props });

	// a new fader fades in at once; a saved one comes back as it was
	const addFader = (props = {}) => {
		const isNew = props.shown === undefined;
		const id = addElement("fader", createFaderCurtain(), { faderAlpha: 0.9, fadeDuration: 0.3, target: null, shown: false, ...props });
		const el = elementsRef.current.find((item) => item.id === id);
		faderLevelsRef.current[id] = el.shown ? 1 : 0;
		applyFader(el);
		if (isNew) fadeTo(el, 1);
		return id;
	};

	const addPresetEmitter = async (preset) => {
		try {
			await loadCoinFrames();
		} catch (err) {
			setErrorMsg("Coin frames failed to load: " + err.message);
			return;
		}
		addEmitter(createPresetConfig(preset), { name: preset.name, y: PRESET_EMITTER_Y });
	};

	const registerParticleTexture = (name, file) => {
		Texture.removeFromCache(name);
		Texture.addToCache(Texture.from(URL.createObjectURL(file)), name);
	};

	const loadParticleTextures = (id, files) => {
		addAssets(files);
		const names = files.filter(isImage).map((file) => {
			const name = file.name.split("/").pop();
			registerParticleTexture(name, file);
			particleFilesRef.current[name] = file.name;
			return name;
		});
		if (names.length === 0) return;
		const config = structuredClone(elementsRef.current.find((el) => el.id === id).config);
		removeBehaviors(config, TEXTURE_TYPES);
		config.behaviors.push(names.length === 1 ? { type: "textureSingle", config: { texture: names[0] } } : { type: "textureRandom", config: { textures: names } });
		setEmitterConfig(id, config);
	};

	const applyJson = (text) => {
		let config;
		try {
			config = JSON.parse(text);
		} catch (err) {
			setErrorMsg("JSON error: " + err.message);
			return;
		}
		// configs from the old Pixi Particles Editor have no behaviors list
		if (!config.behaviors) config = upgradeConfig(config, getTextureNames(selected.config) || [DEFAULT_PARTICLE]);
		setEmitterConfig(selected.id, config);
	};

	const deleteElement = (id) => {
		const el = elementsRef.current.find((item) => item.id === id);
		// masks stop clipping a deleted element, and a deleted mask lets its elements go
		for (const other of elementsRef.current) {
			if (other.type === "mask" && other.targets.includes(id)) updateElement(other.id, { targets: other.targets.filter((targetId) => targetId !== id) });
		}
		if (el.type === "mask") {
			updateElement(id, { targets: [] });
			delete maskGraphicsRef.current[id];
		}
		// a fader on this element darkens the whole scene below it again
		for (const other of elementsRef.current) if (other.type === "fader" && other.target === id) updateElement(other.id, { target: null });
		if (el.type === "fader") {
			updateElement(id, { target: null });
			delete fadesRef.current[id];
			delete faderLevelsRef.current[id];
		}
		// elements in this spine's slots go back to the scene instead of being destroyed with it
		if (el.type === "spine") {
			for (const other of elementsRef.current) if (other.attach?.spineId === id) setElementSlot(other.id, null);
			delete slotHoldersRef.current[id];
		}
		emittersRef.current[id]?.destroy();
		delete emittersRef.current[id];
		delete emitterPartsRef.current[id];
		delete incrementsRef.current[id];
		objectsRef.current[id].destroy({ children: true, texture: el.type === "static", baseTexture: el.type === "static" });
		delete objectsRef.current[id];
		const spineFiles = spineFilesRef.current[id];
		if (spineFiles) {
			for (const texture of spineFiles.pageTextures) texture.destroy();
			for (const url of Object.values(spineFiles.fileURLs)) URL.revokeObjectURL(url);
			delete spineFilesRef.current[id];
		}
		if (el.type === "static") URL.revokeObjectURL(el.imageUrl);
		changeElements(elementsRef.current.filter((item) => item.id !== id));
		if (selectedIdRef.current === id) selectElement(null);
	};

	// the scene as JSON: settings and file paths only, the files themselves are not kept
	const serializeScene = () => ({
		version: 1,
		elements: elementsRef.current.map(serializeElement),
		fonts: [...Object.entries(bitmapFontsRef.current).map(([name, font]) => serializeFont(name, font)), ...Object.values(missingFontsRef.current)],
		particleTextures: particleFilesRef.current
	});

	const saveScene = () => {
		if (sceneLoadingRef.current) return;
		try {
			localStorage.setItem(SCENE_KEY, JSON.stringify(serializeScene()));
		} catch (err) {
			setErrorMsg("Scene autosave failed: " + err.message);
		}
	};

	const clearScene = () => {
		for (const { id } of [...elementsRef.current]) if (objectsRef.current[id]) deleteElement(id);
		for (const name of Object.keys(bitmapFontsRef.current)) removeBitmapFont(name);
		bitmapFontsRef.current = {};
		setBitmapFonts({});
		missingFontsRef.current = {};
		particleFilesRef.current = {};
		setMissingFiles([]);
		setFilesToAllow([]);
	};

	const getSceneFiles = (scene) => [...new Set([
		...scene.elements.flatMap(getElementFiles),
		...(scene.fonts || []).flatMap(getFontFiles),
		...Object.values(scene.particleTextures || {})
	])];

	// reads the scene's files again from where they were picked; returns the paths that wait for the user to allow access
	const readSavedFiles = async (paths, askAccess) => {
		const waiting = [];
		for (const path of paths) {
			if (assetsRef.current.has(path)) continue;
			try {
				const file = await readSavedFile(path, askAccess);
				if (file) assetsRef.current.set(path, file);
				else waiting.push(path);
			} catch {
				// never saved, or not at its old place any more: it stays missing
			}
		}
		return waiting;
	};

	const addSavedElement = async (data, findFile) => {
		if (data.type === "static") {
			const file = findFile(data.file);
			return file ? addImageElement(file, data) : null;
		}
		if (data.type === "spine") {
			const files = data.files.map(findFile);
			return files.every(Boolean) ? addSpineElement(files, data) : null;
		}
		if (data.type === "text") return addText(data);
		// a bitmap waits for its own font instead of switching to another one
		if (data.type === "bitmap") return BitmapFont.available[data.fontName] ? addBitmap(data) : null;
		if (data.type === "emitter") return addEmitter(data.config, data);
		// targets get their new ids once every element is built
		if (data.type === "fader") return addFader({ ...data, target: null });
		if (data.type === "mask") return addMask({ ...data, targets: [] });
		return null;
	};

	// builds a saved scene; getFile gives the file for a saved path, and every path it can not give is listed as missing
	const buildScene = async (scene, getFile) => {
		clearScene();
		const missing = new Set();
		const findFile = (path) => {
			const file = getFile(path);
			if (!file) missing.add(path);
			return file;
		};
		for (const fontData of scene.fonts || []) {
			const lost = getFontFiles(fontData).filter((path) => !findFile(path));
			let font = null;
			if (lost.length === 0) font = await readSavedFont(fontData, getFile).catch(() => null);
			if (font && setFont(fontData.name, font)) bitmapFontsRef.current = { ...bitmapFontsRef.current, [fontData.name]: font };
			else missingFontsRef.current[fontData.name] = fontData;
		}
		if (!BitmapFont.available.numbers) {
			const { name, glyphs } = await loadDefaultBitmapFont();
			if (setFont(name, { glyphs })) bitmapFontsRef.current = { ...bitmapFontsRef.current, [name]: { glyphs } };
		}
		particleFilesRef.current = { ...(scene.particleTextures || {}) };
		for (const [name, path] of Object.entries(particleFilesRef.current)) {
			const file = findFile(path);
			if (file) {
				registerParticleTexture(name, file);
			} else {
				// stands in until the file is picked; otherwise pixi would try to download the name as a URL
				Texture.removeFromCache(name);
				Texture.addToCache(Texture.from(DEFAULT_PARTICLE), name);
			}
		}
		// emitters made from the presets use the coin frames
		if (JSON.stringify(scene.elements).includes(COIN_FRAMES[0])) await loadCoinFrames().catch((err) => setErrorMsg("Coin frames failed to load: " + err.message));
		const newIds = {};
		for (const { id, ...data } of scene.elements) {
			let newId = null;
			try {
				newId = await addSavedElement(data, findFile);
			} catch (err) {
				console.error(`Scene element ${data.name} failed:`, err);
			}
			// what can not be built yet stays in the list with its settings and waits for its files
			newIds[id] = newId ?? addElement(data.type, new Container(), { ...data, missing: true });
		}
		const savedById = Object.fromEntries(scene.elements.map((data) => [newIds[data.id], data]));
		changeElements(elementsRef.current.map((el) => {
			const data = savedById[el.id] || {};
			const spineId = newIds[data.attach?.spineId];
			const changes = { attach: data.attach && spineId ? { ...data.attach, spineId } : null };
			if (el.type === "fader") changes.target = newIds[data.target] ?? null;
			if (el.type === "mask") changes.targets = (data.targets || []).map((id) => newIds[id]).filter(Boolean);
			return { ...el, ...changes };
		}));
		for (const el of elementsRef.current) {
			if (el.type === "fader") applyFader(el);
			if (el.type === "mask") applyMask(el);
		}
		placeObjects();
		selectElement(null);
		setMissingFiles([...missing]);
	};

	const loadScene = async (scene, getFile) => {
		sceneLoadingRef.current = true;
		try {
			await buildScene(scene, getFile);
		} finally {
			sceneLoadingRef.current = false;
		}
		saveScene();
	};

	const restoreSavedScene = async () => {
		if (restoreStartedRef.current) return;
		restoreStartedRef.current = true;
		let scene = null;
		try {
			scene = JSON.parse(localStorage.getItem(SCENE_KEY) || "null");
		} catch {
			// a broken save is skipped, the next autosave replaces it
		}
		try {
			if (scene?.elements?.length) {
				const waiting = await readSavedFiles(getSceneFiles(scene), false);
				// files of the last imported zip, unless a file picked later waits for access under the same path
				const zip = await getImportedZip().then((file) => file && readSceneZip(file)).catch(() => null);
				for (const [path, file] of zip?.files || []) if (!assetsRef.current.has(path) && !waiting.includes(path)) assetsRef.current.set(path, file);
				await loadScene(scene, getAssetFile);
				setFilesToAllow(waiting);
				// files that only wait for access are not reported as missing
				setMissingFiles((prev) => prev.filter((path) => !waiting.includes(path)));
			}
		} catch (err) {
			setErrorMsg("Saved scene failed to load: " + err.message);
		}
		sceneLoadingRef.current = false;
	};

	// the browser shows its access prompt only inside a click, so this runs from the "Allow access" button
	const allowSavedFiles = async () => {
		const waiting = await readSavedFiles(filesToAllow, true);
		await loadScene(serializeScene(), getAssetFile);
		setFilesToAllow(waiting);
		setMissingFiles((prev) => prev.filter((path) => !waiting.includes(path)));
	};

	// picked files are matched to the paths the scene keeps, then the scene is built again with them
	const relinkFiles = async (files) => {
		addAssets(files);
		await loadScene(serializeScene(), getAssetFile);
	};

	const exportScene = async () => {
		const scene = serializeScene();
		const paths = getSceneFiles(scene);
		const files = new Map();
		const notFound = [];
		for (const path of paths) {
			const file = getAssetFile(path);
			if (file) files.set(path, file);
			else notFound.push(path);
		}
		try {
			downloadFile("scene.zip", await createSceneZip(scene, files));
			setErrorMsg(notFound.length > 0 ? `Exported without these missing files: ${notFound.join(", ")}` : "");
		} catch (err) {
			setErrorMsg("Scene export error: " + err.message);
		}
	};

	const importScene = async (files) => {
		const zipFile = files.find((file) => file.name.toLowerCase().endsWith(".zip"));
		if (!zipFile) {
			setErrorMsg("Pick a scene .zip");
			return;
		}
		try {
			const { scene, files: zipFiles } = await readSceneZip(zipFile);
			assetsRef.current = zipFiles;
			await loadScene(scene, (path) => findAssetFile(zipFiles, path));
			setErrorMsg("");
			// after a reload the files are read again from this zip
			await saveImportedZip(zipFile, [...zipFiles.keys()]).catch((err) => setErrorMsg("The zip is not kept for a reload: " + err.message));
		} catch (err) {
			setErrorMsg("Scene import error: " + err.message);
		}
	};

	const resetScene = async () => {
		if (elementsRef.current.length > 0 && !window.confirm("Remove every element from the scene?")) return;
		await loadScene({ elements: [] }, () => null);
		assetsRef.current = new Map();
		// the kept zip and file places go too, so old files do not come back after a reload
		await clearSavedFiles().catch(() => {});
	};

	const moveElement = (id, step) => {
		const next = [...elementsRef.current];
		const i = next.findIndex((el) => el.id === id);
		const j = i + step;
		if (j < 0 || j >= next.length) return;
		[next[i], next[j]] = [next[j], next[i]];
		changeElements(next);
		placeObjects();
	};

	const renderEmitterPanel = (el) => {
		const config = el.config;
		const editConfig = (mutate) => {
			const next = structuredClone(config);
			mutate(next);
			setEmitterConfig(el.id, next);
		};
		const number = (value, onChange, step) => <NumberInput value={value} onChange={onChange} step={step} style={styles.fieldInput} />;
		const shape = findBehavior(config, SPAWN_TYPES);
		const shapeName = getShapeName(shape);
		const acceleration = findBehavior(config, [ACCELERATION.type]);
		const direction = findBehavior(config, [DIRECTION.type]);
		const blend = findBehavior(config, ["blendMode"])?.config.blendMode || "normal";
		const textureNames = getTextureNames(config);
		return (
			<>
				<div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
					<button style={styles.queueClearButton} onClick={() => setEmitterConfig(el.id, config)}>Restart</button>
					<button style={styles.queueClearButton} onClick={() => { emittersRef.current[el.id].emit = false; }}>Stop</button>
				</div>
				<div style={styles.trackItem}>
					<div style={styles.trackLabel}>Emission</div>
					<Field label="Frequency, s" styles={styles}>{number(config.frequency, (v) => editConfig((c) => { c.frequency = v; }), 0.005)}</Field>
					<Field label="Per wave" styles={styles}>{number(config.particlesPerWave ?? 1, (v) => editConfig((c) => { c.particlesPerWave = v; }))}</Field>
					<Field label="Max particles" styles={styles}>{number(config.maxParticles, (v) => editConfig((c) => { c.maxParticles = v; }), 10)}</Field>
					<Field label="Spawn chance" styles={styles}>{number(config.spawnChance ?? 1, (v) => editConfig((c) => { c.spawnChance = v; }), 0.05)}</Field>
					<Field label="Emitter life, s" styles={styles}>{number(config.emitterLifetime ?? -1, (v) => editConfig((c) => { c.emitterLifetime = v; }), 0.5)}</Field>
					<Field label="Life min, s" styles={styles}>{number(config.lifetime.min, (v) => editConfig((c) => { c.lifetime.min = v; }), 0.1)}</Field>
					<Field label="Life max, s" styles={styles}>{number(config.lifetime.max, (v) => editConfig((c) => { c.lifetime.max = v; }), 0.1)}</Field>
					<label style={styles.trimCheckboxLabel}>
						<input type="checkbox" checked={!!config.addAtBack} onChange={(e) => editConfig((c) => { c.addAtBack = e.target.checked; })} />
						New particles behind old
					</label>
				</div>
				<div style={styles.trackItem}>
					<div style={styles.trackLabel}>Spawn shape</div>
					<select style={{ ...styles.fieldInput, width: "100%", marginBottom: "4px" }} value={shapeName} onChange={(e) => editConfig((c) => { removeBehaviors(c, SPAWN_TYPES); c.behaviors.push(SHAPES[e.target.value]()); })}>
						<option value="point">Point</option>
						<option value="torus">Circle / ring</option>
						<option value="rect">Rectangle</option>
						<option value="burst">Burst</option>
						<option value="polygonalChain" disabled>Polygon (edit in JSON)</option>
					</select>
					{shapeName === "torus" && (
						<>
							<Field label="Radius" styles={styles}>{number(shape.config.data.radius, (v) => editConfig((c) => { findBehavior(c, SPAWN_TYPES).config.data.radius = v; }), 5)}</Field>
							<Field label="Inner radius" styles={styles}>{number(shape.config.data.innerRadius || 0, (v) => editConfig((c) => { findBehavior(c, SPAWN_TYPES).config.data.innerRadius = v; }), 5)}</Field>
							<label style={styles.trimCheckboxLabel}>
								<input type="checkbox" checked={!!shape.config.data.affectRotation} onChange={(e) => editConfig((c) => { findBehavior(c, SPAWN_TYPES).config.data.affectRotation = e.target.checked; })} />
								Fly out from the center
							</label>
						</>
					)}
					{shapeName === "rect" && (
						<>
							<Field label="Width" styles={styles}>{number(shape.config.data.w, (v) => editConfig((c) => { Object.assign(findBehavior(c, SPAWN_TYPES).config.data, { w: v, x: -v / 2 }); }), 10)}</Field>
							<Field label="Height" styles={styles}>{number(shape.config.data.h, (v) => editConfig((c) => { Object.assign(findBehavior(c, SPAWN_TYPES).config.data, { h: v, y: -v / 2 }); }), 10)}</Field>
						</>
					)}
					{shapeName === "burst" && (
						<>
							<Field label="Spacing, °" styles={styles}>{number(shape.config.spacing, (v) => editConfig((c) => { findBehavior(c, SPAWN_TYPES).config.spacing = v; }), 5)}</Field>
							<Field label="Start angle, °" styles={styles}>{number(shape.config.start || 0, (v) => editConfig((c) => { findBehavior(c, SPAWN_TYPES).config.start = v; }), 5)}</Field>
							<Field label="Distance" styles={styles}>{number(shape.config.distance || 0, (v) => editConfig((c) => { findBehavior(c, SPAWN_TYPES).config.distance = v; }), 5)}</Field>
						</>
					)}
				</div>
				{LIST_BEHAVIORS.map((def) => {
					const behavior = findBehavior(config, [def.type]);
					const values = behavior?.config[def.key]?.list;
					const valueInput = (index) => (def.type === "color"
						? <input type="color" style={styles.fieldInput} value={toColor(values[index].value)} onChange={(e) => editConfig((c) => { findBehavior(c, [def.type]).config[def.key].list[index].value = e.target.value; })} />
						: number(values[index].value, (v) => editConfig((c) => { findBehavior(c, [def.type]).config[def.key].list[index].value = v; }), def.step));
					return (
						<div key={def.type} style={styles.trackItem}>
							<label style={styles.trimCheckboxLabel}>
								<input type="checkbox" checked={!!behavior} onChange={(e) => editConfig((c) => toggleBehavior(c, def, e.target.checked))} />
								<b>{def.label}</b>
							</label>
							{values && (
								<>
									<Field label="Start" styles={styles}>{valueInput(0)}</Field>
									<Field label="End" styles={styles}>{valueInput(values.length - 1)}</Field>
								</>
							)}
							{behavior && !values && <div style={styles.fieldRow}>Edit in JSON</div>}
						</div>
					);
				})}
				<div style={styles.trackItem}>
					<label style={styles.trimCheckboxLabel}>
						<input type="checkbox" checked={!!acceleration} onChange={(e) => editConfig((c) => toggleBehavior(c, ACCELERATION, e.target.checked))} />
						<b>Acceleration (gravity)</b>
					</label>
					{acceleration && (
						<>
							<Field label="Start speed" styles={styles}>{number(acceleration.config.minStart, (v) => editConfig((c) => { Object.assign(findBehavior(c, [ACCELERATION.type]).config, { minStart: v, maxStart: v }); }), 10)}</Field>
							<Field label="Accel X" styles={styles}>{number(acceleration.config.accel.x, (v) => editConfig((c) => { findBehavior(c, [ACCELERATION.type]).config.accel.x = v; }), 10)}</Field>
							<Field label="Accel Y" styles={styles}>{number(acceleration.config.accel.y, (v) => editConfig((c) => { findBehavior(c, [ACCELERATION.type]).config.accel.y = v; }), 10)}</Field>
							<Field label="Max speed" styles={styles}>{number(acceleration.config.maxSpeed || 0, (v) => editConfig((c) => { findBehavior(c, [ACCELERATION.type]).config.maxSpeed = v; }), 10)}</Field>
						</>
					)}
				</div>
				<div style={styles.trackItem}>
					<label style={styles.trimCheckboxLabel}>
						<input type="checkbox" checked={!!direction} onChange={(e) => editConfig((c) => toggleBehavior(c, DIRECTION, e.target.checked))} />
						<b>Direction</b>
					</label>
					{direction && (
						<>
							<Field label="Min angle, °" styles={styles}>{number(direction.config.min, (v) => editConfig((c) => { findBehavior(c, [DIRECTION.type]).config.min = v; }), 5)}</Field>
							<Field label="Max angle, °" styles={styles}>{number(direction.config.max, (v) => editConfig((c) => { findBehavior(c, [DIRECTION.type]).config.max = v; }), 5)}</Field>
						</>
					)}
				</div>
				<div style={styles.trackItem}>
					<Field label="Blend mode" styles={styles}>
						<select style={styles.fieldInput} value={blend} onChange={(e) => editConfig((c) => {
							removeBehaviors(c, ["blendMode"]);
							if (e.target.value !== "normal") c.behaviors.push({ type: "blendMode", config: { blendMode: e.target.value } });
						})}>
							<option value="normal">Normal</option>
							<option value="add">Add</option>
							<option value="multiply">Multiply</option>
							<option value="screen">Screen</option>
						</select>
					</Field>
					<Field label="Textures" styles={styles}>
						<span style={styles.layerName} title={textureNames?.join(", ")}>{textureNames ? textureNames.join(", ") : "animated (JSON)"}</span>
					</Field>
					<div style={{ display: "flex", gap: "4px" }}>
						<button style={styles.queueClearButton} onClick={() => pickFiles("image/*", (files) => loadParticleTextures(el.id, files))} title="One image or several (random per particle)">Load…</button>
						<button style={styles.queueClearButton} onClick={() => editConfig((c) => { removeBehaviors(c, TEXTURE_TYPES); c.behaviors.push({ type: "textureSingle", config: { texture: DEFAULT_PARTICLE } }); })}>Default dot</button>
						<button
							style={styles.queueClearButton}
							title="The coin frames of base-slot, a random frame per particle"
							onClick={() => loadCoinFrames()
								.then(() => editConfig((c) => { removeBehaviors(c, TEXTURE_TYPES); c.behaviors.push({ type: "textureRandom", config: { textures: COIN_FRAMES } }); }))
								.catch((err) => setErrorMsg("Coin frames failed to load: " + err.message))}
						>Coins</button>
					</div>
				</div>
				<div style={styles.trackLabel}>Config JSON (any behaviors, old editor format works too)</div>
				<JsonBox value={JSON.stringify(config, null, 2)} onApply={applyJson} styles={styles} rows={14} />
			</>
		);
	};

	// a character the font has no glyph for is just not drawn, so it is named here
	const renderMissingGlyphs = (el) => {
		const font = bitmapFonts[el.fontName];
		if (!font) return null;
		const chars = new Set(font.glyphs.map((glyph) => glyph.char));
		const missing = [...new Set(formatBitmapValue(el.text, el))].filter((char) => !chars.has(char));
		return missing.length > 0 && <div style={styles.errorText}>Font {el.fontName} has no glyph for: {missing.join(" ")}</div>;
	};

	const renderSlotPicker = (el) => {
		const spines = elements.filter((item) => item.type === "spine" && item.id !== el.id && !isInSpine(item, el.id));
		if (spines.length === 0 && !el.attach) return null;
		const target = elements.find((item) => item.id === el.attach?.spineId);
		return (
			<div style={styles.trackItem}>
				<div style={styles.trackLabel}>In spine slot</div>
				<Field label="Spine" styles={styles}>
					<select
						style={styles.fieldInput}
						value={el.attach?.spineId ?? ""}
						onChange={(e) => {
							const spine = spines.find((item) => item.id === Number(e.target.value));
							setElementSlot(el.id, spine ? { spineId: spine.id, slot: spine.slots[0], mode: el.attach?.mode || "add" } : null);
						}}
					>
						<option value="">— none (scene) —</option>
						{spines.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
					</select>
				</Field>
				{el.attach && target && (
					<>
						<Field label="Slot" styles={styles}>
							<select style={styles.fieldInput} value={el.attach.slot} onChange={(e) => setElementSlot(el.id, { ...el.attach, slot: e.target.value })}>
								{target.slots.map((name) => <option key={name} value={name}>{name}</option>)}
							</select>
						</Field>
						<Field label="Mode" styles={styles}>
							<select style={styles.fieldInput} value={el.attach.mode} onChange={(e) => setElementSlot(el.id, { ...el.attach, mode: e.target.value })}>
								<option value="add">Add on top of slot</option>
								<option value="replace">Replace slot art</option>
							</select>
						</Field>
					</>
				)}
			</div>
		);
	};

	const renderMaskPanel = (el) => {
		const update = (changes) => updateElement(el.id, changes);
		const ownerOf = new Map(elements.filter((item) => item.type === "mask" && item.id !== el.id).flatMap((mask) => mask.targets.map((id) => [id, mask.name])));
		const candidates = elements.filter((item) => item.type !== "mask");
		const setPoint = (index, changes) => update({ points: el.points.map((point, i) => (i === index ? { ...point, ...changes } : point)) });
		return (
			<>
				<div style={styles.trackItem}>
					<div style={styles.trackLabel}>Clips these elements</div>
					{candidates.length === 0 && <div style={styles.fieldRow}>Add elements to the scene first</div>}
					{candidates.map((item) => {
						// an element can be clipped by one mask only
						const owner = ownerOf.get(item.id);
						return (
							<label key={item.id} style={{ ...styles.trimCheckboxLabel, opacity: owner ? 0.5 : 1 }} title={owner ? `Already clipped by ${owner}` : undefined}>
								<input
									type="checkbox"
									disabled={!!owner}
									checked={el.targets.includes(item.id)}
									onChange={(e) => update({ targets: e.target.checked ? [...el.targets, item.id] : el.targets.filter((id) => id !== item.id) })}
								/>
								{item.name}{owner ? ` (in ${owner})` : ""}
							</label>
						);
					})}
				</div>
				<div style={styles.trackItem}>
					<div style={styles.trackItemHeader}>
						<span style={styles.trackLabel}>Points ({el.points.length})</span>
						<button
							style={styles.queueClearButton}
							onClick={() => {
								const middle = getEdgeMiddle(el.points, el.points.length - 1);
								update({ points: [...el.points, { x: Math.round(middle.x), y: Math.round(middle.y) }] });
							}}
						>+ Point</button>
					</div>
					{el.points.map((point, i) => (
						<div key={i} style={styles.fieldRow}>
							<span style={{ width: "16px" }}>{i + 1}</span>
							<NumberInput value={point.x} style={styles.fieldInput} onChange={(x) => setPoint(i, { x })} />
							<NumberInput value={point.y} style={styles.fieldInput} onChange={(y) => setPoint(i, { y })} />
							<button style={styles.queueRemoveButton} disabled={el.points.length <= 3} onClick={() => update({ points: el.points.filter((_, j) => j !== i) })} title="Delete point">×</button>
						</div>
					))}
					<div style={{ ...styles.fieldRow, opacity: 0.7 }}>
						On the canvas: drag a square to move a point, click a dot between points to add one, double-click a square to delete it, drag inside to move the mask.
					</div>
				</div>
			</>
		);
	};

	const renderFaderProperties = (el) => {
		const update = (changes) => updateElement(el.id, changes);
		const targets = elements.filter((item) => item.type !== "fader");
		return (
			<>
				<h3 style={styles.sectionHeader}>Fader</h3>
				<Field label="Name" styles={styles}><input style={styles.fieldInput} value={el.name} onChange={(e) => update({ name: e.target.value })} /></Field>
				<Field label="Darken" styles={styles}>
					<select style={styles.fieldInput} value={el.target ?? ""} onChange={(e) => update({ target: Number(e.target.value) || null })}>
						<option value="">Whole scene below it</option>
						{targets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
					</select>
				</Field>
				<Field label="Alpha" styles={styles}><NumberInput value={el.faderAlpha} step={0.05} style={styles.fieldInput} onChange={(faderAlpha) => update({ faderAlpha: Math.min(1, Math.max(0, faderAlpha)) })} /></Field>
				<Field label="Fade time, s" styles={styles}><NumberInput value={el.fadeDuration} step={0.1} style={styles.fieldInput} onChange={(fadeDuration) => update({ fadeDuration: Math.max(0, fadeDuration) })} /></Field>
				<div style={{ display: "flex", gap: "4px", margin: "6px 0" }}>
					<button style={styles.queueClearButton} onClick={() => fadeTo(el, 1)} title="The game's fader.show()">Fade in ▶</button>
					<button style={styles.queueClearButton} onClick={() => fadeTo(el, 0)} title="The game's fader.hide()">Fade out</button>
					<span style={{ ...styles.fieldRow, margin: 0 }}>{el.shown ? "shown" : "hidden"}</span>
				</div>
				<div style={{ ...styles.fieldRow, opacity: 0.7 }}>
					{el.target ? "Darkens only this element." : "Darkens every layer under the fader, like the game's fader on its overlay layer: move it in the layers list."}
				</div>
			</>
		);
	};

	const renderProperties = (el) => {
		if (el.type === "fader") return renderFaderProperties(el);
		if (el.missing) {
			return (
				<>
					<h3 style={styles.sectionHeader}>{TYPE_LABELS[el.type]}</h3>
					<Field label="Name" styles={styles}><input style={styles.fieldInput} value={el.name} onChange={(e) => updateElement(el.id, { name: e.target.value })} /></Field>
					<div style={styles.errorText}>
						{el.type === "bitmap" ? `Its font ${el.fontName} is not loaded` : `Its files were not found: ${getElementFiles(el).join(", ")}`}. Pick them in the Scene section on the left.
					</div>
				</>
			);
		}
		return renderElementProperties(el);
	};

	const renderElementProperties = (el) => {
		const update = (changes) => updateElement(el.id, changes);
		const updateStyle = (changes) => update({ style: { ...el.style, ...changes } });
		const number = (value, onChange, step) => <NumberInput value={value} onChange={onChange} step={step} style={styles.fieldInput} />;
		const select = (value, options, onChange) => (
			<select style={styles.fieldInput} value={value} onChange={(e) => onChange(e.target.value)}>
				{options.map((option) => <option key={option} value={option}>{option}</option>)}
			</select>
		);
		const place = getPlace(el);
		const config = el.type === "fader" || el.type === "mask" ? null : getElementConfig(el);
		return (
			<>
				<h3 style={styles.sectionHeader}>{TYPE_LABELS[el.type]}</h3>
				<Field label="Name" styles={styles}><input style={styles.fieldInput} value={el.name} onChange={(e) => update({ name: e.target.value })} /></Field>
				<div style={{ ...styles.fieldRow, opacity: 0.7 }}>
					<span style={{ flex: 1 }}>
						{el.attach ? "Place in the slot (every view)" : ui.viewport !== "portrait" ? "Place: landscape and desktop" : el.portrait ? "Place: portrait (own)" : "Place: portrait (same as landscape until changed)"}
					</span>
					{!el.attach && ui.viewport === "portrait" && el.portrait && (
						<button style={styles.queueClearButton} onClick={() => update({ portrait: null })} title="Drop the portrait place and use the landscape one">Use landscape</button>
					)}
				</div>
				<Field label="X" styles={styles}>{number(place.x, (x) => update({ x }))}</Field>
				<Field label="Y" styles={styles}>{number(place.y, (y) => update({ y }))}</Field>
				<Field label="Scale" styles={styles}>{number(place.scale, (scale) => update({ scale }), 0.05)}</Field>
				<Field label="Rotation, °" styles={styles}>{number(el.rotation, (rotation) => update({ rotation }), 5)}</Field>
				{/* a mask is never drawn, so its alpha would change nothing */}
				{el.type !== "mask" && (
					<Field label="Alpha" styles={styles}>
						<input type="range" min="0" max="1" step="0.01" style={styles.fieldInput} value={el.alpha} onChange={(e) => update({ alpha: parseFloat(e.target.value) })} />
					</Field>
				)}
				{el.type === "static" && (
					<>
						<div style={{ ...styles.fieldRow, opacity: 0.7 }} title="Read again from here after a reload">File: {el.file}</div>
						<button style={styles.queueClearButton} onClick={() => pickFiles("image/*", (files) => setElementImage(el.id, files))}>Replace image…</button>
					</>
				)}
				{renderSlotPicker(el)}
				{el.type === "spine" && (
					<>
						<div style={{ ...styles.fieldRow, opacity: 0.7 }} title={el.files.join("\n")}>Files: {el.files.find((path) => path.toLowerCase().endsWith(".json"))} + {el.files.length - 1} more</div>
						<Field label="Skin" styles={styles}>{select(el.skin, el.skins, (skin) => update({ skin }))}</Field>
						<Field label="Speed" styles={styles}>{number(el.speed, (speed) => update({ speed }), 0.1)}</Field>
						<div style={{ ...styles.trackItemHeader, marginTop: "6px" }}>
							<span style={styles.trackLabel}>Tracks (play at the same time)</span>
							<div style={{ display: "flex", gap: "4px" }}>
								<button style={styles.queueClearButton} onClick={() => restartSpine(el.id)} title="Start every track from the beginning">Restart</button>
								<button style={styles.queueClearButton} onClick={() => update({ tracks: [...el.tracks, { animation: el.animations[0] || "", loop: true, alpha: 1 }] })}>+ Track</button>
							</div>
						</div>
						{el.tracks.map((track, i) => {
							const setTrack = (changes) => update({ tracks: el.tracks.map((item, j) => (j === i ? { ...item, ...changes } : item)) });
							return (
								<div key={i} style={styles.trackItem}>
									<div style={styles.trackItemHeader}>
										<span style={styles.trackLabel}>Track {i}</span>
										{i > 0 && <button style={styles.queueRemoveButton} onClick={() => update({ tracks: el.tracks.filter((_, j) => j !== i) })} title="Remove track">×</button>}
									</div>
									<Field label="Animation" styles={styles}>
										<select style={styles.fieldInput} value={track.animation} onChange={(e) => setTrack({ animation: e.target.value })}>
											<option value="">— empty —</option>
											{el.animations.map((name) => <option key={name} value={name}>{name}</option>)}
										</select>
									</Field>
									<Field label="Alpha" styles={styles}>{number(track.alpha, (alpha) => setTrack({ alpha }), 0.1)}</Field>
									<label style={styles.trimCheckboxLabel}>
										<input type="checkbox" checked={track.loop} onChange={(e) => setTrack({ loop: e.target.checked })} />
										Loop
									</label>
								</div>
							);
						})}
					</>
				)}
				{el.type === "text" && (
					<textarea style={{ ...styles.jsonInput, fontFamily: "inherit", marginBottom: "4px" }} rows={3} value={el.text} onChange={(e) => update({ text: e.target.value })} />
				)}
				{el.type === "bitmap" && (
					<>
						<Field label="Value" styles={styles}>
							<input
								style={styles.fieldInput}
								inputMode="decimal"
								value={el.text}
								title="A number, like the game sets it; the decimal part goes after . or ,"
								onChange={(e) => update({ text: toNumberText(e.target.value) })}
							/>
						</Field>
						<Field label="Decimals" styles={styles}>{number(el.decimals, (decimals) => update({ decimals: Math.max(0, Math.round(decimals)) }))}</Field>
						{renderMissingGlyphs(el)}
						<label style={styles.trimCheckboxLabel} title="Thousands and millions become 12.50k / 1.25m, like the game's short values">
							<input type="checkbox" checked={el.isShort} onChange={(e) => update({ isShort: e.target.checked })} />
							Is short
						</label>
						<Field label="Font" styles={styles}>{select(el.fontName, Object.keys(bitmapFonts), (fontName) => update({ fontName }))}</Field>
						<div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "4px" }}>
							<button style={styles.queueClearButton} onClick={() => pickFiles(".json,image/*", (files) => importFont(el.id, readSheetGlyphs, files))} title="Sheet .json + .png, like assets/fonts/bitmap/numbers">Import sheet…</button>
							<button style={styles.queueClearButton} onClick={() => pickFiles("", (files) => importFont(el.id, readGlyphFolder, files), true)} title="A folder of images named by character, like raw/fonts/bitmap/numbers">Import glyph folder…</button>
							<button style={styles.queueClearButton} onClick={() => pickFiles(".fnt,.xml,image/*", (files) => importFont(el.id, readFntGlyphs, files))} title="BMFont .fnt with its .png pages">Import .fnt…</button>
						</div>
						<Field label="Size" styles={styles}>{number(el.fontSize, (fontSize) => update({ fontSize }), 2)}</Field>
						<Field label="Tint" styles={styles}><input type="color" style={styles.fieldInput} value={el.tint} onChange={(e) => update({ tint: e.target.value })} /></Field>
						<Field label="Align" styles={styles}>{select(el.align, ["left", "center", "right"], (align) => update({ align }))}</Field>
						<Field label="Letter spacing" styles={styles}>{number(el.letterSpacing, (letterSpacing) => update({ letterSpacing }))}</Field>
						<Field label="Max width" styles={styles}>{number(el.maxWidth, (maxWidth) => update({ maxWidth }), 10)}</Field>
						<Field label="Scale to width" styles={styles}>{number(el.scaleToWidth, (scaleToWidth) => update({ scaleToWidth: Math.max(0, scaleToWidth) }), 10)}</Field>
						<Field label="Min fit width" styles={styles}>{number(el.minFitWidthPx, (minFitWidthPx) => update({ minFitWidthPx: Math.max(0, minFitWidthPx) }), 10)}</Field>
						<Field label="Increment time, s" styles={styles}>{number(el.incrementTime, (incrementTime) => update({ incrementTime }), 0.5)}</Field>
						<button style={{ ...styles.queueClearButton, marginBottom: "6px" }} onClick={() => startIncrement(el)} title="Counts from 0 to the value, like the game's countup">Increment ▶</button>
						<div style={styles.trackLabel}>Bitmap JSON (game bitmapTextStyle + tint + bitmap-value props)</div>
						<JsonBox value={getBitmapJson(el)} onApply={(text) => applyBitmapJson(el, text)} styles={styles} rows={8} />
						{bitmapFonts[el.fontName] && (
							<BitmapFontEditor
								name={el.fontName}
								font={bitmapFonts[el.fontName]}
								styles={styles}
								onSetGlyphs={(glyphs) => setFont(el.fontName, { ...bitmapFonts[el.fontName], glyphs })}
								onRename={(newName) => renameFont(el.fontName, newName)}
								onAddGlyphs={() => pickFiles("image/*", (files) => addGlyphs(el.fontName, files))}
								onExport={() => exportSheet(el.fontName, bitmapFonts[el.fontName].glyphs)}
								onDelete={() => deleteFont(el.fontName)}
							/>
						)}
					</>
				)}
				{el.type === "text" && <TextStyleEditor style={el.style} onChange={(style) => update({ style })} onError={setErrorMsg} styles={styles} />}
				{el.type === "emitter" && renderEmitterPanel(el)}
				{el.type === "mask" && renderMaskPanel(el)}
				{config && (
					<>
						<h3 style={styles.sectionHeader}>Game config</h3>
						<textarea style={styles.jsonInput} rows={Math.min(14, config.split("\n").length)} readOnly spellCheck={false} value={config} aria-label="Game config" />
						<button style={{ ...styles.queueClearButton, marginTop: "4px" }} onClick={() => navigator.clipboard.writeText(config).catch((err) => setErrorMsg("Copy failed: " + err.message))}>Copy config</button>
					</>
				)}
			</>
		);
	};

	const phone = ui.viewport === "desktop" ? null : getPhoneFrame(ui.viewport, area, PHONE_MARGIN * styles.uiScale);

	return (
		<div style={{ ...styles.mainContent, display: active ? "flex" : "none" }}>
			<input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={onFileInputChange} />
			{ui.leftPanel && (
				<div style={{ ...styles.debugPanel, width: 220 * styles.uiScale }}>
					<h3 style={styles.sectionHeader}>Scene</h3>
					<div style={styles.addButtons}>
						<button style={styles.addButton} onClick={exportScene} title="scene.json with every file of the scene">Export .zip</button>
						<button style={styles.addButton} onClick={() => pickFiles(".zip", importScene)}>Import .zip</button>
						<button style={{ ...styles.addButton, gridColumn: "1 / -1" }} onClick={resetScene} title="Removes every element and the files kept for a reload">Clear scene</button>
					</div>
					<div style={{ ...styles.fieldRow, opacity: 0.7 }}>
						{canKeepFileAccess() ? "Autosaved; files are read again from where you picked them, an imported zip is kept whole" : "Autosaved in this browser; an imported zip is kept whole, other files by name only"}
					</div>
					{filesToAllow.length > 0 && (
						<div style={styles.trackItem}>
							<div style={styles.fieldRow} title={filesToAllow.join("\n")}>The browser asks to allow reading {filesToAllow.length} saved file(s) again</div>
							<button style={styles.queueClearButton} onClick={allowSavedFiles}>Allow access</button>
						</div>
					)}
					{missingFiles.length > 0 && (
						<div style={styles.trackItem}>
							<div style={styles.errorText} title={missingFiles.join("\n")}>
								{missingFiles.length} file(s) of the saved scene are not at their old place: {missingFiles.slice(0, 3).join(", ")}{missingFiles.length > 3 ? "…" : ""}
							</div>
							<div style={{ display: "flex", gap: "4px" }}>
								<button style={styles.queueClearButton} onClick={() => pickFiles("", relinkFiles)}>Pick files…</button>
								<button style={styles.queueClearButton} onClick={() => pickFiles("", relinkFiles, true)}>Pick folder…</button>
							</div>
						</div>
					)}
					<h3 style={styles.sectionHeader}>Add</h3>
					<div style={styles.addButtons}>
						<button style={styles.addButton} onClick={() => pickFiles("image/*", addImages)}>Image</button>
						<button style={styles.addButton} onClick={() => addText()}>Text</button>
						<button style={styles.addButton} onClick={() => pickFiles(".json,.atlas,.png,.jpg,.jpeg,.webp", addSpine)} title="Pick JSON + atlas + images">Spine files</button>
						<button style={styles.addButton} onClick={() => pickFiles("", addSpine, true)}>Spine folder</button>
						<button style={styles.addButton} onClick={() => addBitmap()}>Bitmap</button>
						<button style={styles.addButton} onClick={() => addEmitter()}>Emitter</button>
						<button style={styles.addButton} onClick={() => addFader()} title="A black curtain that fades in and out, like the game's fader">Fader</button>
						<button style={styles.addButton} onClick={() => addMask()} title="A polygon that clips the elements you choose">Mask</button>
					</div>
					<h3 style={styles.sectionHeader}>Emitter presets</h3>
					<div style={styles.addButtons}>
						{EMITTER_PRESETS.map((preset) => (
							<button key={preset.name} style={styles.addButton} onClick={() => addPresetEmitter(preset)} title="Coin rain of base-slot">{preset.name}</button>
						))}
					</div>
					<h3 style={styles.sectionHeader}>Layers</h3>
					<div style={styles.bonesList}>
						{[...elements].reverse().map((el) => (
							<div
								key={el.id}
								style={{
									...styles.layerItem,
									backgroundColor: el.id === selectedId ? "rgba(0,170,255,0.2)" : "transparent",
									borderLeft: `3px solid ${el.id === selectedId ? "#00aaff" : "transparent"}`
								}}
								onClick={() => selectElement(el.id)}
							>
								<span style={{ ...styles.layerName, opacity: el.visible ? 1 : 0.4 }} title={el.attach ? `In slot ${el.attach.slot}` : undefined}>
									{el.name}
									{el.attach && <span style={{ opacity: 0.6 }}> ↳ {el.attach.slot}</span>}
									{el.missing && <span style={{ color: "#f44336" }}> (missing files)</span>}
								</span>
								<button style={styles.queueClearButton} onClick={(e) => { e.stopPropagation(); updateElement(el.id, { visible: !el.visible }); }}>{el.visible ? "Hide" : "Show"}</button>
								<button style={styles.queueClearButton} onClick={(e) => { e.stopPropagation(); moveElement(el.id, 1); }} title="Move forward">▲</button>
								<button style={styles.queueClearButton} onClick={(e) => { e.stopPropagation(); moveElement(el.id, -1); }} title="Move back">▼</button>
								<button style={styles.queueRemoveButton} onClick={(e) => { e.stopPropagation(); deleteElement(el.id); }} title="Delete">×</button>
							</div>
						))}
					</div>
				</div>
			)}
			<div style={styles.leftColumn}>
				<div ref={dropZoneRef} style={styles.dropZone}>
					{phone && (
						<>
							<div
								style={{
									...styles.phoneBezel,
									left: phone.left - PHONE_BEZEL,
									top: phone.top - PHONE_BEZEL,
									width: phone.width + PHONE_BEZEL * 2,
									height: phone.height + PHONE_BEZEL * 2,
									borderRadius: phone.radius + PHONE_BEZEL
								}}
							/>
							<div style={{ ...styles.phoneIsland, ...phone.island }} />
							{/* above the phone: below it the zoom controls would cover it */}
							<div style={{ ...styles.phoneCaption, top: phone.top - PHONE_BEZEL - 22 * styles.uiScale }}>
								iPhone 16 Pro · {phone.screenWidth} × {phone.screenHeight} pt · game design {DESIGN_SIZES[ui.viewport].x} × {DESIGN_SIZES[ui.viewport].y}
							</div>
						</>
					)}
					<div
						ref={pixiContainerRef}
						style={phone
							? { position: "absolute", left: phone.left, top: phone.top, width: phone.width, height: phone.height, borderRadius: phone.radius, overflow: "hidden", zIndex: 1 }
							: styles.pixiContainer}
					/>
					<div style={{ ...styles.sceneBar, left: 8 }}>
						<button style={styles.iconButton(ui.leftPanel)} onClick={() => changeUi({ leftPanel: !ui.leftPanel })} title={ui.leftPanel ? "Hide the left panel" : "Show the left panel"} aria-label="Left panel" aria-pressed={ui.leftPanel}>
							<Icon name="leftPanel" />
						</button>
						<button style={styles.iconButton(ui.rightPanel)} onClick={() => changeUi({ rightPanel: !ui.rightPanel })} title={ui.rightPanel ? "Hide the right panel" : "Show the right panel"} aria-label="Right panel" aria-pressed={ui.rightPanel}>
							<Icon name="rightPanel" />
						</button>
					</div>
					<div style={{ ...styles.sceneBar, right: 8 }}>
						{VIEWPORTS.map(([mode, label]) => (
							<button key={mode} style={styles.iconButton(ui.viewport === mode)} onClick={() => changeUi({ viewport: mode })} title={label} aria-label={label} aria-pressed={ui.viewport === mode}>
								<Icon name={mode} />
							</button>
						))}
					</div>
					{elements.length === 0 && (
						<p style={{ ...styles.dropText, pointerEvents: "none" }}>Add elements with the buttons on the left</p>
					)}
					<div style={styles.canvasControls}>
						<label style={styles.bonesCheckboxLabel}>
							Zoom
							{/* log scale: every step multiplies the zoom by the same amount, so 25-200% is not squeezed at one end */}
							<input
								type="range"
								min={Math.log2(MIN_ZOOM)}
								max={Math.log2(MAX_ZOOM)}
								step="any"
								value={Math.log2(zoom)}
								// near the middle it sticks to exactly 100%, so the pixel-exact view is easy to hit
								onChange={(e) => setZoomValue(Math.abs(e.target.value) < 0.05 ? 1 : 2 ** parseFloat(e.target.value))}
								style={styles.zoomSlider}
								aria-label="Scene zoom"
							/>
							<span style={styles.zoomValue}>{Math.round(zoom * 100)}%</span>
						</label>
						<button style={styles.openFileButton} onClick={resetView}>Reset view</button>
					</div>
				</div>
			</div>
			{ui.rightPanel && (
				<div style={{ ...styles.sidebar, width: 280 * styles.uiScale }}>
					<div style={styles.fixedArea}>
						{errorMsg && <div style={styles.errorText}>{errorMsg}</div>}
						{selected ? renderProperties(selected) : <p style={styles.sliderLabel}>Select an element on the canvas or in the layers list</p>}
					</div>
				</div>
			)}
		</div>
	);
}
