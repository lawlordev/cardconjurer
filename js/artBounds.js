(function(root, factory) {
	var api = factory();
	if (typeof module === 'object' && module.exports) module.exports = api;
	if (root) root.CardConjurerArtBounds = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
	var EPSILON = 1e-9;

	function finite(value, fallback) {
		value = Number(value);
		return Number.isFinite(value) ? value : fallback;
	}

	function clamp(value, minimum, maximum) {
		return Math.min(maximum, Math.max(minimum, value));
	}

	function axes(rotation) {
		var radians = finite(rotation, 0) * Math.PI / 180;
		var cosine = Math.cos(radians);
		var sine = Math.sin(radians);
		return {
			x: {x: cosine, y: sine},
			y: {x: -sine, y: cosine}
		};
	}

	function dot(axis, point) {
		return axis.x * point.x + axis.y * point.y;
	}

	function corners(bounds) {
		var left = finite(bounds && bounds.x, 0);
		var top = finite(bounds && bounds.y, 0);
		var right = left + Math.max(0, finite(bounds && bounds.width, 0));
		var bottom = top + Math.max(0, finite(bounds && bounds.height, 0));
		return [
			{x: left, y: top},
			{x: right, y: top},
			{x: right, y: bottom},
			{x: left, y: bottom}
		];
	}

	function projectionRange(points, axis) {
		var values = points.map(function(point) { return dot(axis, point); });
		return {minimum: Math.min.apply(Math, values), maximum: Math.max.apply(Math, values)};
	}

	function minimumZoom(input) {
		var imageWidth = Math.max(0, finite(input && input.imageWidth, 0));
		var imageHeight = Math.max(0, finite(input && input.imageHeight, 0));
		if (!imageWidth || !imageHeight) return 0;
		var basis = axes(input && input.rotation);
		var points = corners(input && input.bounds);
		var horizontal = projectionRange(points, basis.x);
		var vertical = projectionRange(points, basis.y);
		return Math.max(
			(horizontal.maximum - horizontal.minimum) / imageWidth,
			(vertical.maximum - vertical.minimum) / imageHeight
		);
	}

	function placementRegion(input, zoom) {
		var basis = axes(input.rotation);
		var points = corners(input.bounds);
		var horizontal = projectionRange(points, basis.x);
		var vertical = projectionRange(points, basis.y);
		return {
			basis: basis,
			horizontal: {
				minimum: horizontal.maximum - input.imageWidth * zoom,
				maximum: horizontal.minimum
			},
			vertical: {
				minimum: vertical.maximum - input.imageHeight * zoom,
				maximum: vertical.minimum
			}
		};
	}

	function validInput(input) {
		return Boolean(input && finite(input.imageWidth, 0) > 0 && finite(input.imageHeight, 0) > 0 &&
			finite(input.bounds && input.bounds.width, 0) > 0 && finite(input.bounds && input.bounds.height, 0) > 0);
	}

	function normalizedInput(input) {
		return {
			x: finite(input.x, 0),
			y: finite(input.y, 0),
			zoom: Math.max(0, finite(input.zoom, 0)),
			rotation: finite(input.rotation, 0),
			imageWidth: Math.max(0, finite(input.imageWidth, 0)),
			imageHeight: Math.max(0, finite(input.imageHeight, 0)),
			bounds: {
				x: finite(input.bounds && input.bounds.x, 0),
				y: finite(input.bounds && input.bounds.y, 0),
				width: Math.max(0, finite(input.bounds && input.bounds.width, 0)),
				height: Math.max(0, finite(input.bounds && input.bounds.height, 0))
			}
		};
	}

	function coverZoom(input) {
		var requested = input.zoom;
		var required = minimumZoom(input);
		if (requested + EPSILON >= required) return requested;
		// The editor exposes tenths of a percent. Round upward so display precision
		// can never put the artwork a fraction of a pixel below full coverage.
		return Math.ceil((required - EPSILON) * 1000) / 1000;
	}

	function fromProjections(region, horizontal, vertical) {
		return {
			x: horizontal * region.basis.x.x + vertical * region.basis.y.x,
			y: horizontal * region.basis.x.y + vertical * region.basis.y.y
		};
	}

	function constrainPlacement(rawInput) {
		if (!validInput(rawInput)) return {
			x: finite(rawInput && rawInput.x, 0),
			y: finite(rawInput && rawInput.y, 0),
			zoom: Math.max(0, finite(rawInput && rawInput.zoom, 0))
		};
		var input = normalizedInput(rawInput);
		var zoom = coverZoom(input);
		var region = placementRegion(input, zoom);
		var point = {x: input.x, y: input.y};
		var horizontal = clamp(dot(region.basis.x, point), region.horizontal.minimum, region.horizontal.maximum);
		var vertical = clamp(dot(region.basis.y, point), region.vertical.minimum, region.vertical.maximum);
		var constrained = fromProjections(region, horizontal, vertical);
		return {x: constrained.x, y: constrained.y, zoom: zoom};
	}

	function constrainMovement(rawInput) {
		if (!validInput(rawInput)) return constrainPlacement(rawInput || {});
		var input = normalizedInput(rawInput);
		var zoom = coverZoom(input);
		var region = placementRegion(input, zoom);
		var fromPoint = {
			x: finite(rawInput.fromX, input.x),
			y: finite(rawInput.fromY, input.y)
		};
		var start = constrainPlacement(Object.assign({}, input, {
			x: fromPoint.x,
			y: fromPoint.y,
			zoom: zoom
		}));
		var desiredPoint = {
			x: start.x + input.x - fromPoint.x,
			y: start.y + input.y - fromPoint.y
		};
		var horizontal = clamp(dot(region.basis.x, desiredPoint), region.horizontal.minimum, region.horizontal.maximum);
		var vertical = clamp(dot(region.basis.y, desiredPoint), region.vertical.minimum, region.vertical.maximum);
		var constrained = fromProjections(region, horizontal, vertical);
		return {x: constrained.x, y: constrained.y, zoom: zoom};
	}

	function coversBounds(rawInput) {
		if (!validInput(rawInput)) return false;
		var input = normalizedInput(rawInput);
		var region = placementRegion(input, input.zoom);
		var point = {x: input.x, y: input.y};
		var horizontal = dot(region.basis.x, point);
		var vertical = dot(region.basis.y, point);
		return horizontal + EPSILON >= region.horizontal.minimum && horizontal - EPSILON <= region.horizontal.maximum &&
			vertical + EPSILON >= region.vertical.minimum && vertical - EPSILON <= region.vertical.maximum;
	}

	function zoomAroundPoint(input) {
		var fromZoom = Math.max(0, finite(input && input.fromZoom, 0));
		var toZoom = Math.max(0, finite(input && input.toZoom, fromZoom));
		var x = finite(input && input.x, 0);
		var y = finite(input && input.y, 0);
		if (!fromZoom) return {x: x, y: y, zoom: toZoom};
		var anchorX = finite(input && input.anchorX, x);
		var anchorY = finite(input && input.anchorY, y);
		var ratio = toZoom / fromZoom;
		return {
			x: anchorX - (anchorX - x) * ratio,
			y: anchorY - (anchorY - y) * ratio,
			zoom: toZoom
		};
	}

	return {
		minimumZoom: minimumZoom,
		constrainPlacement: constrainPlacement,
		constrainMovement: constrainMovement,
		coversBounds: coversBounds,
		zoomAroundPoint: zoomAroundPoint
	};
});
