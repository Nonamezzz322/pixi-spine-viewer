// base-slot's TextUtilsService.shortValue with the bitmap-value default shortDecimals = 2
export function shortValue(value, decimals = 2) {
	const num = parseFloat(value);
	if (Number.isNaN(num)) return value;
	const sign = num < 0 ? "-" : "";
	const absValue = Math.abs(num);
	if (absValue >= 1e6) return `${sign}${(absValue / 1e6).toFixed(decimals)}m`;
	if (absValue >= 1e3) return `${sign}${(absValue / 1e3).toFixed(decimals)}k`;
	return value;
}

// what a bitmap value field keeps of the typed text: digits and the first decimal separator, "." or ","
export const toNumberText = (text) => {
	const cleaned = text.replace(/[^\d.,]/g, "");
	const index = cleaned.search(/[.,]/);
	if (index === -1) return cleaned;
	return cleaned.slice(0, index + 1) + cleaned.slice(index + 1).replace(/[.,]/g, "");
};

// what a bitmap shows: the typed number with fixed decimals (2 for cents) and its own separator,
// shortened like the game when isShort is on; decimals 0 keeps the typed decimals
export function formatBitmapValue(text, { decimals = 0, isShort = false } = {}) {
	const separator = text.includes(",") ? "," : ".";
	const plain = text.replace(",", ".");
	if (Number.isNaN(parseFloat(plain))) return text;
	const fixed = decimals > 0 ? parseFloat(plain).toFixed(decimals) : plain;
	return (isShort ? shortValue(fixed) : fixed).replace(".", separator);
}

// the steps of an increment from 0 to the typed number; every step is shown like the final value
export function createBitmapCountup(text, options) {
	const plain = text.replace(",", ".");
	const target = parseFloat(plain);
	if (Number.isNaN(target)) return null;
	const separator = text.includes(",") ? "," : ".";
	const stepDecimals = options.decimals > 0 ? options.decimals : (plain.split(".")[1] || "").length;
	return { target, format: (value) => formatBitmapValue(value.toFixed(stepDecimals).replace(".", separator), options) };
}

// the ease of base-slot's countup (countEase: 'power2.out')
export const easeCountup = (progress) => 1 - (1 - progress) ** 3;
