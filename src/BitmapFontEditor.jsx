import React, { useState, useEffect } from "react";
import { Field } from "./fields";

export default function BitmapFontEditor({ name, font, styles, onSetGlyphs, onRename, onAddGlyphs, onExport, onDelete }) {
	const [newName, setNewName] = useState(name);
	useEffect(() => setNewName(name), [name]);
	const chars = font.glyphs.map((glyph) => glyph.char);
	const repeated = new Set(chars.filter((char, i) => char && chars.indexOf(char) !== i));
	const hasProblems = repeated.size > 0 || chars.includes("");

	return (
		<div style={styles.trackItem}>
			<div style={styles.trackLabel}>Font editor: {font.glyphs.length} glyphs</div>
			<Field label="Font name" styles={styles}>
				<input
					style={styles.fieldInput}
					value={newName}
					onChange={(e) => setNewName(e.target.value)}
					onBlur={() => (newName && newName !== name ? onRename(newName) : setNewName(name))}
				/>
			</Field>
			<div style={styles.glyphGrid}>
				{font.glyphs.map((glyph, i) => (
					<div key={i} style={{ ...styles.glyphCell, borderColor: glyph.char && !repeated.has(glyph.char) ? undefined : "#f44336" }}>
						<img src={glyph.preview} alt="" style={styles.glyphImage} />
						<input
							style={styles.glyphChar}
							value={glyph.char}
							placeholder="?"
							title="Character of this glyph"
							onChange={(e) => onSetGlyphs(font.glyphs.map((item, j) => (j === i ? { ...item, char: [...e.target.value].pop() ?? "" } : item)))}
						/>
						<button style={styles.glyphDelete} onClick={() => onSetGlyphs(font.glyphs.filter((_, j) => j !== i))} title="Delete glyph">×</button>
					</div>
				))}
			</div>
			{hasProblems && <div style={styles.errorText}>Red glyphs have no character or repeat one: glyphs without a character are left out, of a repeated one only the first is used</div>}
			<div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
				<button style={styles.queueClearButton} onClick={onAddGlyphs} title="Images named by character: 0.png, dot.png…">Add glyph images…</button>
				<button style={styles.queueClearButton} onClick={onExport} title="Sheet .json + .png in the game format">Export sheet</button>
				<button style={styles.queueClearButton} onClick={onDelete}>Delete font</button>
			</div>
		</div>
	);
}
