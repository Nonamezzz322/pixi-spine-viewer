# Pixi Spine Viewer Tool

Pixi Spine Viewer Tool is a web application for previewing and interacting with Spine animations using Pixi.js and pixi-spine. It has two tabs.

**Spine Viewer** allows you to:

- Drag and drop Spine files (JSON, ATLAS, and images) to load animations.
- Play and pause the animation, with adjustable playback speed.
- Scale the Spine animation.
- Select animations and skins from a dropdown menu.
- Put a circle or your own image into any slot, on top of the slot art or instead of it, and hide any slot.
- Adjust the scale of the attached markers.
- Resize the debug and side panels.
- Filter the list of slots.

**Spine Constructor** builds a small Pixi scene from several elements:

- Images, Spine animations, texts, bitmaps and particle emitters.
- Texts use the `MyriadPro` family of base-slot styles (Regular / Bold), drawn with the free Source Sans 3 look-alike, and have a full style editor with JSON import and export in the game `textStyle` format.
- Bitmaps work like the game's bitmap values: you type a number (decimals after `.` or `,`, "Decimals" fixes them, e.g. 2 for cents), "Is short" turns thousands and millions into 12.50k / 1.25m, "Scale to width" / "Min fit width" shrink the bitmap to a width budget like `scaleToWidth` / `minFitWidthPx`, and "Increment" counts up to the value with the game's countup ease over the set time. They use game-format bitmap fonts (the `numbers` font of base-slot is built in). The font editor imports a sheet (.json + .png), a folder of glyph images or a .fnt, lets you change glyph characters and exports the sheet in the game format.
- Emitter presets of base-slot (coin rain low / middle / high / highest) are added in one click, 500 px below the scene centre.
- A polygon mask (4 points by default) that clips the elements you tick: drag its points on the canvas, click the dot between two points to add one, double-click a point to delete it, or type the points in the panel.
- A fader like the game's (black curtain, alpha 0.9, 0.3 s fade): it darkens every layer under it, or only one chosen element.
- Spines play several tracks at the same time (animation, loop and alpha per track).
- The scene is autosaved in the browser (settings and file paths only, no images). In Chrome and Edge the files are read again from where you picked them after a reload (the browser may ask to allow access once; choose "Allow on every visit" to skip that); only files that are gone from their old place are reported. In other browsers you pick them again once. "Export .zip" packs `scene.json` with every file of the scene, "Import .zip" loads such a zip into any browser.
- Any element can be put into a spine slot, on top of the slot art or instead of it; it then follows the slot's bone. Emitters are dragged by their handle.
- View the scene on an iPhone 16 Pro screen in landscape or portrait (icons at the top right of the scene): the stage fits the game design size (1920 × 1080 / 1080 × 1820) like the game's resizer. The buttons at the top left hide or show the side panels.
- Select and drag elements on the canvas, zoom with the slider (5–1000%, sticks to 100% in the middle) or the mouse wheel, pan by dragging empty space.
- Edit position, scale, rotation, alpha and the settings of each element type; change layer order, hide or delete elements.
- Configure emitters with the form or with any `@pixi/particle-emitter` JSON config (configs from the old Pixi Particles Editor are converted).

## Getting Started
Clone the repository and install dependencies:

```sh
git clone https://github.com/Nonamezzz322/pixi-spine-viewer.git
cd pixi-spine-viewer
```

Npm package manager is used to install dependencies and run scripts.
```sh
npm i
npm run build
npm run preview
npm test
```