import React, { useState, useCallback, useRef, useEffect } from "react";
import { Application, BaseTexture, Graphics, Text, filters } from "pixi.js";
import { Spine, TextureAtlas } from "pixi-spine";
import { AtlasAttachmentLoader, SkeletonJson } from "@pixi-spine/runtime-4.1";
import { getStyles } from "./styles";

function modifyAtlasText(atlasText, fileURLs) {
	return atlasText;
}

function App() {
	const [spineLoaded, setSpineLoaded] = useState(false);
	const [animationPlaying, setAnimationPlaying] = useState(false);
	const [errorMsg, setErrorMsg] = useState("");
	const [scaleValue, setScaleValue] = useState(0.5);
	const [speedValue, setSpeedValue] = useState(1.0);
	const [slotFilter, setSlotFilter] = useState("");
	const [availableAnimations, setAvailableAnimations] = useState([]);
	const [selectedAnimation, setSelectedAnimation] = useState("");
	const [availableSkins, setAvailableSkins] = useState([]);
	const [selectedSkin, setSelectedSkin] = useState("");
	const [attachedSlots, setAttachedSlots] = useState([]);
	const [circleScaleValue, setCircleScaleValue] = useState(1.0);
	const [theme, setTheme] = useState("dark");
	const [debugMode, setDebugMode] = useState(false);
	const [fps, setFps] = useState(0);
	const [animationQueue, setAnimationQueue] = useState([]);
	const [queueLoop, setQueueLoop] = useState(false);
	const [boneNames, setBoneNames] = useState([]);
	const [selectedBones, setSelectedBones] = useState(new Set());
	const [boneFilter, setBoneFilter] = useState("");
	const [showBones, setShowBones] = useState(true);
	const [debugEntityType, setDebugEntityType] = useState("bones");
	const [debugEntities, setDebugEntities] = useState({
		regionAttachments: [], meshes: [], paths: [], boundingBoxes: [], clipping: []
	});
	const [selectedDebugEntities, setSelectedDebugEntities] = useState({
		regionAttachments: new Set(), meshes: new Set(), paths: new Set(), boundingBoxes: new Set(), clipping: new Set()
	});
	const [debugFilter, setDebugFilter] = useState("");
	const [queueIndex, setQueueIndex] = useState(-1);
	const [animTime, setAnimTime] = useState(0);
	const [animDuration, setAnimDuration] = useState(0);
	const [trimStart, setTrimStart] = useState(0);
	const [trimEnd, setTrimEnd] = useState(0);
	const [trimEnabled, setTrimEnabled] = useState(false);

	const pixiContainerRef = useRef(null);
	const pixiAppRef = useRef(null);
	const spineInstanceRef = useRef(null);
	const attachedCirclesRef = useRef({});
	const filesDataRef = useRef({});
	const fileInputRef = useRef(null);
	const bonesGraphicsRef = useRef(null);
	const animationQueueRef = useRef([]);
	const queueLoopRef = useRef(false);
	const queueIndexRef = useRef(-1);
	const selectedBonesRef = useRef(new Set());
	const debugGraphicsRef = useRef(null);
	const regionFiltersRef = useRef(new Map());
	const dragOffsetRef = useRef({ x: 0, y: 0 });
	const draggingRef = useRef(null);
	const trimStartRef = useRef(0);
	const trimEndRef = useRef(0);
	const trimEnabledRef = useRef(false);
	const selectedDebugEntitiesRef = useRef({
		regionAttachments: new Set(), meshes: new Set(), paths: new Set(), boundingBoxes: new Set(), clipping: new Set()
	});

	const styles = getStyles(theme);

	const ThemeToggle = ({ theme, toggleTheme }) => (
		<label style={styles.toggleSwitch}>
			<input type="checkbox" checked={theme === "light"} onChange={toggleTheme} style={{ display: "none" }} />
			<span style={styles.toggleSlider(theme)}>
        <span style={styles.toggleKnob(theme)}></span>
      </span>
		</label>
	);

	const updateSpinePosition = useCallback(() => {
		if (pixiAppRef.current && spineInstanceRef.current) {
			const spine = spineInstanceRef.current;
			spine.updateTransform();
			const bounds = spine.getLocalBounds();
			const { width, height } = pixiAppRef.current.screen;
			spine.scale.set(scaleValue);
			spine.pivot.set(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
			spine.x = width / 2 + dragOffsetRef.current.x;
			spine.y = height / 2 + dragOffsetRef.current.y;
		}
	}, [scaleValue]);

	useEffect(() => {
		if (!pixiAppRef.current && pixiContainerRef.current) {
			const app = new Application({
				width: pixiContainerRef.current.clientWidth,
				height: pixiContainerRef.current.clientHeight,
				backgroundAlpha: 1,
				backgroundColor: 0x888888,
				resolution: window.devicePixelRatio || 1,
				autoDensity: true
			});
			pixiContainerRef.current.appendChild(app.view);
			pixiAppRef.current = app;
		}
	}, []);

	useEffect(() => {
		if (!pixiAppRef.current) return;
		const ticker = pixiAppRef.current.ticker;
		const updateFps = () => setFps(Math.round(ticker.FPS));
		ticker.add(updateFps);
		return () => ticker.remove(updateFps);
	}, []);

	useEffect(() => {
		if (!pixiAppRef.current) return;
		const ticker = pixiAppRef.current.ticker;
		const updateTimeline = () => {
			if (!spineInstanceRef.current) return;
			const track = spineInstanceRef.current.state.getCurrent(0);
			if (!track) return;
			const t = track.getAnimationTime();
			const dur = track.animation ? track.animation.duration : 0;
			setAnimTime(t);
			if (dur > 0 && trimEnabledRef.current) {
				const ts = trimStartRef.current;
				const te = trimEndRef.current;
				if (t >= te) {
					track.trackTime = track.trackTime - (t - ts);
				}
			}
		};
		ticker.add(updateTimeline);
		return () => ticker.remove(updateTimeline);
	}, []);

	useEffect(() => {
		if (!pixiContainerRef.current) return;
		const observer = new ResizeObserver((entries) => {
			for (let entry of entries) {
				const { width, height } = entry.contentRect;
				if (pixiAppRef.current) {
					pixiAppRef.current.renderer.resize(width, height);
					updateSpinePosition();
				}
			}
		});
		observer.observe(pixiContainerRef.current);
		return () => observer.disconnect();
	}, [updateSpinePosition]);

	const updateCircles = useCallback(() => {
		if (!spineInstanceRef.current) return;
		for (const slotName in attachedCirclesRef.current) {
			const circle = attachedCirclesRef.current[slotName];
			const slot = spineInstanceRef.current.skeleton.findSlot(slotName);
			if (slot && slot.bone) {
				spineInstanceRef.current.slotContainers[slot.data.index].addChild(circle);
			}
		}
	}, []);

	useEffect(() => {
		if (pixiAppRef.current) {
			pixiAppRef.current.ticker.add(updateCircles);
			return () => {
				pixiAppRef.current.ticker.remove(updateCircles);
			};
		}
	}, [updateCircles]);

	const handleScaleChange = (e) => {
		const newScale = parseFloat(e.target.value);
		setScaleValue(newScale);
		updateSpinePosition();
	};

	const handleSpeedChange = (e) => {
		const newSpeed = parseFloat(e.target.value);
		setSpeedValue(newSpeed);
		if (spineInstanceRef.current && animationPlaying) {
			spineInstanceRef.current.state.timeScale = newSpeed;
		}
	};

	const handleCircleScaleChange = (e) => {
		const newScale = parseFloat(e.target.value);
		setCircleScaleValue(newScale);
		Object.values(attachedCirclesRef.current).forEach((circle) => {
			circle.scale.set(newScale);
		});
	};

	const loadFiles = useCallback(
		(files) => {
			setErrorMsg("");
			setSpineLoaded(false);
			setAnimationPlaying(false);
			setAvailableAnimations([]);
			setSelectedAnimation("");
			setAttachedSlots([]);
			setDebugMode(false);
			setDebugEntityType("bones");
			dragOffsetRef.current = { x: 0, y: 0 };
			setDebugEntities({ regionAttachments: [], meshes: [], paths: [], boundingBoxes: [], clipping: [] });
			setSelectedDebugEntities({ regionAttachments: new Set(), meshes: new Set(), paths: new Set(), boundingBoxes: new Set(), clipping: new Set() });
			selectedDebugEntitiesRef.current = { regionAttachments: new Set(), meshes: new Set(), paths: new Set(), boundingBoxes: new Set(), clipping: new Set() };
			setDebugFilter("");
			setAnimationQueue([]);
			animationQueueRef.current = [];
			setQueueIndex(-1);
			queueIndexRef.current = -1;
			setBoneNames([]);
			setSelectedBones(new Set());
			selectedBonesRef.current = new Set();
			setBoneFilter("");
			for (const key in attachedCirclesRef.current) {
				if (spineInstanceRef.current) {
					spineInstanceRef.current.removeChild(attachedCirclesRef.current[key]);
					attachedCirclesRef.current[key].destroy();
				}
			}
			attachedCirclesRef.current = {};
			if (bonesGraphicsRef.current) {
				bonesGraphicsRef.current.destroy();
				bonesGraphicsRef.current = null;
			}
			if (debugGraphicsRef.current) {
				debugGraphicsRef.current.destroy();
				debugGraphicsRef.current = null;
			}
			for (const [, entry] of regionFiltersRef.current) {
				entry.container.filters = [];
			}
			regionFiltersRef.current.clear();
			if (spineInstanceRef.current && pixiAppRef.current) {
				pixiAppRef.current.stage.removeChild(spineInstanceRef.current);
				spineInstanceRef.current.destroy();
				spineInstanceRef.current = null;
			}
			if (!files || files.length === 0) {
				setErrorMsg("Files not found");
				return;
			}
			const filesMap = {};
			for (let i = 0; i < files.length; i++) {
				filesMap[files[i].name] = files[i];
			}
			const fileURLs = {};
			for (const name in filesMap) {
				fileURLs[name] = URL.createObjectURL(filesMap[name]);
			}
			filesDataRef.current = fileURLs;
			let jsonFileName = null;
			let atlasFileName = null;
			for (const name in filesMap) {
				const lower = name.toLowerCase();
				if (lower.endsWith(".json")) jsonFileName = name;
				else if (lower.endsWith(".atlas")) atlasFileName = name;
			}
			if (!jsonFileName || !atlasFileName) {
				setErrorMsg("Required files (JSON and ATLAS) not found");
				return;
			}
			const readerJSON = new FileReader();
			const readerAtlas = new FileReader();
			let jsonText = "";
			let atlasText = "";
			readerJSON.onload = (e) => {
				jsonText = e.target.result;
				if (atlasText) {
					try {
						const jsonData = JSON.parse(jsonText);
						createSpineAnimation(jsonData, atlasText, fileURLs);
					} catch (err) {
						console.error("Error parsing JSON file:", err);
						setErrorMsg("Error parsing JSON file: " + err.message);
					}
				}
			};
			readerJSON.onerror = (err) => {
				console.error("Error reading JSON file:", err);
				setErrorMsg("Error reading JSON file");
			};
			readerAtlas.onload = (e) => {
				atlasText = e.target.result;
				if (jsonText) {
					try {
						const jsonData = JSON.parse(jsonText);
						createSpineAnimation(jsonData, atlasText, fileURLs);
					} catch (err) {
						console.error("Error parsing JSON file:", err);
						setErrorMsg("Error parsing JSON file: " + err.message);
					}
				}
			};
			readerAtlas.onerror = (err) => {
				console.error("Error reading ATLAS file:", err);
				setErrorMsg("Error reading ATLAS file");
			};
			readerJSON.readAsText(filesMap[jsonFileName]);
			readerAtlas.readAsText(filesMap[atlasFileName]);
		},
		[updateSpinePosition]
	);

	useEffect(() => {
		if (!pixiAppRef.current) return;
		const view = pixiAppRef.current.view;
		const onPointerDown = (e) => {
			if (e.button !== 0 || !spineInstanceRef.current) return;
			draggingRef.current = { startX: e.clientX, startY: e.clientY, origX: dragOffsetRef.current.x, origY: dragOffsetRef.current.y };
		};
		const onPointerMove = (e) => {
			if (!draggingRef.current) return;
			const dx = e.clientX - draggingRef.current.startX;
			const dy = e.clientY - draggingRef.current.startY;
			dragOffsetRef.current.x = draggingRef.current.origX + dx;
			dragOffsetRef.current.y = draggingRef.current.origY + dy;
			updateSpinePosition();
		};
		const onPointerUp = () => { draggingRef.current = null; };
		view.addEventListener("pointerdown", onPointerDown);
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		return () => {
			view.removeEventListener("pointerdown", onPointerDown);
			window.removeEventListener("pointermove", onPointerMove);
			window.removeEventListener("pointerup", onPointerUp);
		};
	}, [updateSpinePosition]);

	const onDrop = useCallback(
		(event) => {
			event.preventDefault();
			loadFiles(event.dataTransfer.files);
		},
		[loadFiles]
	);

	const onFileInputChange = useCallback(
		(event) => {
			loadFiles(event.target.files);
			event.target.value = "";
		},
		[loadFiles]
	);

	const onDragOver = useCallback((event) => {
		event.preventDefault();
	}, []);

	const drawBones = useCallback(() => {
		if (!spineInstanceRef.current || !pixiAppRef.current) return;
		if (!bonesGraphicsRef.current) {
			bonesGraphicsRef.current = new Graphics();
			pixiAppRef.current.stage.addChild(bonesGraphicsRef.current);
		}
		const g = bonesGraphicsRef.current;
		g.clear();
		const spine = spineInstanceRef.current;
		const bones = spine.skeleton.bones;
		const selected = selectedBonesRef.current;
		for (const bone of bones) {
			if (!bone.parent) continue;
			const startX = bone.parent.worldX;
			const startY = bone.parent.worldY;
			const endX = bone.worldX;
			const endY = bone.worldY;
			const wt = spine.worldTransform;
			const sx = wt.a * startX + wt.c * startY + wt.tx;
			const sy = wt.b * startX + wt.d * startY + wt.ty;
			const ex = wt.a * endX + wt.c * endY + wt.tx;
			const ey = wt.b * endX + wt.d * endY + wt.ty;
			const isSelected = selected.has(bone.data.name);
			const lineColor = isSelected ? 0xffff00 : 0x00ff00;
			const dotColor = isSelected ? 0xff6600 : 0xff0000;
			const thickness = isSelected ? 3 : 2;
			g.lineStyle(thickness, lineColor, 0.8);
			g.moveTo(sx, sy);
			g.lineTo(ex, ey);
			g.lineStyle(0);
			g.beginFill(dotColor, 0.9);
			g.drawCircle(ex, ey, isSelected ? 4 : 3);
			g.endFill();
		}
	}, []);

	useEffect(() => {
		if (!pixiAppRef.current) return;
		if (debugMode && showBones && spineInstanceRef.current) {
			const ticker = pixiAppRef.current.ticker;
			ticker.add(drawBones);
			return () => {
				ticker.remove(drawBones);
				if (bonesGraphicsRef.current) bonesGraphicsRef.current.clear();
			};
		} else {
			if (bonesGraphicsRef.current) bonesGraphicsRef.current.clear();
		}
	}, [debugMode, showBones, drawBones]);

	const drawDebugEntities = useCallback(() => {
		if (!spineInstanceRef.current || !pixiAppRef.current) return;
		if (!debugGraphicsRef.current) {
			debugGraphicsRef.current = new Graphics();
			pixiAppRef.current.stage.addChild(debugGraphicsRef.current);
		}
		const g = debugGraphicsRef.current;
		g.clear();
		const spine = spineInstanceRef.current;
		const wt = spine.worldTransform;
		const sel = selectedDebugEntitiesRef.current;
		const px = (x, y) => wt.a * x + wt.c * y + wt.tx;
		const py = (x, y) => wt.b * x + wt.d * y + wt.ty;

		for (const slot of spine.skeleton.slots) {
			if (!slot.bone.active) continue;
			const att = slot.getAttachment();
			if (!att) continue;
			const key = `${slot.data.name}/${att.name}`;

			if (att.type === 0) {
				const slotIdx = slot.data.index;
				const container = spine.slotContainers[slotIdx];
				if (sel.regionAttachments.has(key)) {
					if (container && !regionFiltersRef.current.has(key)) {
						const cm = new filters.ColorMatrixFilter();
						cm.brightness(2, false);
						cm.desaturate();
						container.filters = [cm];
						regionFiltersRef.current.set(key, { container, filter: cm });
					}
				} else {
					if (regionFiltersRef.current.has(key)) {
						const entry = regionFiltersRef.current.get(key);
						entry.container.filters = [];
						regionFiltersRef.current.delete(key);
					}
				}
			}

			if (att.type === 1 && sel.boundingBoxes.has(key)) {
				const v = new Float32Array(att.worldVerticesLength);
				att.computeWorldVertices(slot, 0, att.worldVerticesLength, v, 0, 2);
				g.lineStyle(2, 0xffff00, 0.8);
				g.moveTo(px(v[0], v[1]), py(v[0], v[1]));
				for (let i = 2; i < v.length; i += 2) g.lineTo(px(v[i], v[i + 1]), py(v[i], v[i + 1]));
				g.lineTo(px(v[0], v[1]), py(v[0], v[1]));
			}

			if (att.type === 2 && sel.meshes.has(key)) {
				const v = new Float32Array(att.worldVerticesLength);
				att.computeWorldVertices(slot, 0, att.worldVerticesLength, v, 0, 2);
				const tris = att.triangles;
				if (tris) {
					g.lineStyle(1, 0xffaa00, 0.4);
					for (let i = 0; i < tris.length; i += 3) {
						const a = tris[i] * 2, b = tris[i + 1] * 2, c = tris[i + 2] * 2;
						g.moveTo(px(v[a], v[a + 1]), py(v[a], v[a + 1]));
						g.lineTo(px(v[b], v[b + 1]), py(v[b], v[b + 1]));
						g.lineTo(px(v[c], v[c + 1]), py(v[c], v[c + 1]));
						g.lineTo(px(v[a], v[a + 1]), py(v[a], v[a + 1]));
					}
				}
				let hull = att.hullLength;
				if (hull > 0) {
					hull = (hull >> 1) * 2;
					g.lineStyle(2, 0x00ffff, 0.8);
					g.moveTo(px(v[hull - 2], v[hull - 1]), py(v[hull - 2], v[hull - 1]));
					for (let i = 0; i < hull; i += 2) g.lineTo(px(v[i], v[i + 1]), py(v[i], v[i + 1]));
				}
			}

			if (att.type === 4 && sel.paths.has(key)) {
				const v = new Float32Array(att.worldVerticesLength);
				att.computeWorldVertices(slot, 0, att.worldVerticesLength, v, 0, 2);
				g.lineStyle(2, 0xff0000, 0.8);
				let cx = v[2], cy = v[3];
				if (att.closed) {
					g.moveTo(px(cx, cy), py(cx, cy));
					g.bezierCurveTo(px(v[0], v[1]), py(v[0], v[1]),
						px(v[v.length - 2], v[v.length - 1]), py(v[v.length - 2], v[v.length - 1]),
						px(v[v.length - 4], v[v.length - 3]), py(v[v.length - 4], v[v.length - 3]));
				}
				for (let i = 4; i < v.length - 4; i += 6) {
					g.moveTo(px(cx, cy), py(cx, cy));
					g.bezierCurveTo(px(v[i], v[i + 1]), py(v[i], v[i + 1]),
						px(v[i + 2], v[i + 3]), py(v[i + 2], v[i + 3]),
						px(v[i + 4], v[i + 5]), py(v[i + 4], v[i + 5]));
					cx = v[i + 4]; cy = v[i + 5];
				}
			}

			if (att.type === 6 && sel.clipping.has(key)) {
				const v = new Float32Array(att.worldVerticesLength);
				att.computeWorldVertices(slot, 0, att.worldVerticesLength, v, 0, 2);
				g.lineStyle(2, 0xff00ff, 0.8);
				g.moveTo(px(v[0], v[1]), py(v[0], v[1]));
				for (let i = 2; i < v.length; i += 2) g.lineTo(px(v[i], v[i + 1]), py(v[i], v[i + 1]));
				g.lineTo(px(v[0], v[1]), py(v[0], v[1]));
			}
		}
	}, []);

	const clearRegionFilters = useCallback(() => {
		for (const [, entry] of regionFiltersRef.current) {
			entry.container.filters = [];
		}
		regionFiltersRef.current.clear();
	}, []);

	useEffect(() => {
		if (!pixiAppRef.current || !debugMode) {
			if (debugGraphicsRef.current) debugGraphicsRef.current.clear();
			clearRegionFilters();
			return;
		}
		const sel = selectedDebugEntitiesRef.current;
		const hasAny = sel.regionAttachments.size > 0 || sel.meshes.size > 0 ||
			sel.paths.size > 0 || sel.boundingBoxes.size > 0 || sel.clipping.size > 0;
		if (hasAny && spineInstanceRef.current) {
			const ticker = pixiAppRef.current.ticker;
			ticker.add(drawDebugEntities);
			return () => {
				ticker.remove(drawDebugEntities);
				if (debugGraphicsRef.current) debugGraphicsRef.current.clear();
				clearRegionFilters();
			};
		} else {
			if (debugGraphicsRef.current) debugGraphicsRef.current.clear();
			clearRegionFilters();
		}
	}, [debugMode, selectedDebugEntities, drawDebugEntities, clearRegionFilters]);

	const toggleDebugEntity = (type, name) => {
		setSelectedDebugEntities((prev) => {
			const next = { ...prev, [type]: new Set(prev[type]) };
			if (next[type].has(name)) next[type].delete(name);
			else next[type].add(name);
			selectedDebugEntitiesRef.current = next;
			return next;
		});
	};

	const createSpineAnimation = (jsonData, atlasText, fileURLs) => {
		if (!pixiAppRef.current) return;
		const modifiedAtlasText = modifyAtlasText(atlasText, fileURLs);
		function getTextureForLine(line, fileURLs) {
			if (fileURLs[line]) return BaseTexture.from(fileURLs[line]);
			const lowerLine = line.toLowerCase();
			for (const key in fileURLs) {
				if (key.toLowerCase() === lowerLine) return BaseTexture.from(fileURLs[key]);
			}
			return null;
		}
		try {
			const spineAtlas = new TextureAtlas(modifiedAtlasText, (line, callback) => {
				const texture = getTextureForLine(line, fileURLs);
				if (texture) callback(texture);
				else {
					console.error("Texture not found for line:", line);
					callback(null);
				}
			});
			const atlasLoader = new AtlasAttachmentLoader(spineAtlas);
			const skeletonJson = new SkeletonJson(atlasLoader);
			const skeletonData = skeletonJson.readSkeletonData(jsonData);
			const skins = skeletonData.skins.map((skin) => skin.name);
			setAvailableSkins(skins);
			setSelectedSkin(skins[0] || "");
			const spineAnimation = new Spine(skeletonData);
			spineAnimation.skeleton.updateWorldTransform();
			const bounds = spineAnimation.getLocalBounds();
			spineAnimation.pivot.set(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
			spineAnimation.x = pixiAppRef.current.screen.width / 2;
			spineAnimation.y = pixiAppRef.current.screen.height / 2;
			spineAnimation.scale.set(scaleValue);
			spineInstanceRef.current = spineAnimation;
			pixiAppRef.current.stage.addChild(spineAnimation);
			if (skeletonData.animations.length > 0) {
				const animName = skeletonData.animations[0].name;
				spineAnimation.state.setAnimation(0, animName, true);
				setAnimationPlaying(true);
				setAvailableAnimations(skeletonData.animations.map((anim) => anim.name));
				setSelectedAnimation(animName);
				spineAnimation.state.timeScale = speedValue;
				const dur = skeletonData.findAnimation(animName)?.duration || 0;
				setAnimDuration(dur);
				setTrimStart(0);
				setTrimEnd(dur);
				trimStartRef.current = 0;
				trimEndRef.current = dur;
				setTrimEnabled(false);
				trimEnabledRef.current = false;
			}
			const names = skeletonData.bones.map((b) => b.name);
			setBoneNames(names);
			const entities = { regionAttachments: [], meshes: [], paths: [], boundingBoxes: [], clipping: [] };
			const seen = new Set();
			for (const skin of skeletonData.skins) {
				if (skin.attachments) {
					for (let si = 0; si < skin.attachments.length; si++) {
						const slotAtts = skin.attachments[si];
						if (!slotAtts) continue;
						const slotName = skeletonData.slots[si] ? skeletonData.slots[si].name : `slot_${si}`;
						for (const attName in slotAtts) {
							const att = slotAtts[attName];
							const key = `${slotName}/${attName}`;
							if (seen.has(key)) continue;
							seen.add(key);
							if (att.type === 0) entities.regionAttachments.push(key);
							else if (att.type === 1) entities.boundingBoxes.push(key);
							else if (att.type === 2) entities.meshes.push(key);
							else if (att.type === 4) entities.paths.push(key);
							else if (att.type === 6) entities.clipping.push(key);
						}
					}
				}
			}
			setDebugEntities(entities);
			spineAnimation.state.addListener({
				complete: () => {
					const queue = animationQueueRef.current;
					if (queue.length === 0) return;
					const nextIdx = queueIndexRef.current + 1;
					if (nextIdx < queue.length) {
						queueIndexRef.current = nextIdx;
						setQueueIndex(nextIdx);
						setSelectedAnimation(queue[nextIdx]);
						const isLast = nextIdx === queue.length - 1;
						spineAnimation.state.setAnimation(0, queue[nextIdx], isLast && !queueLoopRef.current);
					} else if (queueLoopRef.current) {
						queueIndexRef.current = 0;
						setQueueIndex(0);
						setSelectedAnimation(queue[0]);
						spineAnimation.state.setAnimation(0, queue[0], false);
					} else {
						queueIndexRef.current = -1;
						setQueueIndex(-1);
					}
				}
			});
			setSpineLoaded(true);
			updateSpinePosition();
		} catch (err) {
			console.error("Error creating Spine animation:", err);
			setErrorMsg("Error creating Spine animation: " + err.message);
		}
	};

	const handleSkinSelect = (e) => {
		const skinName = e.target.value;
		setSelectedSkin(skinName);
		if (spineInstanceRef.current) {
			const skeleton = spineInstanceRef.current.skeleton;
			const skin = skeleton.data.skins.find((s) => s.name === skinName);
			if (skin) {
				skeleton.setSkin(skin);
				skeleton.setSlotsToSetupPose();
				updateSpinePosition();
			} else {
				console.warn(`Skin "${skinName}" not found.`);
			}
		}
	};

	const toggleAnimation = () => {
		if (!spineInstanceRef.current) return;
		const state = spineInstanceRef.current.state;
		if (animationPlaying) {
			state.timeScale = 0;
			setAnimationPlaying(false);
		} else {
			state.timeScale = speedValue;
			setAnimationPlaying(true);
		}
	};

	const handleAnimationSelect = (e) => {
		const animName = e.target.value;
		setSelectedAnimation(animName);
		queueIndexRef.current = -1;
		setQueueIndex(-1);
		if (spineInstanceRef.current) {
			const loop = animationQueueRef.current.length === 0;
			spineInstanceRef.current.state.setAnimation(0, animName, loop);
			spineInstanceRef.current.state.timeScale = speedValue;
			updateSpinePosition();
			setAnimationPlaying(true);
			const dur = spineInstanceRef.current.skeleton.data.findAnimation(animName)?.duration || 0;
			setAnimDuration(dur);
			setTrimStart(0);
			setTrimEnd(dur);
			trimStartRef.current = 0;
			trimEndRef.current = dur;
			setTrimEnabled(false);
			trimEnabledRef.current = false;
		}
	};

	const addToQueue = (animName) => {
		const newQueue = [...animationQueueRef.current, animName];
		animationQueueRef.current = newQueue;
		setAnimationQueue(newQueue);
		if (spineInstanceRef.current) {
			const current = spineInstanceRef.current.state.getCurrent(0);
			if (current) current.loop = false;
		}
	};

	const removeFromQueue = (index) => {
		const newQueue = animationQueueRef.current.filter((_, i) => i !== index);
		animationQueueRef.current = newQueue;
		setAnimationQueue(newQueue);
		let newIdx = queueIndexRef.current;
		if (index < newIdx) newIdx--;
		else if (index === newIdx && newIdx >= newQueue.length) newIdx = newQueue.length - 1;
		if (newQueue.length === 0) {
			queueIndexRef.current = -1;
			setQueueIndex(-1);
			if (spineInstanceRef.current) {
				spineInstanceRef.current.state.setAnimation(0, selectedAnimation, true);
			}
		} else {
			queueIndexRef.current = newIdx;
			setQueueIndex(newIdx);
		}
	};

	const clearQueue = () => {
		animationQueueRef.current = [];
		setAnimationQueue([]);
		queueIndexRef.current = -1;
		setQueueIndex(-1);
		if (spineInstanceRef.current) {
			spineInstanceRef.current.state.setAnimation(0, selectedAnimation, true);
		}
	};

	const toggleQueueLoop = () => {
		const next = !queueLoopRef.current;
		queueLoopRef.current = next;
		setQueueLoop(next);
	};

	const handleScrub = (time) => {
		if (!spineInstanceRef.current) return;
		const track = spineInstanceRef.current.state.getCurrent(0);
		if (!track) return;
		const clamped = Math.max(0, Math.min(time, animDuration));
		track.trackTime = clamped;
		setAnimTime(clamped);
	};

	const handleTrimStartChange = (val) => {
		const v = Math.max(0, Math.min(val, trimEnd));
		setTrimStart(v);
		trimStartRef.current = v;
	};

	const handleTrimEndChange = (val) => {
		const v = Math.max(trimStart, Math.min(val, animDuration));
		setTrimEnd(v);
		trimEndRef.current = v;
	};

	const handleTrimToggle = () => {
		const next = !trimEnabledRef.current;
		trimEnabledRef.current = next;
		setTrimEnabled(next);
	};

	const handleSlotVisibilityChange = (slotName, visible) => {
		if (attachedCirclesRef.current[slotName]) {
			attachedCirclesRef.current[slotName].visible = visible;
		}
	};

	const addCircleToSlot = (slotName) => {
		if (!spineInstanceRef.current) return;
		if (attachedCirclesRef.current[slotName]) return;
		const circle = new Graphics();
		const circleRadius = 200;
		circle.beginFill(0xFBF8FF);
		circle.drawCircle(0, 0, circleRadius);
		circle.endFill();
		circle.scale.set(circleScaleValue);
		const fontSize = circleRadius * 2 * 0.2;
		const text = new Text(slotName, {
			fontFamily: "Arial",
			fontSize: fontSize,
			fill: "#ea8510",
			align: "center",
			wordWrap: true,
			wordWrapWidth: circleRadius * 2
		});
		text.anchor.set(0.5);
		circle.addChild(text);
		for (const sName in attachedCirclesRef.current) {
			const c = attachedCirclesRef.current[sName];
			const slot = spineInstanceRef.current.skeleton.findSlot(sName);
			spineInstanceRef.current.slotContainers[slot.data.index].addChild(c);
		}
		attachedCirclesRef.current[slotName] = circle;
		setAttachedSlots((prev) => (prev.includes(slotName) ? prev : [...prev, slotName]));
	};

	const removeCircleFromSlot = (slotName) => {
		if (!spineInstanceRef.current) return;
		const circle = attachedCirclesRef.current[slotName];
		if (circle) {
			spineInstanceRef.current.removeChild(circle);
			circle.destroy();
			delete attachedCirclesRef.current[slotName];
			setAttachedSlots((prev) => prev.filter((name) => name !== slotName));
		}
	};

	const toggleBoneSelection = (boneName) => {
		setSelectedBones((prev) => {
			const next = new Set(prev);
			if (next.has(boneName)) next.delete(boneName);
			else next.add(boneName);
			selectedBonesRef.current = next;
			return next;
		});
	};

	const allSlots = spineInstanceRef.current
		? spineInstanceRef.current.skeleton.slots.map((slot) => slot.data.name)
		: [];
	const filteredSlots = allSlots.filter((slot) =>
		slot.toLowerCase().includes(slotFilter.toLowerCase())
	);
	const unAttachedSlots = filteredSlots.filter((slot) => !attachedSlots.includes(slot));

	const filteredBones = boneNames.filter((name) =>
		name.toLowerCase().includes(boneFilter.toLowerCase())
	);

	const entityHighlightColors = {
		regionAttachments: { color: "#00ff00", bg: "rgba(0,255,0,0.15)" },
		meshes: { color: "#00ffff", bg: "rgba(0,255,255,0.15)" },
		paths: { color: "#ff0000", bg: "rgba(255,0,0,0.15)" },
		boundingBoxes: { color: "#ffff00", bg: "rgba(255,255,0,0.15)" },
		clipping: { color: "#ff00ff", bg: "rgba(255,0,255,0.15)" }
	};
	const entityHighlight = entityHighlightColors[debugEntityType] || { color: "#ffffff", bg: "rgba(255,255,255,0.15)" };
	const filteredDebugList = (debugEntities[debugEntityType] || []).filter((name) =>
		name.toLowerCase().includes(debugFilter.toLowerCase())
	);

	const playPauseButtonStyle = {
		...styles.fullWidthButton,
		backgroundColor: animationPlaying ? styles.pauseButtonColor : styles.playButtonColor
	};

	return (
		<div style={styles.wrapper}>
			<input
				ref={fileInputRef}
				type="file"
				multiple
				accept=".json,.atlas,.png,.jpg,.jpeg"
				style={{ display: "none" }}
				onChange={onFileInputChange}
			/>
			<header style={styles.header}>
				<div style={styles.headerLeft}>Pixi Spine Viewer Tool</div>
				<div style={styles.headerRight}>
					<span style={styles.currentThemeText}>{theme === "dark" ? "Dark" : "Light"}</span>
					<ThemeToggle theme={theme} toggleTheme={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))} />
				</div>
			</header>
			<div style={styles.mainContent}>
				{debugMode && spineLoaded && (
					<div style={styles.debugPanel}>
						<select style={styles.animationsSelect} value={debugEntityType} onChange={(e) => { setDebugEntityType(e.target.value); setDebugFilter(""); }}>
							<option value="bones">Bones ({boneNames.length})</option>
							<option value="slots">Slots ({allSlots.length})</option>
							<option value="regionAttachments">Regions ({debugEntities.regionAttachments.length})</option>
							<option value="meshes">Meshes ({debugEntities.meshes.length})</option>
							<option value="paths">Paths ({debugEntities.paths.length})</option>
							<option value="boundingBoxes">Bounding Boxes ({debugEntities.boundingBoxes.length})</option>
							<option value="clipping">Clipping ({debugEntities.clipping.length})</option>
						</select>
						{debugEntityType === "bones" && (
							<>
								<label style={{ ...styles.bonesCheckboxLabel, marginBottom: "4px" }}>
									<input type="checkbox" checked={showBones} onChange={(e) => setShowBones(e.target.checked)} />
									Show bones
								</label>
								<input type="text" placeholder="Filter bones..." value={boneFilter} onChange={(e) => setBoneFilter(e.target.value)} style={styles.animationsSelect} />
								<div style={styles.bonesList}>
									{filteredBones.map((name) => (
										<div
											key={name}
											style={{
												...styles.boneItem,
												backgroundColor: selectedBones.has(name) ? "rgba(255,255,0,0.15)" : "transparent",
												borderLeft: selectedBones.has(name) ? "3px solid #ffff00" : "3px solid #00ff00"
											}}
											onClick={() => toggleBoneSelection(name)}
										>
											{name}
										</div>
									))}
								</div>
							</>
						)}
						{debugEntityType === "slots" && (
							<>
								<input type="text" placeholder="Filter slots..." value={slotFilter} onChange={(e) => setSlotFilter(e.target.value)} style={styles.animationsSelect} />
								<div style={styles.debugSlotScaleRow}>
									<label style={styles.sliderLabel}>Circle Scale: {circleScaleValue.toFixed(2)}</label>
									<input type="range" min="0.01" max="2" step="0.01" value={circleScaleValue} onChange={handleCircleScaleChange} style={styles.input} />
								</div>
								{attachedSlots.length > 0 && (
									<div style={styles.debugAttachedSlots}>
										{attachedSlots.map((slotName, idx) => (
											<div key={idx} style={styles.attachedSlotItem}>
												<span>{slotName}</span>
												<div style={styles.attachedSlotControls}>
													<input type="checkbox" defaultChecked={true} onChange={(e) => handleSlotVisibilityChange(slotName, e.target.checked)} />
													<button style={styles.deleteButton} onClick={() => removeCircleFromSlot(slotName)}>✕</button>
												</div>
											</div>
										))}
									</div>
								)}
								<div style={styles.bonesList}>
									{unAttachedSlots.map((slotName, idx) => (
										<div key={idx} style={styles.slotItem}>
											<span>{slotName}</span>
											<button style={styles.unattachedButton} onClick={() => addCircleToSlot(slotName)}>+</button>
										</div>
									))}
								</div>
							</>
						)}
						{["regionAttachments", "meshes", "paths", "boundingBoxes", "clipping"].includes(debugEntityType) && (
							<>
								<div style={{ display: "flex", gap: "4px", marginBottom: "4px" }}>
									<button style={styles.queueClearButton} onClick={() => {
										const all = debugEntities[debugEntityType] || [];
										const allSet = new Set(all);
										setSelectedDebugEntities((prev) => {
											const next = { ...prev, [debugEntityType]: allSet };
											selectedDebugEntitiesRef.current = next;
											return next;
										});
									}}>All</button>
									<button style={styles.queueClearButton} onClick={() => {
										setSelectedDebugEntities((prev) => {
											const next = { ...prev, [debugEntityType]: new Set() };
											selectedDebugEntitiesRef.current = next;
											return next;
										});
									}}>None</button>
								</div>
								<input type="text" placeholder="Filter..." value={debugFilter} onChange={(e) => setDebugFilter(e.target.value)} style={styles.animationsSelect} />
								<div style={styles.bonesList}>
									{filteredDebugList.map((name) => {
										const isSelected = selectedDebugEntities[debugEntityType]?.has(name);
										return (
											<div key={name} style={{
												...styles.boneItem,
												backgroundColor: isSelected ? entityHighlight.bg : "transparent",
												borderLeft: `3px solid ${isSelected ? entityHighlight.color : "transparent"}`
											}} onClick={() => toggleDebugEntity(debugEntityType, name)}>
												{name}
											</div>
										);
									})}
								</div>
							</>
						)}
					</div>
				)}
				<div style={styles.leftColumn}>
					<div style={styles.dropZone} onDrop={onDrop} onDragOver={onDragOver}>
						{!spineLoaded && (
							<div style={styles.dropOverlay}>
								<p style={styles.dropText}>
									Drag and drop Spine files here
								</p>
								<p style={{ ...styles.dropText, fontSize: "11px", marginTop: "4px" }}>or</p>
								<button style={styles.openFileButton} onClick={() => fileInputRef.current?.click()}>
									Open Files
								</button>

							</div>
						)}
						<div ref={pixiContainerRef} style={styles.pixiContainer} />
						{spineLoaded && (						<div style={styles.fpsCounter}>{fps} FPS</div>
					)}
					{spineLoaded && (							<div style={styles.canvasControls}>
								<button style={styles.canvasPauseButton} onClick={toggleAnimation} title={animationPlaying ? "Pause" : "Play"}>
									{animationPlaying ? "⏸" : "▶"}
								</button>
								<button style={styles.openFileButton} onClick={() => fileInputRef.current?.click()} title="Open Files">
									📂
								</button>

								<label style={styles.bonesCheckboxLabel}>
									<input
										type="checkbox"
										checked={debugMode}
										onChange={(e) => setDebugMode(e.target.checked)}
									/>
									Debug
								</label>
							</div>
						)}
						{errorMsg && <p style={{ zIndex: 3, position: "relative" }}>{errorMsg}</p>}
					</div>
				</div>
				<div style={styles.sidebar}>
					<div style={styles.fixedArea}>
						<h3 style={styles.sectionHeader}>Animation</h3>
						<select style={styles.animationsSelect} value={selectedAnimation} onChange={handleAnimationSelect}>
							{availableAnimations.map((animName, idx) => (
								<option key={idx} value={animName}>
									{animName}
								</option>
							))}
						</select>
						{availableAnimations.length > 0 && (
							<div style={styles.queueSection}>
								<div style={styles.queueHeader}>
									<span style={styles.sliderLabel}>Queue</span>
								<div style={{ display: 'flex', gap: `${4}px` }}>
									<button style={{ ...styles.queueClearButton, color: queueLoop ? '#4caf50' : styles.queueClearButton.color }} onClick={toggleQueueLoop} title="Loop queue">⟳</button>
									{animationQueue.length > 0 && (
										<button style={styles.queueClearButton} onClick={clearQueue}>Clear</button>
									)}
								</div>
								</div>
								{animationQueue.length > 0 && (
									<div style={styles.queueList}>
										{animationQueue.map((animName, idx) => (
											<div key={idx} style={{
												...styles.queueItem,
												backgroundColor: idx === queueIndex ? "rgba(76,175,80,0.2)" : "transparent",
												borderLeft: idx === queueIndex ? "3px solid #4caf50" : "3px solid transparent",
												paddingLeft: "4px"
											}}>
												<span style={styles.queueItemIndex}>{idx + 1}.</span>
												<span style={styles.queueItemName}>{animName}</span>
												<button style={styles.queueRemoveButton} onClick={() => removeFromQueue(idx)}>×</button>
											</div>
										))}
									</div>
								)}
								<select style={styles.animationsSelect} defaultValue="" onChange={(e) => { if (e.target.value) { addToQueue(e.target.value); e.target.value = ""; } }}>
									<option value="" disabled>+ Add to queue...</option>
									{availableAnimations.map((animName, idx) => (
										<option key={idx} value={animName}>{animName}</option>
									))}
								</select>
							</div>
						)}
						{availableSkins.length > 1 && (
							<>
								<h3 style={{ ...styles.sectionHeader, marginTop: `${8}px` }}>Skin</h3>
								<select style={styles.animationsSelect} value={selectedSkin} onChange={handleSkinSelect}>
									{availableSkins.map((skinName, idx) => (
										<option key={idx} value={skinName}>
											{skinName}
										</option>
									))}
								</select>
							</>
						)}
						<div style={styles.scaleControl}>
							<label style={styles.sliderLabel}>Spine Scale: {scaleValue.toFixed(2)}</label>
							<input type="range" min="0.1" max="2" step="0.01" value={scaleValue} onChange={handleScaleChange} style={styles.input} />
						</div>
						<div style={styles.scaleControl}>
							<label style={styles.sliderLabel}>Speed: {speedValue.toFixed(2)}</label>
							<input type="range" min="0.1" max="2" step="0.01" value={speedValue} onChange={handleSpeedChange} style={styles.input} />
						</div>
						{animDuration > 0 && (
							<div style={styles.timelineSection}>
								<div style={styles.timelineHeader}>
									<span style={styles.sliderLabel}>Timeline</span>
									<span style={styles.timelineTimeLabel}>
										{animTime.toFixed(2)}s / {animDuration.toFixed(2)}s
									</span>
								</div>
								<div
									style={styles.timelineTrack}
									onMouseDown={(e) => {
										const rect = e.currentTarget.getBoundingClientRect();
										const scrub = (evt) => {
											const x = Math.max(0, Math.min(evt.clientX - rect.left, rect.width));
											handleScrub((x / rect.width) * animDuration);
										};
										scrub(e);
										const onMove = (evt) => scrub(evt);
										const onUp = () => {
											window.removeEventListener("mousemove", onMove);
											window.removeEventListener("mouseup", onUp);
										};
										window.addEventListener("mousemove", onMove);
										window.addEventListener("mouseup", onUp);
									}}
								>
									{trimEnabled && (
										<div style={{
											...styles.timelineTrimRegion,
											left: `${(trimStart / animDuration) * 100}%`,
											width: `${((trimEnd - trimStart) / animDuration) * 100}%`
										}} />
									)}
									<div style={{
										...styles.timelinePlayhead,
										left: `${(animTime / animDuration) * 100}%`
									}} />
								</div>
								<div style={styles.trimControls}>
									<label style={styles.trimCheckboxLabel}>
										<input
											type="checkbox"
											checked={trimEnabled}
											onChange={handleTrimToggle}
										/>
										Trim
									</label>
									{trimEnabled && (
										<div style={styles.trimInputs}>
											<div style={styles.trimInputGroup}>
												<span style={styles.trimLabel}>Start</span>
												<input
													type="range"
													min={0}
													max={animDuration}
													step={0.01}
													value={trimStart}
													onChange={(e) => handleTrimStartChange(parseFloat(e.target.value))}
													style={styles.trimSlider}
												/>
												<span style={styles.trimValue}>{trimStart.toFixed(2)}s</span>
											</div>
											<div style={styles.trimInputGroup}>
												<span style={styles.trimLabel}>End</span>
												<input
													type="range"
													min={0}
													max={animDuration}
													step={0.01}
													value={trimEnd}
													onChange={(e) => handleTrimEndChange(parseFloat(e.target.value))}
													style={styles.trimSlider}
												/>
												<span style={styles.trimValue}>{trimEnd.toFixed(2)}s</span>
											</div>
										</div>
									)}
								</div>
							</div>
						)}
						<button style={playPauseButtonStyle} onClick={toggleAnimation}>
							{animationPlaying ? "Pause" : "Play"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

export default App;