# Pixi Spine Viewer Tool

Pixi Spine Viewer Tool is a web application for previewing and interacting with Spine animations using Pixi.js and pixi-spine. The application allows you to:

- Drag and drop Spine files (JSON, ATLAS, and images) to load animations.
- Play and pause the animation, with adjustable playback speed.
- Scale the Spine animation.
- Select animations and skins from a dropdown menu.
- Put a circle or your own image into any slot, on top of the slot art or instead of it, and hide any slot.
- Adjust the scale of the attached markers.
- Resize the debug and side panels.
- Filter the list of slots.

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