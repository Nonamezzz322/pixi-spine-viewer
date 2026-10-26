export const baseTheme = {
	light: {
		background: "#f2f2f2",
		headerBg: "#3f51b5",
		headerText: "#ffffff",
		sidebarBg: "#ffffff",
		sidebarText: "#333333",
		buttonBg: "#4caf50",
		buttonText: "#ffffff",
		removeButtonBg: "#f44336",
		inputBg: "#ffffff",
		inputBorder: "#cccccc",
		dropZoneBg: "#ffffff"
	},
	dark: {
		background: "#2b2b2b",
		headerBg: "#3b3b3b",
		headerText: "#ffffff",
		sidebarBg: "#3b3b3b",
		sidebarText: "#cccccc",
		buttonBg: "#4caf50",
		buttonText: "#ffffff",
		removeButtonBg: "#f44336",
		inputBg: "#555555",
		inputBorder: "#777777",
		dropZoneBg: "#444444"
	}
};

const scaleFactor = 0.75;
const playButtonColor = "#6699FF";
const pauseButtonColor = "#B0B0B0";

export const getStyles = (theme) => {
	const currentTheme = baseTheme[theme];
	return {
		wrapper: {
			display: "flex",
			flexDirection: "column",
			height: "100vh",
			overflow: "hidden",
			margin: 0,
			padding: 0,
			fontFamily: "Arial, sans-serif",
			backgroundColor: currentTheme.background,
			boxSizing: "border-box",
			color: currentTheme.sidebarText,
			fontSize: `${scaleFactor * 16}px`
		},
		header: {
			position: "relative",
			padding: `${scaleFactor * 8}px ${scaleFactor * 16}px`,
			backgroundColor: currentTheme.headerBg,
			color: currentTheme.headerText,
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			borderBottom: "1px solid rgba(255,255,255,0.3)"
		},
		headerTabs: {
			display: "flex",
			gap: `${scaleFactor * 4}px`
		},
		headerTab: (active) => ({
			padding: `${scaleFactor * 4}px ${scaleFactor * 14}px`,
			border: "none",
			borderRadius: `${scaleFactor * 4}px`,
			backgroundColor: active ? "rgba(255,255,255,0.2)" : "transparent",
			color: currentTheme.headerText,
			fontSize: `${scaleFactor * 16}px`,
			fontWeight: active ? "bold" : "normal",
			cursor: "pointer"
		}),
		headerRight: {
			display: "flex",
			alignItems: "center",
			gap: `${scaleFactor * 10}px`
		},
		currentThemeText: {
			fontSize: `${scaleFactor * 14.4}px`
		},
		mainContent: {
			display: "flex",
			flex: 1,
			overflow: "hidden"
		},
		leftColumn: {
			flex: 1,
			display: "flex",
			flexDirection: "column",
			margin: `${scaleFactor * 10}px`,
			overflow: "hidden"
		},
		dropZone: {
			flex: 1,
			position: "relative",
			border: "2px dashed #bbb",
			borderRadius: `${scaleFactor * 8}px`,
			backgroundColor: currentTheme.dropZoneBg,
			overflow: "hidden",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			marginBottom: `${scaleFactor * 10}px`
		},
		dropText: {
			zIndex: 2,
			color: theme === "dark" ? "#ffffff" : "#888888",
			textAlign: "center",
			fontSize: `${scaleFactor * 16}px`
		},
		pixiContainer: {
			position: "absolute",
			top: 0,
			left: 0,
			width: "100%",
			height: "100%",
			zIndex: 1
		},
		sidebar: {
			position: "relative",
			flexShrink: 0,
			margin: `${scaleFactor * 10}px`,
			padding: `${scaleFactor * 10}px`,
			borderRadius: `${scaleFactor * 8}px`,
			backgroundColor: currentTheme.sidebarBg,
			boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
			display: "flex",
			flexDirection: "column"
		},
		fixedArea: {
			flex: 1,
			minHeight: 0,
			overflowY: "auto",
			marginBottom: `${scaleFactor * 10}px`,
			paddingBottom: `${scaleFactor * 10}px`
		},
		sectionHeader: {
			marginBottom: `${scaleFactor * 8}px`,
			fontSize: `${scaleFactor * 16}px`,
			fontWeight: "bold",
			paddingBottom: `${scaleFactor * 4}px`
		},
		input: {
			width: "100%",
			padding: `${scaleFactor * 8}px`,
			marginTop: `${scaleFactor * 8}px`,
			borderRadius: `${scaleFactor * 4}px`,
			border: `1px solid ${currentTheme.inputBorder}`,
			boxSizing: "border-box",
			backgroundColor: currentTheme.inputBg,
			color: currentTheme.sidebarText,
			fontSize: `${scaleFactor * 14.4}px`
		},
		scaleControl: {
			marginTop: `${scaleFactor * 8}px`,
			marginBottom: `${scaleFactor * 8}px`
		},
		sliderLabel: {
			fontSize: `${scaleFactor * 14.4}px`
		},
		animationsSelect: {
			width: "100%",
			padding: `${scaleFactor * 8}px`,
			borderRadius: `${scaleFactor * 4}px`,
			border: `1px solid ${currentTheme.inputBorder}`,
			boxSizing: "border-box",
			fontSize: `${scaleFactor * 14.4}px`,
			height: `${scaleFactor * 36}px`,
			marginTop: `${scaleFactor * 8}px`,
			marginBottom: `${scaleFactor * 8}px`
		},
		fullWidthButton: {
			width: "100%",
			padding: `${scaleFactor * 8}px ${scaleFactor * 12}px`,
			border: "none",
			borderRadius: `${scaleFactor * 4}px`,
			color: "#ffffff",
			cursor: "pointer",
			fontSize: `${scaleFactor * 14.4}px`,
			height: `${scaleFactor * 36}px`,
			marginTop: `${scaleFactor * 8}px`,
			marginBottom: `${scaleFactor * 8}px`
		},
		slotItem: {
			marginBottom: `${scaleFactor * 10}px`,
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			paddingBottom: `${scaleFactor * 4}px`
		},
		attachedSlotControls: {
			display: "flex",
			alignItems: "center",
			gap: `${scaleFactor * 8}px`
		},
		unattachedButton: {
			padding: `${scaleFactor * 4}px ${scaleFactor * 8}px`,
			border: "none",
			borderRadius: `${scaleFactor * 4}px`,
			backgroundColor: currentTheme.buttonBg,
			color: currentTheme.buttonText,
			cursor: "pointer",
			fontSize: `${scaleFactor * 14.4}px`
		},
		toggleSwitch: {
			position: "relative",
			display: "inline-block",
			width: `${scaleFactor * 50}px`,
			height: `${scaleFactor * 24}px`
		},
		toggleSlider: (theme) => ({
			position: "absolute",
			cursor: "pointer",
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			backgroundColor: theme === "light" ? "#4caf50" : "#cccccc",
			transition: ".4s",
			borderRadius: `${scaleFactor * 24}px`
		}),
		toggleKnob: (theme) => ({
			position: "absolute",
			height: `${scaleFactor * 18}px`,
			width: `${scaleFactor * 18}px`,
			left: theme === "light" ? `${scaleFactor * 26}px` : `${scaleFactor * 3}px`,
			bottom: `${scaleFactor * 3}px`,
			backgroundColor: "#ffffff",
			transition: ".4s",
			borderRadius: "50%"
		}),
		playButtonColor,
		pauseButtonColor,
		dropOverlay: {
			zIndex: 2,
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			justifyContent: "center"
		},
		openFileButton: {
			padding: `${scaleFactor * 8}px ${scaleFactor * 16}px`,
			border: "none",
			borderRadius: `${scaleFactor * 4}px`,
			backgroundColor: "#6699FF",
			color: "#ffffff",
			cursor: "pointer",
			fontSize: `${scaleFactor * 14.4}px`,
			marginTop: `${scaleFactor * 8}px`
		},
		canvasControls: {
			position: "absolute",
			bottom: `${scaleFactor * 12}px`,
			left: `${scaleFactor * 12}px`,
			zIndex: 3,
			display: "flex",
			alignItems: "center",
			gap: `${scaleFactor * 8}px`
		},
		canvasPauseButton: {
			width: `${scaleFactor * 36}px`,
			height: `${scaleFactor * 36}px`,
			border: "none",
			borderRadius: "50%",
			backgroundColor: "rgba(0,0,0,0.5)",
			color: "#ffffff",
			cursor: "pointer",
			fontSize: `${scaleFactor * 18}px`,
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			lineHeight: 1
		},
		bonesCheckboxLabel: {
			display: "flex",
			alignItems: "center",
			gap: `${scaleFactor * 4}px`,
			color: "#ffffff",
			fontSize: `${scaleFactor * 13}px`,
			backgroundColor: "rgba(0,0,0,0.5)",
			padding: `${scaleFactor * 4}px ${scaleFactor * 8}px`,
			borderRadius: `${scaleFactor * 4}px`,
			cursor: "pointer",
			userSelect: "none"
		},
		fpsCounter: {
			position: "absolute",
			top: `${scaleFactor * 8}px`,
			left: `${scaleFactor * 8}px`,
			zIndex: 3,
			color: "#00ff00",
			fontSize: `${scaleFactor * 13}px`,
			fontFamily: "monospace",
			backgroundColor: "rgba(0,0,0,0.5)",
			padding: `${scaleFactor * 2}px ${scaleFactor * 6}px`,
			borderRadius: `${scaleFactor * 3}px`,
			pointerEvents: "none",
			userSelect: "none"
		},
		queueSection: {
			marginTop: `${scaleFactor * 4}px`
		},
		queueHeader: {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			marginBottom: `${scaleFactor * 4}px`
		},
		queueList: {
			border: `1px solid ${currentTheme.inputBorder}`,
			borderRadius: `${scaleFactor * 4}px`,
			padding: `${scaleFactor * 4}px`,
			marginBottom: `${scaleFactor * 4}px`,
			maxHeight: `${scaleFactor * 120}px`,
			overflowY: "auto"
		},
		queueItem: {
			display: "flex",
			alignItems: "center",
			gap: `${scaleFactor * 4}px`,
			padding: `${scaleFactor * 2}px 0`,
			fontSize: `${scaleFactor * 13}px`
		},
		queueItemIndex: {
			color: currentTheme.sidebarText,
			opacity: 0.6,
			minWidth: `${scaleFactor * 18}px`
		},
		queueItemName: {
			flex: 1,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		},
		queueRemoveButton: {
			background: "none",
			border: "none",
			color: "#f44336",
			cursor: "pointer",
			fontSize: `${scaleFactor * 16}px`,
			padding: `0 ${scaleFactor * 4}px`,
			lineHeight: 1
		},
		queueClearButton: {
			background: "none",
			border: `1px solid ${currentTheme.inputBorder}`,
			color: currentTheme.sidebarText,
			cursor: "pointer",
			fontSize: `${scaleFactor * 11}px`,
			padding: `${scaleFactor * 2}px ${scaleFactor * 6}px`,
			borderRadius: `${scaleFactor * 3}px`
		},
		debugPanel: {
			position: "relative",
			flexShrink: 0,
			margin: `${scaleFactor * 10}px 0 ${scaleFactor * 10}px ${scaleFactor * 10}px`,
			padding: `${scaleFactor * 10}px`,
			borderRadius: `${scaleFactor * 8}px`,
			backgroundColor: currentTheme.sidebarBg,
			boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
			display: "flex",
			flexDirection: "column",
			overflow: "hidden"
		},
		resizeHandle: {
			position: "absolute",
			top: 0,
			bottom: 0,
			width: `${scaleFactor * 6}px`,
			cursor: "col-resize",
			backgroundColor: "rgba(128,128,128,0.2)",
			zIndex: 1
		},
		debugSlotScaleRow: {
			marginBottom: `${scaleFactor * 6}px`
		},
		debugAttachedSlots: {
			flexShrink: 0,
			maxHeight: "45%",
			overflowY: "auto",
			marginBottom: `${scaleFactor * 6}px`,
			borderBottom: `1px solid ${currentTheme.inputBorder}`,
			paddingBottom: `${scaleFactor * 6}px`
		},
		bonesList: {
			flex: 1,
			overflowY: "auto",
			marginTop: `${scaleFactor * 4}px`
		},
		boneItem: {
			padding: `${scaleFactor * 3}px ${scaleFactor * 6}px`,
			fontSize: `${scaleFactor * 12}px`,
			cursor: "pointer",
			borderRadius: `${scaleFactor * 2}px`,
			marginBottom: `${scaleFactor * 1}px`,
			userSelect: "none",
			transition: "background-color 0.15s"
		},
		timelineSection: {
			marginTop: `${scaleFactor * 8}px`,
			marginBottom: `${scaleFactor * 4}px`
		},
		timelineHeader: {
			display: "flex",
			justifyContent: "space-between",
			alignItems: "center",
			marginBottom: `${scaleFactor * 4}px`
		},
		timelineTimeLabel: {
			fontSize: `${scaleFactor * 11}px`,
			color: currentTheme.sidebarText,
			opacity: 0.7,
			fontFamily: "monospace"
		},
		timelineTrack: {
			position: "relative",
			height: `${scaleFactor * 20}px`,
			backgroundColor: currentTheme.inputBg,
			border: `1px solid ${currentTheme.inputBorder}`,
			borderRadius: `${scaleFactor * 3}px`,
			cursor: "pointer",
			overflow: "hidden",
			userSelect: "none"
		},
		timelineTrimRegion: {
			position: "absolute",
			top: 0,
			bottom: 0,
			backgroundColor: "rgba(76, 175, 80, 0.25)",
			borderLeft: "2px solid #4caf50",
			borderRight: "2px solid #4caf50",
			pointerEvents: "none"
		},
		timelinePlayhead: {
			position: "absolute",
			top: 0,
			bottom: 0,
			width: "2px",
			backgroundColor: "#ff5722",
			transform: "translateX(-1px)",
			pointerEvents: "none",
			zIndex: 1
		},
		trimControls: {
			marginTop: `${scaleFactor * 6}px`
		},
		trimCheckboxLabel: {
			display: "flex",
			alignItems: "center",
			gap: `${scaleFactor * 4}px`,
			fontSize: `${scaleFactor * 12}px`,
			cursor: "pointer",
			userSelect: "none"
		},
		trimInputs: {
			display: "flex",
			flexDirection: "column",
			gap: `${scaleFactor * 4}px`,
			marginTop: `${scaleFactor * 4}px`
		},
		trimInputGroup: {
			display: "flex",
			alignItems: "center",
			gap: `${scaleFactor * 6}px`
		},
		trimLabel: {
			fontSize: `${scaleFactor * 11}px`,
			width: `${scaleFactor * 30}px`,
			flexShrink: 0
		},
		trimSlider: {
			flex: 1,
			height: `${scaleFactor * 4}px`
		},
		trimValue: {
			fontSize: `${scaleFactor * 11}px`,
			fontFamily: "monospace",
			width: `${scaleFactor * 42}px`,
			textAlign: "right",
			flexShrink: 0
		},
		addButtons: {
			display: "grid",
			gridTemplateColumns: "1fr 1fr",
			gap: `${scaleFactor * 4}px`,
			marginBottom: `${scaleFactor * 10}px`
		},
		addButton: {
			padding: `${scaleFactor * 6}px`,
			border: "none",
			borderRadius: `${scaleFactor * 4}px`,
			backgroundColor: currentTheme.buttonBg,
			color: currentTheme.buttonText,
			cursor: "pointer",
			fontSize: `${scaleFactor * 13}px`
		},
		layerItem: {
			display: "flex",
			alignItems: "center",
			gap: `${scaleFactor * 4}px`,
			padding: `${scaleFactor * 3}px ${scaleFactor * 6}px`,
			fontSize: `${scaleFactor * 12}px`,
			cursor: "pointer",
			borderRadius: `${scaleFactor * 2}px`,
			marginBottom: `${scaleFactor * 1}px`,
			userSelect: "none"
		},
		layerName: {
			flex: 1,
			overflow: "hidden",
			textOverflow: "ellipsis",
			whiteSpace: "nowrap"
		},
		fieldRow: {
			display: "flex",
			alignItems: "center",
			gap: `${scaleFactor * 6}px`,
			marginBottom: `${scaleFactor * 4}px`,
			fontSize: `${scaleFactor * 12}px`
		},
		fieldLabel: {
			width: `${scaleFactor * 90}px`,
			flexShrink: 0
		},
		fieldInput: {
			flex: 1,
			minWidth: 0,
			padding: `${scaleFactor * 3}px ${scaleFactor * 4}px`,
			border: `1px solid ${currentTheme.inputBorder}`,
			borderRadius: `${scaleFactor * 3}px`,
			backgroundColor: currentTheme.inputBg,
			color: currentTheme.sidebarText,
			fontSize: `${scaleFactor * 12}px`,
			boxSizing: "border-box"
		},
		jsonInput: {
			width: "100%",
			boxSizing: "border-box",
			padding: `${scaleFactor * 4}px`,
			border: `1px solid ${currentTheme.inputBorder}`,
			borderRadius: `${scaleFactor * 3}px`,
			backgroundColor: currentTheme.inputBg,
			color: currentTheme.sidebarText,
			fontFamily: "monospace",
			fontSize: `${scaleFactor * 11}px`,
			resize: "vertical"
		},
		sceneBar: {
			position: "absolute",
			top: `${scaleFactor * 10}px`,
			display: "flex",
			gap: `${scaleFactor * 4}px`,
			zIndex: 3
		},
		iconButton: (active) => ({
			width: `${scaleFactor * 40}px`,
			height: `${scaleFactor * 40}px`,
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			border: "none",
			borderRadius: `${scaleFactor * 6}px`,
			backgroundColor: active ? "#6699FF" : "rgba(0,0,0,0.5)",
			color: "#ffffff",
			cursor: "pointer",
			padding: 0
		}),
		phoneBezel: {
			position: "absolute",
			backgroundColor: "#0d0d0d",
			boxShadow: "0 0 0 2px #3a3a3a, 0 8px 30px rgba(0,0,0,0.45)",
			zIndex: 0
		},
		phoneIsland: {
			position: "absolute",
			backgroundColor: "#000000",
			borderRadius: "999px",
			zIndex: 2,
			pointerEvents: "none"
		},
		phoneCaption: {
			position: "absolute",
			left: 0,
			right: 0,
			textAlign: "center",
			fontSize: `${scaleFactor * 12}px`,
			color: theme === "dark" ? "#bbbbbb" : "#666666",
			zIndex: 2,
			pointerEvents: "none"
		},
		zoomSlider: {
			width: `${scaleFactor * 220}px`,
			margin: 0,
			cursor: "pointer"
		},
		zoomValue: {
			width: `${scaleFactor * 44}px`,
			textAlign: "right",
			fontFamily: "monospace"
		},
		glyphGrid: {
			display: "grid",
			gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))",
			gap: `${scaleFactor * 4}px`,
			margin: `${scaleFactor * 4}px 0`
		},
		glyphCell: {
			position: "relative",
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			gap: `${scaleFactor * 2}px`,
			padding: `${scaleFactor * 3}px`,
			border: `1px solid ${currentTheme.inputBorder}`,
			borderRadius: `${scaleFactor * 3}px`,
			background: "repeating-conic-gradient(#9a9a9a 0 25%, #7a7a7a 0 50%) 50% / 10px 10px"
		},
		glyphImage: {
			height: "40px",
			maxWidth: "100%",
			objectFit: "contain"
		},
		glyphChar: {
			width: "100%",
			boxSizing: "border-box",
			textAlign: "center",
			padding: 0,
			border: `1px solid ${currentTheme.inputBorder}`,
			borderRadius: `${scaleFactor * 2}px`,
			backgroundColor: currentTheme.inputBg,
			color: currentTheme.sidebarText,
			fontSize: `${scaleFactor * 13}px`
		},
		glyphDelete: {
			position: "absolute",
			top: 0,
			right: 0,
			background: "rgba(0,0,0,0.5)",
			border: "none",
			borderRadius: `0 ${scaleFactor * 3}px 0 ${scaleFactor * 3}px`,
			color: "#ffffff",
			cursor: "pointer",
			fontSize: `${scaleFactor * 12}px`,
			lineHeight: 1,
			padding: `${scaleFactor * 1}px ${scaleFactor * 4}px`
		},
		errorText: {
			color: "#f44336",
			fontSize: `${scaleFactor * 12}px`,
			marginBottom: `${scaleFactor * 6}px`,
			wordBreak: "break-word"
		},
		trackItem: {
			border: `1px solid ${currentTheme.inputBorder}`,
			borderRadius: `${scaleFactor * 4}px`,
			padding: `${scaleFactor * 6}px`,
			marginBottom: `${scaleFactor * 4}px`
		},
		trackItemHeader: {
			display: "flex",
			alignItems: "center",
			justifyContent: "space-between",
			marginBottom: `${scaleFactor * 2}px`
		},
		trackLabel: {
			fontSize: `${scaleFactor * 12}px`,
			fontWeight: "bold"
		},
		trackAlphaLabel: {
			fontSize: `${scaleFactor * 11}px`,
			flexShrink: 0
		},
		trackAlphaValue: {
			fontSize: `${scaleFactor * 11}px`,
			fontFamily: "monospace",
			width: `${scaleFactor * 30}px`,
			textAlign: "right",
			flexShrink: 0
		}
	};
};