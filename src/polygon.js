export const DEFAULT_MASK_POINTS = [{ x: -200, y: -200 }, { x: 200, y: -200 }, { x: 200, y: 200 }, { x: -200, y: 200 }];

export const getEdgeMiddle = (points, index) => {
	const next = points[(index + 1) % points.length];
	return { x: (points[index].x + next.x) / 2, y: (points[index].y + next.y) / 2 };
};

// ray casting: counts how many edges a ray to the right crosses
export const isInsidePolygon = (points, x, y) => {
	let inside = false;
	for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
		const a = points[i];
		const b = points[j];
		if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
	}
	return inside;
};

// the point or the edge middle under the cursor, points first
export const findPolygonHandle = (points, x, y, radius) => {
	const isNear = (p) => Math.hypot(p.x - x, p.y - y) <= radius;
	const point = points.findIndex(isNear);
	if (point !== -1) return { kind: "point", index: point };
	const edge = points.findIndex((_, i) => isNear(getEdgeMiddle(points, i)));
	return edge === -1 ? null : { kind: "edge", index: edge };
};
