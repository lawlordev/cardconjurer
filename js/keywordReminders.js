(function(root, factory) {
	var catalog = root && root.CardConjurerMseKeywordCatalog;
	var mseRuntime = root && root.CardConjurerMseKeywordRuntime;
	if (typeof module === 'object' && module.exports) {
		catalog = require('./mseKeywordCatalog.js');
		mseRuntime = require('./mseKeywordRuntime.js');
	}
	var api = factory(root, catalog, mseRuntime);
	if (typeof module === 'object' && module.exports) module.exports = api;
	if (root) root.CardConjurerKeywordReminders = api;
})(typeof window !== 'undefined' ? window : globalThis, function(root, mseCatalog, mseRuntime) {
	'use strict';

	var CUSTOM_STORAGE_KEY = 'set-conjurer-custom-keywords-v1';
	var EXPORT_FORMAT = 'set-conjurer-keywords';
	var EXPORT_SCHEMA_VERSION = 1;
	var initialized = false;
	var editingCustomId = '';
	var selectedKeywordId = '';

	if (!mseCatalog || !mseRuntime) throw new Error('The MSE keyword catalog must load before keyword reminders.');
	// Generated from Full Magic Pack's develop catalog plus reviewed retained definitions.
	var DEFAULT_KEYWORDS = mseCatalog.keywords;

	function definition(id, name, pattern, reminder, example, priority, placement) {
		return {id: id, name: name, pattern: pattern, reminder: reminder, example: example, priority: priority || 0, placement:placement || 'inline', builtIn: true};
	}

	function storage() {
		try { return root && root.document && root.localStorage ? root.localStorage : null; }
		catch (error) { return null; }
	}

	function slug(value) {
		return String(value || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'keyword';
	}

	function clone(value) {
		return JSON.parse(JSON.stringify(value));
	}

	function escapeHtml(value) {
		return String(value == null ? '' : value).replace(/[&<>"']/g, function(character) {
			return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character];
		});
	}

	function escapeRegex(value) {
		return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	function normalizeCustomKeyword(value, index) {
		if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Each custom keyword must be an object.');
		var name = String(value.name || '').trim();
		var pattern = String(value.pattern || '').trim();
		var reminder = String(value.reminder || '').trim();
		if (!name) throw new Error('Each custom keyword needs a name.');
		if (!pattern) throw new Error(name + ' needs a recognition pattern.');
		if (!reminder) throw new Error(name + ' needs reminder text.');
		var mseParameterPattern = /<atom-param[^>]*>([^<]+)<\/atom-param>/gi;
		var mseParameters = Array.from(pattern.matchAll(mseParameterPattern));
		var usesMseSyntax = mseParameters.length > 0;
		var placeholderPattern = /\{(?:number|cost|mana|text|word|prefix|english|plural|s)(?::[a-z][a-z0-9_-]*)?\}/gi;
		if (usesMseSyntax) {
			if (/<\/?atom-param/i.test(pattern.replace(mseParameterPattern, ''))) throw new Error(name + ' has an incomplete MSE recognition parameter.');
			var unknownMseParameter = mseParameters.find(function(parameter) { return !mseCatalog.parameterTypes[parameter[1]]; });
			if (unknownMseParameter) throw new Error(name + ' uses an unknown MSE recognition parameter: ' + unknownMseParameter[1] + '.');
			if (placeholderPattern.test(pattern)) throw new Error(name + ' cannot mix MSE and custom recognition placeholders.');
			if (!pattern.replace(mseParameterPattern, '').trim()) throw new Error(name + ' needs literal text in its pattern.');
		} else {
			if (!pattern.replace(placeholderPattern, '').trim()) throw new Error(name + ' needs literal text in its pattern.');
			var unsupported = pattern.match(/\{([^}]+)\}/g);
			if (unsupported && unsupported.some(function(token) { return !/^\{(?:number|cost|mana|text|word|prefix|english|plural|s)(?::[a-z][a-z0-9_-]*)?\}$/i.test(token); })) {
				throw new Error(name + ' uses an unsupported pattern placeholder.');
			}
		}
		var placement = value.placement === 'inline' ? 'inline' : 'line-end';
		var generatedExample = usesMseSyntax
			? pattern.replace(mseParameterPattern, function(token, parameter) { return mseCatalog.parameterTypes[parameter].example || parameter; })
			: pattern.replace(/\{number(?::[^}]+)?\}/gi, '2').replace(/\{(?:cost|mana)(?::[^}]+)?\}/gi, '{2}').replace(/\{(?:text|prefix)(?::[^}]+)?\}/gi, 'creature').replace(/\{word(?::[^}]+)?\}/gi, 'card').replace(/\{english(?::[^}]+)?\}/gi, 'two').replace(/\{(?:plural|s)(?::[^}]+)?\}/gi, 's');
		var normalized = {
			id: String(value.id || ('custom-' + slug(name) + (index ? '-' + index : ''))),
			name: name,
			pattern: pattern,
			reminder: reminder,
			example: String(value.example || generatedExample),
			priority: Number(value.priority) || 0,
			placement: placement,
			builtIn: false
		};
		if (usesMseSyntax) {
			normalized.mseMatch = pattern;
			normalized.reminderRaw = reminder;
			normalized.mode = 'custom';
		}
		return normalized;
	}

	function getCustomKeywords(targetStorage) {
		var source = targetStorage === undefined ? storage() : targetStorage;
		if (!source) return [];
		try {
			var value = JSON.parse(source.getItem(CUSTOM_STORAGE_KEY) || '[]');
			if (!Array.isArray(value)) return [];
			return value.map(normalizeCustomKeyword);
		} catch (error) {
			return [];
		}
	}

	function saveCustomKeywords(keywords, targetStorage) {
		var source = targetStorage === undefined ? storage() : targetStorage;
		var normalized = (keywords || []).map(normalizeCustomKeyword);
		if (source) source.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(normalized));
		return normalized;
	}

	function getDefinitions(targetStorage) {
		return DEFAULT_KEYWORDS.concat(getCustomKeywords(targetStorage));
	}

	function placeholderSource(name) {
		if (name === 'number') return '(X|[0-9]+)';
		if (name === 'cost') return '((?:\\{(?!\\/?i\\b)[^}\\r\\n]+\\})+|(?!\\{\\/?i\\})[^\\r\\n,;()]+?)';
		if (name === 'mana') return '((?:\\{(?:[0-9]+|[WUBRGCSTXYZEP]|P?[WUBRG]|[WUBRG]{2}P?)\\})+)';
		if (name === 'word') return '([A-Za-z][A-Za-z’\'-]*)';
		if (name === 'english') return '(a|an|one|two|three|four|five|six|seven|eight|nine|ten|X)';
		if (name === 'plural' || name === 's') return '(s?)';
		if (name === 'prefix') return '([^\\r\\n,;().:“”"]+?)';
		return '([^\\r\\n,;()]+?)';
	}

	function compileDefinition(item) {
		if (item.mseMatch) return mseRuntime.compileDefinition(item, mseCatalog);
		var placeholders = [];
		var source = '';
		var lastIndex = 0;
		var matcher = /\{(number|cost|mana|text|word|prefix|english|plural|s)(?::([a-z][a-z0-9_-]*))?\}/gi;
		var match;
		var typeCounts = {};
		while ((match = matcher.exec(item.pattern))) {
			source += escapeRegex(item.pattern.slice(lastIndex, match.index));
			var type = match[1].toLowerCase();
			typeCounts[type] = (typeCounts[type] || 0) + 1;
			var key = match[2] || (typeCounts[type] === 1 ? type : type + typeCounts[type]);
			source += placeholderSource(type);
			placeholders.push({type:type, key:key});
			lastIndex = match.index + match[0].length;
		}
		source += escapeRegex(item.pattern.slice(lastIndex));
		var prefix = item.placement === 'line-end' ? '(^|\\s+)' : '(^|\\r?\\n|\\{lns\\}|[,;]\\s*)';
		return {
			definition: item,
			placeholders: placeholders,
			regex: new RegExp(prefix + '(' + source + ')(?=\\s*(?:$|[.!?]|\\r?\\n|\\{lns\\}|\\{flavor\\}|///|\\{i\\}\\s*\\(|[,;(]))', 'gi')
		};
	}

	function insideParentheses(text, index) {
		var depth = 0;
		for (var position = 0; position < index; position++) {
			if (text[position] === '(') depth++;
			if (text[position] === ')' && depth > 0) depth--;
		}
		return depth > 0;
	}

	function splitRulesAndFlavorText(rawText) {
		var text = String(rawText || '');
		var markers = ['{flavor}', '{oldflavor}', '///'];
		var indices = markers.map(function(marker) { return text.indexOf(marker); }).filter(function(index) { return index >= 0; });
		var flavorIndex = indices.length ? Math.min.apply(Math, indices) : -1;
		return flavorIndex < 0 ? {rulesText:text, flavorText:''} : {rulesText:text.slice(0, flavorIndex), flavorText:text.slice(flavorIndex)};
	}

	function remindersAfter(text, end) {
		var reminders = [];
		var position = end;
		while (position < text.length) {
			var suffix = text.slice(position);
			var opening = suffix.match(/^\s*(?:\{i\})?\(/i);
			if (!opening) break;
			var contentStart = opening[0].length;
			var depth = 1;
			var cursor = contentStart;
			while (cursor < suffix.length && depth > 0) {
				if (suffix[cursor] === '(') depth++;
				if (suffix[cursor] === ')') depth--;
				cursor++;
			}
			if (depth !== 0) break;
			var italicClose = suffix.slice(cursor).match(/^\{\/i\}/i);
			var totalLength = cursor + (italicClose ? italicClose[0].length : 0);
			reminders.push({start:position, end:position + totalLength, text:suffix.slice(contentStart, cursor - 1)});
			position += totalLength;
		}
		return reminders;
	}

	function reminderAfter(text, end, renderedReminder) {
		return remindersAfter(text, end).map(function(reminder) {
			reminder.generated = normalizeForComparison(reminder.text) === normalizeForComparison(renderedReminder);
			return reminder;
		}).find(function(reminder) { return reminder.generated; }) || null;
	}

	function italicFormattingAround(text, start, end) {
		if (start < 3 || text.slice(start - 3, start).toLowerCase() !== '{i}' || text.slice(end, end + 4).toLowerCase() !== '{/i}') return null;
		return {start:start - 3, end:end + 4, generated:true};
	}

	function occurrenceEffect(item) {
		if (item.mode === 'pseudo') return 'italicize';
		return item.mseMatch ? (item.reminderRaw ? 'reminder' : '') : (item.reminder ? 'reminder' : '');
	}

	function normalizeForComparison(value) {
		return String(value || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();
	}

	function renderReminder(item, values) {
		return String(item.reminder || '').replace(/\{([a-z][a-z0-9_-]*)\}/gi, function(token, name) {
			return values[name] == null ? token : values[name];
		});
	}

	function lineEndFor(text, start) {
		var markers = ['\n', '{lns}', '{flavor}', '{oldflavor}', '///'];
		var indices = markers.map(function(marker) { var index = text.indexOf(marker, start); return index < 0 ? text.length : index; });
		return Math.min.apply(Math, indices);
	}

	function lineReminderInsertionAt(text, start) {
		var lineEnd = lineEndFor(text, start);
		var tail = text.slice(start, lineEnd);
		var marker = /\s+(?:\{i\})?\(/ig;
		var found;
		while ((found = marker.exec(tail))) {
			var candidate = start + found.index;
			var reminders = remindersAfter(text, candidate);
			if (reminders.length && reminders[reminders.length - 1].end === lineEnd) return candidate;
		}
		return lineEnd;
	}

	function visibleOccurrenceRange(text, item) {
		var formatting = italicFormattingAround(text, item.start, item.end);
		return {start:formatting ? formatting.start : item.start, end:formatting ? formatting.end : item.end};
	}

	function commaSequenceInsertionAt(text, item, selected) {
		var itemIndex = selected.indexOf(item);
		var range = visibleOccurrenceRange(text, item);
		var end = range.end;
		for (var index = itemIndex + 1; index < selected.length; index++) {
			var next = selected[index];
			var nextRange = visibleOccurrenceRange(text, next);
			if (!/^\s*,\s*$/.test(text.slice(end, nextRange.start))) break;
			end = nextRange.end;
		}
		return end;
	}

	function findOccurrences(rawText, definitions, context) {
		var split = splitRulesAndFlavorText(rawText);
		var candidates = [];
		(definitions || getDefinitions()).forEach(function(item) {
			var compiled = compileDefinition(item);
			var match;
			while ((match = compiled.regex.exec(split.rulesText))) {
				var prefix = match[1] || '';
				var keywordText = match[2] || '';
				if (insideParentheses(split.rulesText, match.index + prefix.length)) continue;
				var values = {};
				var parameters = [];
				if (item.mseMatch) {
					parameters = compiled.parameters.map(function(parameter, index) {
						return mseRuntime.stripParameterSeparators(match[index + 3], parameter.spec);
					});
					parameters.forEach(function(parameter, index) { values['param' + (index + 1)] = parameter.value; });
				} else {
					compiled.placeholders.forEach(function(placeholder, index) { values[placeholder.key] = match[index + 3]; });
				}
				var keywordStart = match.index + prefix.length;
				var keywordEnd = keywordStart + keywordText.length;
				candidates.push({
					definition: item,
					effect:occurrenceEffect(item),
					start: keywordStart,
					end: keywordEnd,
					insertionAt: keywordEnd,
					keywordText: keywordText,
					values: values,
					parameters:parameters,
					missingParameters:parameters.filter(function(parameter) { return !parameter.raw; }).length,
					specificity:compiled.specificity || 0,
					renderedReminder: item.mseMatch ? mseRuntime.renderReminder(item, parameters, context || {}) : renderReminder(item, values)
				});
				if (!match[0].length) compiled.regex.lastIndex++;
			}
		});
		candidates.sort(function(left, right) {
			return left.start - right.start || left.missingParameters - right.missingParameters || right.end - left.end || Number(left.definition.builtIn) - Number(right.definition.builtIn) || (right.definition.priority || 0) - (left.definition.priority || 0) || right.specificity - left.specificity;
		});
		var selected = [];
		candidates.forEach(function(candidate) {
			if (selected.some(function(item) { return candidate.start < item.end && candidate.end > item.start; })) return;
			selected.push(candidate);
		});
		selected.sort(function(left, right) { return left.start - right.start; });
		var counts = {};
		selected.forEach(function(item) {
			item.formatting = item.effect === 'italicize' ? italicFormattingAround(split.rulesText, item.start, item.end) : null;
			item.insertionAt = item.definition.placement === 'line-end'
				? lineReminderInsertionAt(split.rulesText, item.end)
				: commaSequenceInsertionAt(split.rulesText, item, selected);
			var ordinal = counts[item.definition.id] || 0;
			counts[item.definition.id] = ordinal + 1;
			item.ordinal = ordinal;
			item.signature = item.definition.id + ':' + ordinal;
			item.reminder = item.effect === 'reminder' ? reminderAfter(split.rulesText, item.insertionAt, item.renderedReminder) : null;
			item.hasReminder = Boolean(item.reminder);
			item.hasGeneratedReminder = Boolean(item.reminder && item.reminder.generated);
			item.hasGeneratedFormatting = Boolean(item.formatting && item.formatting.generated);
			item.hasGeneratedEffect = item.effect === 'italicize' ? item.hasGeneratedFormatting : item.hasGeneratedReminder;
		});
		return selected;
	}

	function applyAll(rawText, definitions, context) {
		var text = String(rawText || '');
		var occurrences = findOccurrences(text, definitions, context);
		var changes = [];
		occurrences.slice().reverse().forEach(function(item) {
			if (!item.effect || item.hasGeneratedEffect) return;
			if (item.effect === 'italicize') {
				text = text.slice(0, item.start) + '{i}' + text.slice(item.start, item.end) + '{/i}' + text.slice(item.end);
				changes.push({at:item.start, length:7, signature:item.signature, effect:item.effect});
				return;
			}
			if (!item.renderedReminder) return;
			var insertion = ' {i}(' + item.renderedReminder + '){/i}';
			text = text.slice(0, item.insertionAt) + insertion + text.slice(item.insertionAt);
			changes.push({at:item.insertionAt, length:insertion.length, signature:item.signature, effect:item.effect});
		});
		return {text:text, changes:changes.reverse(), occurrences:findOccurrences(text, definitions, context)};
	}

	function toggleOccurrence(rawText, suppressions, signature, enabled, definitions, context) {
		var text = String(rawText || '');
		var occurrence = findOccurrences(text, definitions, context).find(function(item) { return item.signature === signature; });
		if (!occurrence || !occurrence.effect) return {text:text, suppressions:[], changes:[], occurrences:findOccurrences(text, definitions, context)};
		if (enabled && !occurrence.hasGeneratedEffect) {
			if (occurrence.effect === 'italicize') {
				text = text.slice(0, occurrence.start) + '{i}' + text.slice(occurrence.start, occurrence.end) + '{/i}' + text.slice(occurrence.end);
				return {text:text, suppressions:[], changes:[{at:occurrence.start, length:7, signature:signature, effect:occurrence.effect}], occurrences:findOccurrences(text, definitions, context)};
			}
			if (occurrence.renderedReminder) {
				var insertion = ' {i}(' + occurrence.renderedReminder + '){/i}';
				text = text.slice(0, occurrence.insertionAt) + insertion + text.slice(occurrence.insertionAt);
				return {text:text, suppressions:[], changes:[{at:occurrence.insertionAt, length:insertion.length, signature:signature, effect:occurrence.effect}], occurrences:findOccurrences(text, definitions, context)};
			}
		}
		if (!enabled && occurrence.effect === 'italicize' && occurrence.formatting && occurrence.formatting.generated) {
			text = text.slice(0, occurrence.formatting.start) + occurrence.keywordText + text.slice(occurrence.formatting.end);
		}
		if (!enabled && occurrence.reminder && occurrence.reminder.generated) {
			text = text.slice(0, occurrence.reminder.start) + text.slice(occurrence.reminder.end);
		}
		return {text:text, suppressions:[], changes:[], occurrences:findOccurrences(text, definitions, context)};
	}

	function serializeCustomKeywords(keywords) {
		return JSON.stringify({
			format: EXPORT_FORMAT,
			schemaVersion: EXPORT_SCHEMA_VERSION,
			exportedAt: new Date().toISOString(),
			keywords: (keywords || getCustomKeywords()).map(function(item) {
				return {id:item.id, name:item.name, pattern:item.pattern, reminder:item.reminder, example:item.example, placement:item.placement || 'inline'};
			})
		}, null, 2);
	}

	function parseCustomKeywords(value) {
		var parsed = typeof value === 'string' ? JSON.parse(value) : value;
		if (!parsed || parsed.format !== EXPORT_FORMAT) throw new Error('This is not a Set Conjurer keyword export.');
		if (parsed.schemaVersion !== EXPORT_SCHEMA_VERSION) throw new Error('This keyword export uses an unsupported schema version.');
		if (!Array.isArray(parsed.keywords)) throw new Error('The keyword export is missing its keyword list.');
		return parsed.keywords.map(normalizeCustomKeyword);
	}

	function mergeCustomKeywords(imported, existing) {
		var byId = new Map((existing || getCustomKeywords()).map(function(item) { return [item.id, item]; }));
		(imported || []).map(normalizeCustomKeyword).forEach(function(item) { byId.set(item.id, item); });
		return Array.from(byId.values());
	}

	function activeCardContext(rulesText) {
		var activeCard = root && root.card ? root.card : {};
		return {
			typeLine:activeCard.text && activeCard.text.type ? activeCard.text.type.text : '',
			subType:activeCard.text && activeCard.text.type ? String(activeCard.text.type.text || '').split(/[—-]/)[1] || '' : '',
			manaCost:activeCard.text && activeCard.text.mana ? activeCard.text.mana.text : '',
			rulesText:rulesText === undefined ? (activeCard.text && activeCard.text.rules ? activeCard.text.rules.text : '') : String(rulesText || '')
		};
	}

	function renderOccurrenceControls(container, input, textObject, onChange) {
		if (!container || !input || !textObject) return;
		var context = activeCardContext(input.value);
		var occurrences = findOccurrences(input.value, undefined, context).filter(function(item) { return Boolean(item.effect); });
		container.replaceChildren();
		container.classList.toggle('hidden', occurrences.length === 0);
		if (!occurrences.length) return;
		var heading = document.createElement('div');
		heading.className = 'keyword-occurrence-heading';
		heading.innerHTML = '<strong>Keyword options</strong>';
		container.appendChild(heading);
		occurrences.forEach(function(item) {
			var label = document.createElement('label');
			label.className = 'checkbox-container input workspace-checkbox frame-advanced-option keyword-occurrence-row';
			var description = item.effect === 'italicize' ? 'Italicize this MSE ability word.' : item.renderedReminder;
			label.innerHTML = '<span class="frame-advanced-option-copy"><strong>' + escapeHtml(item.keywordText) + '</strong><small>' + escapeHtml(description) + '</small></span><input type="checkbox"><span class="checkmark"></span>';
			var checkbox = label.querySelector('input');
			checkbox.checked = item.hasGeneratedEffect;
			var action = item.effect === 'italicize' ? 'MSE italics for ' : 'reminder text for ';
			checkbox.setAttribute('aria-label', (checkbox.checked ? 'Remove ' : 'Add ') + action + item.keywordText);
			checkbox.addEventListener('change', function() {
				var result = toggleOccurrence(input.value, [], item.signature, checkbox.checked, undefined, context);
				delete textObject.keywordReminderSuppressions;
				input.value = result.text;
				if (typeof onChange === 'function') onChange(result);
			});
			container.appendChild(label);
		});
	}

	function dispatchChanged() {
		if (!root || !root.document) return;
		root.document.dispatchEvent(new CustomEvent('cardconjurer:keywords-changed'));
	}

	function status(message, isError) {
		var element = root.document.querySelector('#keyword-manager-status');
		if (!element) return;
		element.textContent = message || '';
		element.classList.toggle('is-error', Boolean(isError));
		element.hidden = !message;
	}

	function managerDefinitionId(item) {
		return (item.builtIn ? 'mse-' : '') + item.id;
	}

	function managerDefinitions() {
		return getDefinitions().slice().sort(function(left, right) {
			return left.name.localeCompare(right.name, undefined, {sensitivity:'base'}) || managerDefinitionId(left).localeCompare(managerDefinitionId(right));
		});
	}

	function managerRecognition(item) {
		return item.displayPattern || item.mseMatch || item.pattern || '';
	}

	function managerReminder(item) {
		if (item.reminderRaw && item.builtIn) {
			var occurrence = findOccurrences(item.example, [item], {typeLine:'Creature'})[0];
			if (occurrence && occurrence.renderedReminder) return occurrence.renderedReminder;
		}
		if (item.reminderRaw || item.reminder) return item.reminderRaw || item.reminder;
		if (item.mode === 'pseudo') {
			if (!item.rulesRaw) return 'MSE italicizes the matched ability word.';
			var effectSentinel = '__MSE_EFFECT__';
			return mseRuntime.normalizeMarkup(item.rulesRaw.replace(/\[effect\]/gi, effectSentinel), [], {typeLine:'Creature'}).replace(effectSentinel, '[effect]');
		}
		return item.rulesRaw || 'No reminder text.';
	}

	function previewCustomKeyword(value, context) {
		var example = String(value && value.example || '').trim();
		if (!example) return {state:'empty', text:'', message:'Enter a test example to preview the expanded keyword.'};
		var item;
		try { item = normalizeCustomKeyword(value); }
		catch (error) { return {state:'incomplete', text:example, message:error.message}; }
		var occurrences = findOccurrences(example, [item], context || {});
		if (!occurrences.length) return {state:'no-match', text:example, message:'The recognition pattern does not match this test example.'};
		var alreadyExpanded = occurrences.some(function(occurrence) { return occurrence.hasGeneratedEffect; });
		var result = applyAll(example, [item], context || {});
		return {
			state:'match',
			text:result.text,
			message:alreadyExpanded ? 'The existing reminder matches, so its checkbox will start checked.' : 'Preview after selecting this keyword’s checkbox.'
		};
	}

	function appendPreviewText(container, value) {
		var current = container;
		var source = String(value || '');
		var lastIndex = 0;
		var matcher = /\{\/?i\}|\{[^{}\r\n]+\}/gi;
		var match;
		function appendPlain(target, text) {
			String(text).split('\n').forEach(function(line, index) {
				if (index) target.appendChild(root.document.createElement('br'));
				if (line) target.appendChild(root.document.createTextNode(line));
			});
		}
		while ((match = matcher.exec(source))) {
			appendPlain(current, source.slice(lastIndex, match.index));
			if (match[0].toLowerCase() === '{i}') {
				current = root.document.createElement('em');
				container.appendChild(current);
			} else if (match[0].toLowerCase() === '{/i}') {
				current = container;
			} else {
				var symbolCode = match[0].slice(1, -1);
				var symbolPath = /^[a-z0-9+\/-]+$/i.test(symbolCode) ? symbolCode.toLowerCase().replace(/\//g, '') : '';
				if (!symbolPath) appendPlain(current, match[0]);
				else {
					var image = root.document.createElement('img');
					image.className = 'keyword-preview-mana';
					image.src = '/img/manaSymbols/' + symbolPath + '.svg';
					image.alt = match[0];
					image.addEventListener('error', function(event) { event.currentTarget.replaceWith(root.document.createTextNode(event.currentTarget.alt)); });
					current.appendChild(image);
				}
			}
			lastIndex = match.index + match[0].length;
		}
		appendPlain(current, source.slice(lastIndex));
	}

	function renderCustomPreview() {
		if (!root || !root.document) return;
		var preview = root.document.querySelector('#keyword-custom-preview');
		var output = root.document.querySelector('#keyword-custom-preview-output');
		if (!preview || !output) return;
		var existingItem = editingCustomId && getCustomKeywords().find(function(item) { return item.id === editingCustomId; });
		var result = previewCustomKeyword({
			id:editingCustomId || undefined,
			name:root.document.querySelector('#keyword-custom-name').value,
			pattern:root.document.querySelector('#keyword-custom-pattern').value,
			reminder:root.document.querySelector('#keyword-custom-reminder').value,
			example:root.document.querySelector('#keyword-custom-example').value,
			placement:existingItem && existingItem.placement || 'line-end'
		}, activeCardContext());
		preview.dataset.state = result.state;
		output.replaceChildren();
		if (result.text) appendPreviewText(output, result.text);
		else output.textContent = result.message;
	}

	function renderKeywordList() {
		if (!root || !root.document) return;
		var list = root.document.querySelector('#keyword-library-list');
		var search = root.document.querySelector('#keyword-search');
		if (!list) return;
		var query = String(search && search.value || '').trim().toLocaleLowerCase();
		var items = managerDefinitions().filter(function(item) {
			if (!query) return true;
			return [item.name, managerRecognition(item), managerReminder(item), item.example].join('\n').toLocaleLowerCase().includes(query);
		});
		list.innerHTML = items.map(function(item) {
			var managerId = managerDefinitionId(item);
			var selected = managerId === selectedKeywordId;
			var source = item.builtIn ? 'built-in' : 'custom';
			var tag = item.builtIn ? (item.mode || 'keyword') : 'custom';
			var actions = item.builtIn ? '' : '<div class="keyword-library-actions"><button type="button" class="text-field-layout-button" data-keyword-edit>Edit</button><button type="button" class="text-field-layout-button danger" data-keyword-remove>Remove</button></div>';
			return '<article class="keyword-library-row' + (selected ? ' selected' : '') + '" role="listitem" data-keyword-id="' + escapeHtml(item.id) + '" data-keyword-manager-id="' + escapeHtml(managerId) + '" data-keyword-source="' + source + '">' +
				'<button type="button" class="keyword-library-summary" aria-expanded="' + selected + '"><strong>' + escapeHtml(item.name) + '</strong><em>' + escapeHtml(tag) + '</em></button>' +
				'<div class="keyword-library-details"' + (selected ? '' : ' hidden') + '><dl><div><dt>Recognition pattern</dt><dd>' + escapeHtml(managerRecognition(item)) + '</dd></div><div><dt>Reminder text</dt><dd>' + escapeHtml(managerReminder(item)) + '</dd></div><div><dt>Example</dt><dd>' + escapeHtml(item.example || 'No example provided.') + '</dd></div></dl>' + actions + '</div>' +
			'</article>';
		}).join('');
	}

	function renderManager() {
		if (!root || !root.document) return;
		renderKeywordList();
	}

	function resetForm() {
		editingCustomId = '';
		var form = root.document.querySelector('#keyword-custom-form');
		if (form) { form.reset(); form.classList.add('hidden'); }
		var submit = root.document.querySelector('#keyword-custom-save');
		if (submit) submit.textContent = 'Add Keyword';
		var toggle = root.document.querySelector('#keyword-custom-toggle');
		if (toggle) { toggle.textContent = 'Add'; toggle.setAttribute('aria-expanded', 'false'); }
		closeKeywordHelp(false);
		renderCustomPreview();
		status('');
	}

	function openCustomForm(item) {
		var form = root.document.querySelector('#keyword-custom-form');
		if (!form) return;
		editingCustomId = item && item.id || '';
		form.reset();
		if (item) {
			root.document.querySelector('#keyword-custom-name').value = item.name;
			root.document.querySelector('#keyword-custom-pattern').value = item.pattern;
			root.document.querySelector('#keyword-custom-reminder').value = item.reminder;
			root.document.querySelector('#keyword-custom-example').value = item.example || '';
		}
		form.classList.remove('hidden');
		root.document.querySelector('#keyword-custom-save').textContent = item ? 'Save Keyword' : 'Add Keyword';
		var toggle = root.document.querySelector('#keyword-custom-toggle');
		toggle.textContent = 'Cancel';
		toggle.setAttribute('aria-expanded', 'true');
		renderCustomPreview();
		status('');
		root.document.querySelector('#keyword-custom-name').focus();
	}

	function editKeyword(id) {
		var item = getCustomKeywords().find(function(keyword) { return keyword.id === id; });
		if (!item) return;
		openCustomForm(item);
	}

	async function exportCustomKeywords() {
		var content = serializeCustomKeywords();
		if (root.setConjurerDesktop && root.setConjurerDesktop.files && root.setConjurerDesktop.files.saveExport) {
			await root.setConjurerDesktop.files.saveExport({suggestedName:'set-conjurer-keywords.json', extension:'json', content:content});
			return;
		}
		var blob = new Blob([content], {type:'application/json'});
		var link = root.document.createElement('a');
		link.href = URL.createObjectURL(blob);
		link.download = 'set-conjurer-keywords.json';
		link.click();
		setTimeout(function() { URL.revokeObjectURL(link.href); }, 0);
	}

	function openKeywordHelp(trigger) {
		var drawer = root.document.querySelector('#keyword-help-drawer');
		if (!drawer) return;
		drawer.dataset.returnFocus = trigger && trigger.id || '';
		drawer.classList.add('opened');
		drawer.setAttribute('aria-hidden', 'false');
		drawer.querySelector('.textbox-editor-close').focus({preventScroll:true});
	}

	function closeKeywordHelp(returnFocus) {
		var drawer = root && root.document && root.document.querySelector('#keyword-help-drawer');
		if (!drawer) return;
		drawer.classList.remove('opened');
		drawer.setAttribute('aria-hidden', 'true');
		if (returnFocus === false) return;
		var target = drawer.dataset.returnFocus && root.document.getElementById(drawer.dataset.returnFocus);
		if (target && target.isConnected) target.focus({preventScroll:true});
	}

	function openManager(trigger) {
		var drawer = root.document.querySelector('#keyword-manager-drawer');
		if (!drawer) return;
		drawer.dataset.returnFocus = trigger && trigger.id || '';
		drawer.classList.add('opened');
		drawer.setAttribute('aria-hidden', 'false');
		resetForm();
		renderManager();
		drawer.querySelector('.textbox-editor-close').focus({preventScroll:true});
	}

	function closeManager() {
		var drawer = root.document.querySelector('#keyword-manager-drawer');
		if (!drawer) return;
		closeKeywordHelp(false);
		drawer.classList.remove('opened');
		drawer.setAttribute('aria-hidden', 'true');
		var returnFocus = drawer.dataset.returnFocus && root.document.getElementById(drawer.dataset.returnFocus);
		if (returnFocus) returnFocus.focus({preventScroll:true});
	}

	function initializeManager() {
		if (initialized || !root || !root.document) return;
		var drawer = root.document.querySelector('#keyword-manager-drawer');
		var openButton = root.document.querySelector('#keyword-manager-open');
		if (!drawer || !openButton) return;
		initialized = true;
		openButton.addEventListener('click', function() { openManager(openButton); });
		drawer.querySelector('.textbox-editor-close').addEventListener('click', closeManager);
		root.document.querySelector('#keyword-custom-form').addEventListener('submit', function(event) {
			event.preventDefault();
			try {
				var existingItem = editingCustomId && getCustomKeywords().find(function(keyword) { return keyword.id === editingCustomId; });
				var item = normalizeCustomKeyword({
					id: editingCustomId || undefined,
					name: root.document.querySelector('#keyword-custom-name').value,
					pattern: root.document.querySelector('#keyword-custom-pattern').value,
					placement: existingItem && existingItem.placement || 'line-end',
					reminder: root.document.querySelector('#keyword-custom-reminder').value,
					example: root.document.querySelector('#keyword-custom-example').value
				});
				var keywords = getCustomKeywords().filter(function(keyword) { return keyword.id !== item.id; });
				keywords.push(item);
				saveCustomKeywords(keywords);
				selectedKeywordId = managerDefinitionId(item);
				resetForm(); renderManager(); dispatchChanged();
			} catch (error) { status(error.message, true); }
		});
		root.document.querySelector('#keyword-custom-toggle').addEventListener('click', function() {
			if (root.document.querySelector('#keyword-custom-form').classList.contains('hidden')) openCustomForm();
			else resetForm();
		});
		root.document.querySelector('#keyword-custom-form').addEventListener('input', renderCustomPreview);
		root.document.querySelector('#keyword-help-open').addEventListener('click', function(event) { openKeywordHelp(event.currentTarget); });
		root.document.querySelector('#keyword-help-drawer .textbox-editor-close').addEventListener('click', function() { closeKeywordHelp(true); });
		root.document.querySelector('#keyword-library-list').addEventListener('click', function(event) {
			var row = event.target.closest('[data-keyword-id]');
			if (!row) return;
			if (event.target.closest('[data-keyword-edit]')) editKeyword(row.dataset.keywordId);
			if (event.target.closest('[data-keyword-remove]')) {
				var item = getCustomKeywords().find(function(keyword) { return keyword.id === row.dataset.keywordId; });
				if (!item || !root.confirm('Remove the custom keyword “' + item.name + '”?')) return;
				saveCustomKeywords(getCustomKeywords().filter(function(keyword) { return keyword.id !== item.id; }));
				if (selectedKeywordId === row.dataset.keywordManagerId) selectedKeywordId = '';
				resetForm(); renderManager(); dispatchChanged();
			}
			if (event.target.closest('.keyword-library-summary')) {
				selectedKeywordId = selectedKeywordId === row.dataset.keywordManagerId ? '' : row.dataset.keywordManagerId;
				renderKeywordList();
			}
		});
		root.document.querySelector('#keyword-export').addEventListener('click', function() {
			exportCustomKeywords().then(function() { status(''); }).catch(function(error) { status(error.message, true); });
		});
		root.document.querySelector('#keyword-import').addEventListener('click', function() { root.document.querySelector('#keyword-import-file').click(); });
		root.document.querySelector('#keyword-import-file').addEventListener('change', async function(event) {
			var file = event.target.files && event.target.files[0];
			if (!file) return;
			try {
				var imported = parseCustomKeywords(await file.text());
				var merged = mergeCustomKeywords(imported, getCustomKeywords());
				saveCustomKeywords(merged); renderManager(); status(''); dispatchChanged();
			} catch (error) { status(error.message, true); }
			event.target.value = '';
		});
		root.document.querySelector('#keyword-search').addEventListener('input', renderKeywordList);
		root.document.querySelector('#keyword-search-clear').addEventListener('click', function() {
			var search = root.document.querySelector('#keyword-search');
			search.value = '';
			renderKeywordList();
			search.focus();
		});
		root.document.addEventListener('keydown', function(event) {
			if (event.key !== 'Escape') return;
			if (root.document.querySelector('#keyword-help-drawer').classList.contains('opened')) closeKeywordHelp(true);
			else if (drawer.classList.contains('opened')) closeManager();
		});
		renderManager();
	}

	return {
		CUSTOM_STORAGE_KEY: CUSTOM_STORAGE_KEY,
		EXPORT_FORMAT: EXPORT_FORMAT,
		EXPORT_SCHEMA_VERSION: EXPORT_SCHEMA_VERSION,
		DEFAULT_KEYWORDS: DEFAULT_KEYWORDS,
		MSE_CATALOG_SOURCE:mseCatalog.source,
		MSE_CATALOG_MODE_COUNTS:DEFAULT_KEYWORDS.reduce(function(counts, item) { counts[item.mode] = (counts[item.mode] || 0) + 1; return counts; }, {}),
		normalizeCustomKeyword: normalizeCustomKeyword,
		getCustomKeywords: getCustomKeywords,
		saveCustomKeywords: saveCustomKeywords,
		getDefinitions: getDefinitions,
		compileDefinition: compileDefinition,
		findOccurrences: findOccurrences,
		applyAll: applyAll,
		toggleOccurrence: toggleOccurrence,
		serializeCustomKeywords: serializeCustomKeywords,
		parseCustomKeywords: parseCustomKeywords,
		mergeCustomKeywords: mergeCustomKeywords,
		previewCustomKeyword: previewCustomKeyword,
		managerRecognition: managerRecognition,
		managerReminder: managerReminder,
		renderOccurrenceControls: renderOccurrenceControls,
		initializeManager: initializeManager,
		openManager: openManager,
		closeManager: closeManager
	};
});
