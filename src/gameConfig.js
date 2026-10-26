// an element as a piece of the game's TypeScript config: single quotes, 4 spaces, tint as 0x number
const quote = (value) => `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

// numbers only, like { x, y } or { landscape: { x, y }, portrait: { x, y } }: written on one line
const isFlat = (value) => typeof value === "number" || (!!value && typeof value === "object" && !Array.isArray(value) && Object.values(value).every(isFlat));

const toTs = (value, indent = "") => {
	if (typeof value === "string") return quote(value);
	if (Array.isArray(value)) return `[${value.map((item) => toTs(item, indent)).join(", ")}]`;
	if (value && typeof value === "object") {
		const entries = Object.entries(value);
		if (isFlat(value)) return `{ ${entries.map(([key, item]) => `${key}: ${toTs(item)}`).join(", ")} }`;
		const inner = indent + "    ";
		return `{\n${entries.map(([key, item]) => `${inner}${key}: ${key === "tint" ? toHex(item) : toTs(item, inner)},`).join("\n")}\n${indent}}`;
	}
	return String(value);
};

const toHex = (color) => "0x" + String(color).replace("#", "").toLowerCase();

const toLines = (config) => Object.entries(config).map(([key, value]) => `${key}: ${key === "tint" ? toHex(value) : toTs(value)},`);

// place: in a slot one position, else { landscape, portrait } like the game's views (desktop uses landscape)
export function getElementConfig(el) {
	const portrait = el.portrait || el;
	const place = el.attach
		? { spineSlotName: el.attach.slot, position: { x: el.x, y: el.y } }
		: {
			positions: { landscape: { x: el.x, y: el.y }, portrait: { x: portrait.x, y: portrait.y } },
			scale: { landscape: { x: el.scale, y: el.scale }, portrait: { x: portrait.scale, y: portrait.scale } }
		};
	const lines = [`// ${el.name}`, ...toLines(place)];
	if (el.type === "bitmap") {
		// CountupViewConfig's textStyle and countupDuration, then the bitmap-value props
		const textStyle = { align: el.align, fontName: el.fontName, fontSize: el.fontSize, letterSpacing: el.letterSpacing, tint: el.tint };
		if (el.maxWidth > 0) textStyle.maxWidth = el.maxWidth;
		lines.push(...toLines({ textStyle, countupDuration: el.incrementTime }));
		const props = {};
		if (el.isShort) props.short = true;
		if (el.scaleToWidth > 0) props.scaleToWidth = el.scaleToWidth;
		if (el.minFitWidthPx > 0) props.minFitWidthPx = el.minFitWidthPx;
		if (Object.keys(props).length > 0) lines.push("// bitmap-value", ...toLines(props));
	}
	if (el.type === "text") lines.push(...toLines({ style: el.style }));
	return lines.join("\n");
}
