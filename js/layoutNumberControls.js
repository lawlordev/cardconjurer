(function(root, factory) {
	var api = factory();
	if (typeof module === 'object' && module.exports) module.exports = api;
	if (root) root.CardConjurerLayoutNumbers = api;
})(typeof window !== 'undefined' ? window : null, function() {
	var HOLD_DELAY_MS = 360;
	// Text layout rendering is intentionally debounced for 160 ms. Keep held
	// steps outside that window so every tick can reach the card preview.
	var REPEAT_INTERVAL_MS = 220;

	function eventFor(input, type) {
		var EventConstructor = input?.ownerDocument?.defaultView?.Event || Event;
		return new EventConstructor(type, {bubbles: true});
	}

	function holdMultiplier(elapsed, shifted) {
		if (shifted) return 10;
		return 1;
	}

	function stepInput(input, direction, multiplier) {
		if (!input || input.disabled || input.readOnly) return false;
		var amount = Math.max(1, Math.floor(Number(multiplier) || 1));
		try {
			if (direction < 0) input.stepDown(amount);
			else input.stepUp(amount);
		} catch (error) {
			var step = Number(input.step);
			if (!Number.isFinite(step) || step <= 0) step = 1;
			var current = Number(input.value);
			if (!Number.isFinite(current)) current = 0;
			var next = current + (direction < 0 ? -1 : 1) * step * amount;
			var min = Number(input.min);
			var max = Number(input.max);
			if (input.min !== '' && Number.isFinite(min)) next = Math.max(min, next);
			if (input.max !== '' && Number.isFinite(max)) next = Math.min(max, next);
			input.value = String(Math.round(next * 1000000) / 1000000);
		}
		input.dispatchEvent(eventFor(input, 'input'));
		return true;
	}

	function finishInput(input) {
		input.dispatchEvent(eventFor(input, 'change'));
	}

	function labelFor(input) {
		var label = input.getAttribute('aria-label');
		if (label) return label;
		var fieldLabel = input.closest('label')?.querySelector(':scope > span:first-child')?.textContent;
		if (fieldLabel?.trim()) return fieldLabel.trim();
		var description = input.parentElement?.querySelector('.input-description')?.textContent;
		if (description?.trim()) return description.trim();
		return input.getAttribute('placeholder') || 'value';
	}

	function createStepButton(input, direction) {
		var button = input.ownerDocument.createElement('button');
		var action = direction < 0 ? 'Decrease' : 'Increase';
		var label = labelFor(input);
		var holdTimer = null;
		var repeatTimer = null;
		var didStep = false;
		var shifted = false;
		var activePointerId = null;
		var ownerDocument = input.ownerDocument;
		var ownerWindow = ownerDocument.defaultView;

		button.type = 'button';
		button.className = 'layout-number-stepper-button';
		button.textContent = direction < 0 ? '−' : '+';
		button.setAttribute('aria-label', action + ' ' + label);
		button.title = action + ' ' + label + ' (hold for continuous adjustment; Shift for 10×)';

		function stopRepeating(event) {
			if (activePointerId !== null && event?.pointerId != null && event.pointerId !== activePointerId) return;
			clearTimeout(holdTimer);
			clearTimeout(repeatTimer);
			holdTimer = null;
			repeatTimer = null;
			if (didStep) finishInput(input);
			didStep = false;
			activePointerId = null;
			ownerDocument.removeEventListener('pointerup', stopRepeating);
			ownerDocument.removeEventListener('pointercancel', stopRepeating);
			ownerWindow?.removeEventListener('blur', stopRepeating);
		}

		button.addEventListener('pointerdown', function(event) {
			if (event.button !== 0 || input.disabled || input.readOnly) return;
			event.preventDefault();
			stopRepeating();
			activePointerId = event.pointerId;
			shifted = event.shiftKey;
			didStep = stepInput(input, direction, shifted ? 10 : 1);
			function repeatStep() {
				didStep = stepInput(input, direction, holdMultiplier(0, shifted)) || didStep;
				repeatTimer = setTimeout(repeatStep, REPEAT_INTERVAL_MS);
			}
			holdTimer = setTimeout(repeatStep, HOLD_DELAY_MS);
			ownerDocument.addEventListener('pointerup', stopRepeating);
			ownerDocument.addEventListener('pointercancel', stopRepeating);
			ownerWindow?.addEventListener('blur', stopRepeating);
		});
		button.addEventListener('click', function(event) {
			if (event.detail !== 0) return;
			if (stepInput(input, direction, event.shiftKey ? 10 : 1)) finishInput(input);
		});
		return button;
	}

	function enhance(rootNode) {
		if (!rootNode?.querySelectorAll) return 0;
		var enhanced = 0;
		rootNode.querySelectorAll('input.input[type="number"]:not(.hidden)').forEach(function(input) {
			var shell = input.parentElement;
			if (!shell.classList.contains('layout-input-shell')) {
				var wrapper = input.ownerDocument.createElement('span');
				wrapper.className = 'layout-input-shell layout-input-shell-standalone';
				shell.insertBefore(wrapper, input);
				wrapper.appendChild(input);
				shell = wrapper;
			}
			if (shell.classList.contains('layout-number-control')) return;
			var stepper = input.ownerDocument.createElement('span');
			stepper.className = 'layout-number-stepper';
			stepper.append(createStepButton(input, -1), createStepButton(input, 1));
			shell.classList.add('layout-number-control');
			input.setAttribute('inputmode', 'decimal');
			shell.appendChild(stepper);
			enhanced++;
		});
		return enhanced;
	}

	return {
		enhance: enhance,
		holdDelayMs: HOLD_DELAY_MS,
		holdMultiplier: holdMultiplier,
		repeatIntervalMs: REPEAT_INTERVAL_MS,
		stepInput: stepInput
	};
});
