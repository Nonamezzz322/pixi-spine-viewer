export function findImageFile(imgName, fileURLs) {
	const extensions = [".png", ".jpg", ".jpeg", ".webp"];
	const baseName = imgName.split("/").pop();
	// exact match with extension
	for (const ext of extensions) {
		if (fileURLs[imgName + ext]) return { url: fileURLs[imgName + ext], fileName: imgName + ext };
	}
	// exact match as-is
	if (fileURLs[imgName]) return { url: fileURLs[imgName], fileName: imgName };
	// case-insensitive endsWith match (handles folder prefixes like "images/subfolder/name");
	// must run before basename matches, or "sym1/bg" and "sym2/bg" get the same file
	for (const ext of extensions) {
		const suffix = ("/" + imgName + ext).toLowerCase();
		for (const key in fileURLs) {
			if (("/" + key).toLowerCase().endsWith(suffix)) return { url: fileURLs[key], fileName: key };
		}
	}
	// case-insensitive basename only
	for (const ext of extensions) {
		const target = (baseName + ext).toLowerCase();
		for (const key in fileURLs) {
			if (key.split("/").pop().toLowerCase() === target) return { url: fileURLs[key], fileName: key };
		}
	}
	// basename without extension match
	const targetBase = baseName.toLowerCase();
	for (const key in fileURLs) {
		const keyBase = key.split("/").pop().toLowerCase().replace(/\.[^.]+$/, "");
		if (keyBase === targetBase) return { url: fileURLs[key], fileName: key };
	}
	return null;
}

const getBaseName = (name) => name.split("/").pop().replace(/\.[^.]+$/, "").toLowerCase();

// Picks the skeleton JSON and its atlas (same base name) from the dropped files.
// No atlas is fine: the atlas is then built from the images.
export function findSpineFiles(fileNames) {
	const jsonNames = fileNames.filter((name) => name.toLowerCase().endsWith(".json"));
	const atlasNames = fileNames.filter((name) => name.toLowerCase().endsWith(".atlas"));
	const findAtlas = (jsonName) => atlasNames.find((name) => getBaseName(name) === getBaseName(jsonName));
	if (jsonNames.length === 0) return { error: "JSON file not found" };
	if (jsonNames.length === 1) {
		const atlasFileName = findAtlas(jsonNames[0]) || (atlasNames.length === 1 ? atlasNames[0] : null);
		if (!atlasFileName && atlasNames.length > 1) {
			return { error: `Several .atlas files found, none matches ${jsonNames[0]}` };
		}
		return { jsonFileName: jsonNames[0], atlasFileName };
	}
	const pairedJsonNames = jsonNames.filter(findAtlas);
	if (pairedJsonNames.length === 1) {
		return { jsonFileName: pairedJsonNames[0], atlasFileName: findAtlas(pairedJsonNames[0]) };
	}
	return { error: `Several skeletons found (${jsonNames.join(", ")}). Open one at a time.` };
}
