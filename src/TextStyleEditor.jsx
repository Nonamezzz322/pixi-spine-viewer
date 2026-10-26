import React from "react";
import { Color, TextStyle } from "pixi.js";
import { Field, JsonBox, NumberInput } from "./fields";

const DEFAULTS = TextStyle.defaultStyle;

// the family and weights of the game's fonts.scss, so an exported style works there as it is (see fonts.js)
export const TEXT_STYLE_PRESETS = [
	{ name: "Myriad Pro Regular", style: { fontFamily: "MyriadPro", fontWeight: "normal" } },
	{ name: "Myriad Pro Bold", style: { fontFamily: "MyriadPro", fontWeight: "bold" } }
];

const FONT_FAMILIES = ["MyriadPro", "Arial", "Verdana", "Tahoma", "Georgia", "Times New Roman", "Courier New", "Impact"];
const FONT_WEIGHTS = ["normal", "bold", "100", "200", "300", "400", "500", "600", "700", "800", "900"];

// only the values that differ from pixi defaults: the shape of a game textStyle config
export const compactStyle = (style) => Object.fromEntries(
	Object.entries(style).filter(([key, value]) => key in DEFAULTS && JSON.stringify(value) !== JSON.stringify(DEFAULTS[key]))
);

const toHex = (value) => {
	try {
		return new Color(value).toHex();
	} catch {
		return "#000000";
	}
};

export default function TextStyleEditor({ style, onChange, onError, styles }) {
	const value = (key) => style[key] ?? DEFAULTS[key];
	const set = (changes) => onChange(compactStyle({ ...style, ...changes }));
	const number = (key, step = 1) => <NumberInput value={value(key)} onChange={(v) => set({ [key]: v })} step={step} style={styles.fieldInput} />;
	const select = (key, options) => (
		<select style={styles.fieldInput} value={String(value(key))} onChange={(e) => set({ [key]: e.target.value })}>
			{options.map((option) => <option key={option} value={option}>{option}</option>)}
		</select>
	);
	const color = (key) => <input type="color" style={styles.fieldInput} value={toHex(value(key))} onChange={(e) => set({ [key]: e.target.value })} />;
	const check = (key, label) => (
		<label style={styles.trimCheckboxLabel}>
			<input type="checkbox" checked={!!value(key)} onChange={(e) => set({ [key]: e.target.checked })} />
			{label}
		</label>
	);

	const fills = [].concat(value("fill")).map(toHex);
	const stops = fills.map((_, i) => value("fillGradientStops")[i] ?? i / Math.max(1, fills.length - 1));
	const setFills = (next) => set({ fill: next.length === 1 ? next[0] : next, fillGradientStops: next.length > 1 ? stops.slice(0, next.length) : [] });

	const applyJson = (text) => {
		try {
			const parsed = JSON.parse(text);
			// a whole game text config ({ style: {...}, position… }) works too
			onChange(compactStyle(parsed.style && typeof parsed.style === "object" ? parsed.style : parsed));
		} catch (err) {
			onError("Style JSON error: " + err.message);
		}
	};

	return (
		<>
			<div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "6px" }}>
				{TEXT_STYLE_PRESETS.map((preset) => (
					<button key={preset.name} style={styles.queueClearButton} onClick={() => set(preset.style)}>{preset.name}</button>
				))}
			</div>
			<div style={{ ...styles.fieldRow, opacity: 0.7 }}>MyriadPro is drawn with the free Source Sans 3 here; the game draws it with Myriad Pro</div>
			<div style={styles.trackItem}>
				<div style={styles.trackLabel}>Font</div>
				<Field label="Family" styles={styles}>
					<input style={styles.fieldInput} list="text-font-families" value={value("fontFamily")} onChange={(e) => set({ fontFamily: e.target.value })} />
				</Field>
				<datalist id="text-font-families">
					{FONT_FAMILIES.map((family) => <option key={family} value={family} />)}
				</datalist>
				<Field label="Weight" styles={styles}>{select("fontWeight", FONT_WEIGHTS)}</Field>
				<Field label="Style" styles={styles}>{select("fontStyle", ["normal", "italic", "oblique"])}</Field>
				<Field label="Variant" styles={styles}>{select("fontVariant", ["normal", "small-caps"])}</Field>
				<Field label="Size" styles={styles}>{number("fontSize")}</Field>
			</div>
			<div style={styles.trackItem}>
				<div style={styles.trackLabel}>{fills.length > 1 ? "Fill gradient (color, stop)" : "Fill"}</div>
				{fills.map((fill, i) => (
					<div key={i} style={styles.fieldRow}>
						<input type="color" style={styles.fieldInput} value={fill} onChange={(e) => setFills(fills.map((item, j) => (j === i ? e.target.value : item)))} />
						{fills.length > 1 && (
							<>
								<NumberInput value={stops[i]} step={0.05} style={{ ...styles.fieldInput, flex: "0 0 60px" }} onChange={(v) => set({ fillGradientStops: stops.map((item, j) => (j === i ? v : item)) })} />
								<button style={styles.queueRemoveButton} onClick={() => setFills(fills.filter((_, j) => j !== i))} title="Remove color">×</button>
							</>
						)}
					</div>
				))}
				<button style={styles.queueClearButton} onClick={() => setFills([...fills, fills[fills.length - 1]])}>+ Color (gradient)</button>
				{fills.length > 1 && (
					<Field label="Direction" styles={styles}>
						<select style={styles.fieldInput} value={value("fillGradientType")} onChange={(e) => set({ fillGradientType: Number(e.target.value) })}>
							<option value={0}>Vertical</option>
							<option value={1}>Horizontal</option>
						</select>
					</Field>
				)}
			</div>
			<div style={styles.trackItem}>
				<div style={styles.trackLabel}>Stroke</div>
				<Field label="Color" styles={styles}>{color("stroke")}</Field>
				<Field label="Thickness" styles={styles}>{number("strokeThickness")}</Field>
				<Field label="Line join" styles={styles}>{select("lineJoin", ["miter", "round", "bevel"])}</Field>
				<Field label="Miter limit" styles={styles}>{number("miterLimit")}</Field>
			</div>
			<div style={styles.trackItem}>
				{check("dropShadow", <b>Shadow</b>)}
				{value("dropShadow") && (
					<>
						<Field label="Color" styles={styles}>{color("dropShadowColor")}</Field>
						<Field label="Alpha" styles={styles}>{number("dropShadowAlpha", 0.05)}</Field>
						<Field label="Angle, rad" styles={styles}>{number("dropShadowAngle", 0.1)}</Field>
						<Field label="Blur" styles={styles}>{number("dropShadowBlur")}</Field>
						<Field label="Distance" styles={styles}>{number("dropShadowDistance")}</Field>
					</>
				)}
			</div>
			<div style={styles.trackItem}>
				<div style={styles.trackLabel}>Layout</div>
				<Field label="Align" styles={styles}>{select("align", ["left", "center", "right", "justify"])}</Field>
				<Field label="Letter spacing" styles={styles}>{number("letterSpacing")}</Field>
				<Field label="Line height" styles={styles}>{number("lineHeight")}</Field>
				<Field label="Leading" styles={styles}>{number("leading")}</Field>
				<Field label="Baseline" styles={styles}>{select("textBaseline", ["alphabetic", "top", "hanging", "middle", "ideographic", "bottom"])}</Field>
				<Field label="White space" styles={styles}>{select("whiteSpace", ["normal", "pre", "pre-line"])}</Field>
				<Field label="Padding" styles={styles}>{number("padding")}</Field>
				{check("wordWrap", "Word wrap")}
				{value("wordWrap") && (
					<>
						<Field label="Wrap width" styles={styles}>{number("wordWrapWidth", 10)}</Field>
						{check("breakWords", "Break long words")}
					</>
				)}
				{check("trim", "Trim empty space")}
			</div>
			<div style={styles.trackLabel}>Style JSON (game textStyle; a whole text config works too)</div>
			<JsonBox value={JSON.stringify(style, null, 2)} onApply={applyJson} styles={styles} />
		</>
	);
}
