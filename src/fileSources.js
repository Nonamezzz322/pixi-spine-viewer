// Where every picked file came from, so the scene can read the same files again after a reload.
// A page can not open a file by its path; the File System Access API (Chrome, Edge) gives handles
// that can be kept in IndexedDB and read later, after the user allows it once more if the browser asks.
import { readSceneZip } from "./scene";

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"];
const sources = new WeakMap();
let database = null;

const openDatabase = () => {
	database ||= new Promise((resolve, reject) => {
		const request = indexedDB.open("pixi-spine-viewer", 1);
		request.onupgradeneeded = () => {
			request.result.createObjectStore("handles");
			request.result.createObjectStore("sources");
		};
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
	return database;
};

const useStore = async (store, mode, action) => {
	const db = await openDatabase();
	return new Promise((resolve, reject) => {
		const transaction = db.transaction(store, mode);
		const request = action(transaction.objectStore(store));
		transaction.oncomplete = () => resolve(request.result);
		transaction.onerror = () => reject(transaction.error);
	});
};

export const canKeepFileAccess = () => typeof window.showOpenFilePicker === "function";

// the source of a file picked in this session: { handleId, path } and for a file from a zip also { entry }
export const getPickedSource = (file) => sources.get(file);

export const saveSource = (assetPath, source) => useStore("sources", "readwrite", (store) => store.put(source, assetPath));

const toPickerTypes = (accept) => {
	const extensions = accept.split(",").map((item) => item.trim()).flatMap((item) => (item === "image/*" ? IMAGE_EXTENSIONS : item.startsWith(".") ? [item] : []));
	return extensions.length > 0 ? [{ description: "Files", accept: { "application/octet-stream": extensions } }] : undefined;
};

// picks like the hidden file input (folder files are named "folder/sub/name" like webkitRelativePath)
// and remembers the handles; must be called from a click
export async function pickFilesKeepingAccess(accept, folder) {
	const pickId = crypto.randomUUID();
	if (folder) {
		const dir = await window.showDirectoryPicker();
		await useStore("handles", "readwrite", (store) => store.put(dir, pickId));
		const files = [];
		const walk = async (handle, path) => {
			for await (const entry of handle.values()) {
				if (entry.kind === "directory") {
					await walk(entry, [...path, entry.name]);
					continue;
				}
				const file = await entry.getFile();
				const named = new File([file], [dir.name, ...path, entry.name].join("/"), { type: file.type, lastModified: file.lastModified });
				sources.set(named, { handleId: pickId, path: [...path, entry.name] });
				files.push(named);
			}
		};
		await walk(dir, []);
		return files;
	}
	const handles = await window.showOpenFilePicker({ multiple: true, types: toPickerTypes(accept) });
	return Promise.all(handles.map(async (handle, i) => {
		const handleId = `${pickId}-${i}`;
		await useStore("handles", "readwrite", (store) => store.put(handle, handleId));
		const file = await handle.getFile();
		sources.set(file, { handleId, path: [] });
		return file;
	}));
}

// reads a saved file from where it was picked: null when the browser wants the user to allow access,
// an error when the file is not there any more; askAccess may show the browser's prompt (only inside a click)
export async function readSavedFile(assetPath, askAccess, zipCache) {
	const source = await useStore("sources", "readonly", (store) => store.get(assetPath));
	if (!source) throw new Error(`no saved source for ${assetPath}`);
	const handle = await useStore("handles", "readonly", (store) => store.get(source.handleId));
	if (!handle) throw new Error(`no saved handle for ${assetPath}`);
	let state = await handle.queryPermission({ mode: "read" });
	if (state === "prompt" && askAccess) state = await handle.requestPermission({ mode: "read" });
	if (state !== "granted") return null;
	let fileHandle = handle;
	for (const [i, name] of source.path.entries()) {
		fileHandle = i < source.path.length - 1 ? await fileHandle.getDirectoryHandle(name) : await fileHandle.getFileHandle(name);
	}
	const file = await fileHandle.getFile();
	if (!source.entry) return new File([file], assetPath, { type: file.type, lastModified: file.lastModified });
	// a file that came from an imported scene zip: the zip is read once per restore
	const zipKey = `${source.handleId}/${source.path.join("/")}`;
	if (!zipCache.has(zipKey)) zipCache.set(zipKey, readSceneZip(file));
	const found = (await zipCache.get(zipKey)).files.get(source.entry);
	if (!found) throw new Error(`${source.entry} is not in the zip any more`);
	return found;
}
