import React, { useState, useEffect } from "react";

// keeps the typed text, so "-" or "0." can be typed before the value is a number
export function NumberInput({ value, onChange, step = 1, style }) {
	const [text, setText] = useState(String(value));
	useEffect(() => {
		if (parseFloat(text) !== value) setText(String(Math.round(value * 1000) / 1000));
	}, [value]);
	return (
		<input
			type="number"
			step={step}
			value={text}
			style={style}
			onChange={(e) => {
				setText(e.target.value);
				const v = parseFloat(e.target.value);
				if (!Number.isNaN(v)) onChange(v);
			}}
		/>
	);
}

export function Field({ label, styles, children }) {
	return (
		<label style={styles.fieldRow}>
			<span style={styles.fieldLabel}>{label}</span>
			{children}
		</label>
	);
}

// a JSON box with Apply and Copy; the draft resets whenever the value from outside changes
export function JsonBox({ value, onApply, styles, rows = 10 }) {
	const [draft, setDraft] = useState(value);
	useEffect(() => setDraft(value), [value]);
	return (
		<>
			<textarea style={styles.jsonInput} rows={rows} spellCheck={false} value={draft} onChange={(e) => setDraft(e.target.value)} />
			<div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
				<button style={styles.queueClearButton} onClick={() => onApply(draft)}>Apply JSON</button>
				<button style={styles.queueClearButton} onClick={() => navigator.clipboard.writeText(draft)}>Copy</button>
			</div>
		</>
	);
}
