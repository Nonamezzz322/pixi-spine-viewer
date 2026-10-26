import latin400 from "@fontsource/source-sans-3/files/source-sans-3-latin-400-normal.woff2";
import latin700 from "@fontsource/source-sans-3/files/source-sans-3-latin-700-normal.woff2";
import latinExt400 from "@fontsource/source-sans-3/files/source-sans-3-latin-ext-400-normal.woff2";
import latinExt700 from "@fontsource/source-sans-3/files/source-sans-3-latin-ext-700-normal.woff2";
import cyrillic400 from "@fontsource/source-sans-3/files/source-sans-3-cyrillic-400-normal.woff2";
import cyrillic700 from "@fontsource/source-sans-3/files/source-sans-3-cyrillic-700-normal.woff2";

// base-slot styles use the family "MyriadPro" (fonts.scss). Myriad Pro is a paid Adobe font, so here that family is
// drawn with the free Source Sans 3: of the free fonts it is the closest to Myriad and keeps text widths within ~1.5%,
// and exported styles still work in the game as they are
const SUBSETS = [
	{ files: { 400: latin400, 700: latin700 }, range: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
	{ files: { 400: latinExt400, 700: latinExt700 }, range: "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C4,U+2113,U+2C60-2C7F,U+A720-A7FF" },
	{ files: { 400: cyrillic400, 700: cyrillic700 }, range: "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116" }
];

export const textFontsReady = Promise.all(SUBSETS.flatMap(({ files, range }) => Object.entries(files).map(([weight, url]) => {
	const face = new FontFace("MyriadPro", `url(${url})`, { weight, unicodeRange: range });
	document.fonts.add(face);
	return face.load();
})));
