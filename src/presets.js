import { Assets } from "pixi.js";
import { upgradeConfig } from "@pixi/particle-emitter";

// coin rain presets of base-slot (packages/base-slot/src/features/coin-emitter), landscape values
const BASE_COIN_CONFIG = {
	alpha: { start: 1, end: 1 },
	scale: { start: 0.5, end: 2.5, minimumScaleMultiplier: 1 },
	color: { start: "#ffffff", end: "#ffffff" },
	speed: { start: 3500, end: 0, minimumSpeedMultiplier: 0.8 },
	startRotation: { min: 250, max: 290 },
	rotationSpeed: { min: 100, max: 360 },
	lifetime: { min: 2, max: 3 },
	pos: { x: 0, y: 200 },
	noRotation: false,
	maxSpeed: 0,
	blendMode: "normal",
	emitterLifetime: -1,
	maxParticles: 1500,
	addAtBack: false,
	spawnType: "point"
};

export const EMITTER_PRESETS = [
	{ name: "Coins low", config: { ...BASE_COIN_CONFIG, acceleration: { x: 0, y: 5000 }, frequency: 0.005 } },
	{ name: "Coins middle", config: { ...BASE_COIN_CONFIG, acceleration: { x: 0, y: 4300 }, frequency: 0.0044 } },
	{ name: "Coins high", config: { ...BASE_COIN_CONFIG, acceleration: { x: 0, y: 4050 }, frequency: 0.026 } },
	{ name: "Coins highest", config: { ...BASE_COIN_CONFIG, acceleration: { x: 0, y: 3800 }, frequency: 0.0024 } }
];

// the game takes frames coin_0000 … coin_0029 of the coin sheet, one random frame per particle
export const COIN_FRAMES = Array.from({ length: 30 }, (_, i) => `coin_${String(i).padStart(4, "0")}`);

let coinSheet = null;

// the sheet puts its frames into the texture cache by name, so configs can refer to COIN_FRAMES
export const loadCoinFrames = () => {
	coinSheet ||= Assets.load(`${import.meta.env.BASE_URL}presets/coin/coin_1080p.json`).catch((err) => {
		coinSheet = null;
		throw err;
	});
	return coinSheet;
};

export const createPresetConfig = (preset) => upgradeConfig(preset.config, COIN_FRAMES);
