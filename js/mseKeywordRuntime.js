(function(root, factory) {
	var api = factory();
	if (typeof module === 'object' && module.exports) module.exports = api;
	if (root) root.CardConjurerMseKeywordRuntime = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
	'use strict';

	function escapeRegex(value) {
		return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	function nonCapturing(source) {
		var output = '';
		var escaped = false;
		var inClass = false;
		for (var index = 0; index < source.length; index++) {
			var character = source[index];
			if (escaped) { output += character; escaped = false; continue; }
			if (character === '\\') { output += character; escaped = true; continue; }
			if (character === '[') inClass = true;
			if (character === ']') inClass = false;
			if (character === '(' && !inClass && source[index + 1] !== '?') output += '(?:';
			else output += character;
		}
		return output;
	}

	function parameterSource(spec, hasLaterParameter) {
		if (spec.name === 'mana') return '(?:(?:\\{[^}\\r\\n]+\\})+|[HSVCTQXYZI0-9WUBRG/|]+)';
		if (spec.name === 'cost') return '(?:(?:[ ](?:\\{[^}\\r\\n]+\\})+)|(?:[-—](?:(?!\\s*\\{i\\})[^(\r\n])*)|(?:[ ][HSVECTQXYZI0-9WUBRG/|]*))';
		if (spec.name === 'name') return '(?:[^({\\r\\n​.:;—]*' + (hasLaterParameter ? '?' : '') + '[^\\s({\\r\\n​.:;—][({​.:;—]?|[ ])';
		return nonCapturing(spec.match || '.+?');
	}

	function splitMseMatch(match) {
		var parts = [];
		var lastIndex = 0;
		var matcher = /<atom-param[^>]*>([^<]+)<\/atom-param>/g;
		var found;
		while ((found = matcher.exec(match))) {
			parts.push({literal:match.slice(lastIndex, found.index), parameter:found[1]});
			lastIndex = found.index + found[0].length;
		}
		parts.push({literal:match.slice(lastIndex), parameter:''});
		return parts;
	}

	function suffixMatch(text, source) {
		if (!source) return null;
		try { return text.match(new RegExp('(?:' + source + ')$')); }
		catch (error) { return null; }
	}

	function prefixMatch(text, source) {
		if (!source) return null;
		try { return text.match(new RegExp('^(?:' + source + ')')); }
		catch (error) { return null; }
	}

	function compileDefinition(item, catalog) {
		var parameters = [];
		var source = '';
		var matchPattern = item.runtimeMatch || item.mseMatch || item.pattern || item.name;
		var parts = splitMseMatch(matchPattern);
		parts.forEach(function(part, index) {
			var literal = part.literal;
			if (index > 0) {
				var previous = parameters[parameters.length - 1];
				var after = prefixMatch(literal, previous.spec.separatorAfter);
				if (after) literal = literal.slice(after[0].length);
			}
			if (!part.parameter) { source += escapeRegex(literal); return; }
			var spec = catalog.parameterTypes[part.parameter];
			if (!spec) throw new Error('Unknown MSE keyword parameter: ' + part.parameter);
			var before = suffixMatch(literal, spec.separatorBefore);
			if (before) literal = literal.slice(0, -before[0].length);
			source += escapeRegex(literal);
			var hasLaterParameter = parts.slice(index + 1).some(function(nextPart) { return Boolean(nextPart.parameter); });
			source += '(' + parameterSource(spec, hasLaterParameter) + ')' + (spec.optional ? '?' : '');
			parameters.push({type:part.parameter, spec:spec});
		});
		return {
			definition:item,
			parameters:parameters,
			specificity:String(matchPattern).replace(/<atom-param[^>]*>[^<]+<\/atom-param>/g, '').length,
			regex:new RegExp('(^|[^A-Za-z0-9])(' + source + ')(?=$|[^A-Za-z0-9(])', 'gi')
		};
	}

	function stripParameterSeparators(value, spec) {
		var raw = String(value || '');
		var before = prefixMatch(raw, spec.separatorBefore);
		var after = suffixMatch(raw, spec.separatorAfter);
		var start = before ? before[0].length : 0;
		var end = after ? raw.length - after[0].length : raw.length;
		return {
			type:spec.name,
			raw:raw,
			value:raw.slice(start, Math.max(start, end)),
			separatorBefore:before ? before[0] : '',
			separatorAfter:after ? after[0] : ''
		};
	}

	function numberValue(value) {
		var string = String(value == null ? '' : value).trim().toLowerCase();
		var words = {a:1, an:1, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10};
		if (Object.prototype.hasOwnProperty.call(words, string)) return words[string];
		var parsed = Number(string.replace('%', ''));
		return Number.isFinite(parsed) ? parsed : string.toUpperCase() === 'X' ? 'X' : 0;
	}

	var englishNumbers = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];
	var ordinalNumbers = ['zeroth','first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth','thirteenth','fourteenth','fifteenth','sixteenth','seventeenth','eighteenth','nineteenth','twentieth'];

	function englishNumber(value, mode) {
		var number = numberValue(value && value.value != null ? value.value : value);
		if (number === 'X') return 'X';
		if (mode === 'multiple' && number === 1) return '';
		if (mode === 'a' && number === 1) return 'a';
		if (mode === 'ordinal') return ordinalNumbers[number] || String(number) + 'th';
		return englishNumbers[number] || String(number);
	}

	function singular(value) {
		var text = String(value || '');
		if (/ies$/i.test(text)) return text.replace(/ies$/i, 'y');
		if (/ses$/i.test(text)) return text.replace(/es$/i, '');
		return text.replace(/s$/i, '');
	}

	function plural(value) {
		var text = String(value || '');
		if (/[^aeiou]y$/i.test(text)) return text.slice(0, -1) + 'ies';
		if (/(s|x|z|ch|sh)$/i.test(text)) return text + 'es';
		return /s$/i.test(text) ? text : text + 's';
	}

	function tokenize(source) {
		var tokens = [];
		var index = 0;
		while (index < source.length) {
			var character = source[index];
			if (/\s/.test(character)) { index++; continue; }
			if (character === '"') {
				var value = '';
				index++;
				while (index < source.length && source[index] !== '"') {
					if (source[index] === '\\' && index + 1 < source.length) index++;
					value += source[index++];
				}
				index++;
				tokens.push({type:'string', value:value});
				continue;
			}
			var operator = source.slice(index).match(/^(==|!=|>=|<=|:=)/);
			if (operator) { tokens.push({type:'operator', value:operator[1]}); index += operator[1].length; continue; }
			var number = source.slice(index).match(/^\d+(?:\.\d+)?/);
			if (number) { tokens.push({type:'number', value:Number(number[0])}); index += number[0].length; continue; }
			var identifier = source.slice(index).match(/^[A-Za-z_][A-Za-z0-9_.]*/);
			if (identifier) { tokens.push({type:'identifier', value:identifier[0]}); index += identifier[0].length; continue; }
			tokens.push({type:'punctuation', value:character});
			index++;
		}
		return tokens;
	}

	function primitive(value) {
		return value && typeof value === 'object' && value.value != null ? value.value : value;
	}

	function truthy(value) {
		var raw = primitive(value);
		return Boolean(raw && raw !== 'false' && raw !== 0);
	}

	function cardContext(context) {
		var typeLine = String(context.typeLine || context.type || '');
		return {
			type:typeLine,
			super_type:typeLine,
			sub_type:String(context.subType || typeLine.split(/[—-]/)[1] || '').trim(),
			text:String(context.rulesText || ''),
			rule_text:String(context.rulesText || ''),
			casting_cost:String(context.manaCost || '')
		};
	}

	function callFunction(name, positional, named, environment) {
		var first = primitive(positional[0]);
		if (name === 'this_or_that') {
			var kind = first || 'type';
			if (kind === 'type') kind = environment.hasPt ? 'creature' : (environment.isSpell ? 'spell' : 'permanent');
			var phrase = 'this ' + kind;
			return named.upper === true ? phrase[0].toUpperCase() + phrase.slice(1) : phrase;
		}
		if (name === 'english_number') return englishNumber(first, 'normal');
		if (name === 'english_number_a') return englishNumber(first, 'a');
		if (name === 'english_number_multiple') return englishNumber(first, 'multiple');
		if (name === 'english_number_ordinal') return englishNumber(first, 'ordinal');
		if (name === 'digital_number') return numberValue(first);
		if (name === 'english_singular') return singular(first);
		if (name === 'english_plural') return plural(first);
		if (name === 'to_lower') return String(first || '').toLowerCase();
		if (name === 'separate_words') return String(first || '').trim().split(/\s+/).filter(Boolean).join(named.spacer == null ? ' ' : named.spacer);
		if (name === 'for_mana_costs') {
			var parameter = positional.find(function(value) { return value && typeof value === 'object' && value.value != null; }) || positional[positional.length - 1];
			var cost = String(primitive(parameter) || '').trim();
			if (!cost) return named.non || '';
			if (/^[—-]/.test(cost)) return cost.replace(/^[—-]\s*/, '');
			return String(named.add || '') + cost;
		}
		if (name === 'handle_action_rt') return positional.length ? primitive(positional[positional.length - 1]) : named.to || '';
		if (name === 'handle_merged_rt') return named.moved || primitive(positional[0]) || '';
		if (name === 'protection_code') return 'This permanent can’t be blocked, targeted, dealt damage, enchanted, or equipped by anything ' + first;
		if (name === 'color_to_mana') return ({white:'{W}', blue:'{U}', black:'{B}', red:'{R}', green:'{G}'})[String(first).toLowerCase()] || first;
		if (name === 'legend_filter') return first;
		if (name === 'craft_code') return 'Craft with ' + primitive(named.param1 || positional[0]) + ' ' + primitive(named.param2 || positional[1]);
		if (name === 'phy_reminder') return 'You may pay 2 life for each Phyrexian mana symbol in this cost.';
		if (name === 'contains') return String(first || '').includes(String(named.match == null ? positional[1] || '' : named.match).replace(/^|$/g, ''));
		if (name === 'match') { try { return new RegExp(String(named.match || positional[1] || '')).test(String(first || '')); } catch (error) { return false; } }
		if (name === 'has_pt') return environment.hasPt;
		if (name === 'has_cc') return Boolean(environment.card.casting_cost);
		if (name === 'is_targeted') return /\btarget\b/i.test(environment.card.text);
		if (name === 'is_spell') return /\b(instant|sorcery)\b/i.test(String(first || environment.card.type));
		if (name === 'is_artifact') return /\bartifact\b/i.test(String(first || ''));
		if (name === 'is_enchantment') return /\benchantment\b/i.test(String(first || ''));
		if (name === 'is_creaturish') return /\bcreature\b/i.test(String(first || ''));
		if (name === 'is_mana_cost') return /^(?:\{[^}]+\})+$/.test(String(first || '').trim());
		if (name === 'generic_mana') return (String(first || '').match(/\{(\d+)\}/) || [,'0'])[1];
		if (name === 'to_number') return Number(first) || 0;
		if (name === 'station_number') return 0;
		if (name === 'lang_setting') return function() { return false; };
		return '';
	}

	function evaluateExpression(source, parameters, context) {
		if (/^\s*v\s*:=\s*to_number\(param1\.value\)/.test(source)) {
			var firebending = numberValue(parameters[0] && parameters[0].value);
			if (!firebending) return String(parameters[0] && parameters[0].value || '') + ' {R}';
			if (firebending > 5) return englishNumber(firebending) + ' {R}';
			return Array.from({length:firebending}, function() { return '{R}'; }).join('');
		}
		if (/^\s*sn\s*:=\s*station_number\(\)/.test(source)) return '';
		if (/^\s*if\s+lang_setting\("is_spacecraft"\)/.test(source)) {
			var subtype = String((context || {}).subType || (context || {}).typeLine || '');
			if (/spacecraft/i.test(subtype)) return 'Spacecraft';
			if (/planet/i.test(subtype)) return 'Planet';
			return 'permanent';
		}
		if (/\bfor\s+\w+\s+from\b|:=/.test(source)) return '';
		var tokens = tokenize(source);
		var cursor = 0;
		var environment = {
			card:cardContext(context || {}),
			hasPt:/\bcreature\b/i.test(String((context || {}).typeLine || (context || {}).type || 'Creature')),
			isSpell:/\b(instant|sorcery)\b/i.test(String((context || {}).typeLine || (context || {}).type || ''))
		};
		parameters.forEach(function(parameter, index) { environment['param' + (index + 1)] = parameter; });

		function peek(value) { return tokens[cursor] && (value == null || tokens[cursor].value === value) ? tokens[cursor] : null; }
		function take(value) { var token = peek(value); if (token) cursor++; return token; }
		function parseIf() {
			take('if');
			var condition = parseOr();
			take('then');
			var yes = parseIfExpression();
			var no = '';
			if (take('else')) no = parseIfExpression();
			return truthy(condition) ? yes : no;
		}
		function parseIfExpression() { return peek('if') ? parseIf() : parseOr(); }
		function parseOr() { var value = parseAnd(); while (take('or')) { if (peek('else')) take('else'); var right = parseAnd(); value = truthy(value) ? value : right; } return value; }
		function parseAnd() { var value = parseEquality(); while (take('and')) value = truthy(value) && truthy(parseEquality()); return value; }
		function parseEquality() {
			var value = parseComparison();
			while (peek('==') || peek('!=')) { var operator = tokens[cursor++].value; var right = parseComparison(); value = operator === '==' ? primitive(value) == primitive(right) : primitive(value) != primitive(right); }
			return value;
		}
		function parseComparison() {
			var value = parseAdd();
			while (peek('>') || peek('<') || peek('>=') || peek('<=')) { var operator = tokens[cursor++].value; var right = parseAdd(); if (operator === '>') value = Number(primitive(value)) > Number(primitive(right)); if (operator === '<') value = Number(primitive(value)) < Number(primitive(right)); if (operator === '>=') value = Number(primitive(value)) >= Number(primitive(right)); if (operator === '<=') value = Number(primitive(value)) <= Number(primitive(right)); }
			return value;
		}
		function parseAdd() { var value = parseUnary(); while (take('+')) value = String(primitive(value) ?? '') + String(primitive(parseUnary()) ?? ''); return value; }
		function parseUnary() { if (take('not')) return !truthy(parseUnary()); if (take('-')) return -Number(primitive(parseUnary())); return parsePrimary(); }
		function parsePrimary() {
			if (take('(')) { var grouped = parseIfExpression(); take(')'); return grouped; }
			var token = tokens[cursor++];
			if (!token) return '';
			if (token.type === 'string' || token.type === 'number') return token.value;
			if (token.value === 'true') return true;
			if (token.value === 'false') return false;
			if (token.type !== 'identifier') return token.value;
			var name = token.value;
			if (take('(')) {
				var positional = [];
				var named = {};
				while (!peek(')') && cursor < tokens.length) {
					if (tokens[cursor]?.type === 'identifier' && tokens[cursor + 1]?.value === ':') {
						var key = tokens[cursor++].value; cursor++; named[key] = parseIfExpression();
					} else positional.push(parseIfExpression());
					if (!take(',')) break;
				}
				take(')');
				return callFunction(name, positional, named, environment);
			}
			if (name.startsWith('card.')) return environment.card[name.slice(5)] || '';
			if (/^param\d+\.value$/.test(name)) return environment[name.split('.')[0]]?.value || '';
			return environment[name] == null ? '' : environment[name];
		}
		return parseIfExpression();
	}

	function expandScripts(template, parameters, context) {
		var output = '';
		var index = 0;
		while (index < template.length) {
			if (template[index] !== '{') { output += template[index++]; continue; }
			var start = index++;
			var depth = 1;
			var quoted = false;
			while (index < template.length && depth > 0) {
				if (template[index] === '"' && template[index - 1] !== '\\') quoted = !quoted;
				if (!quoted && template[index] === '{') depth++;
				if (!quoted && template[index] === '}') depth--;
				index++;
			}
			if (depth !== 0) { output += template.slice(start); break; }
			var expression = template.slice(start + 1, index - 1).trim();
			if (/^(?:[0-9]+|[WUBRGCSTXYZEP]|[WUBRG]\/[WUBRGP]|2\/[WUBRG])$/i.test(expression)) {
				output += '{' + expression + '}';
				continue;
			}
			try { output += primitive(evaluateExpression(expression, parameters, context)) ?? ''; }
			catch (error) { output += ''; }
		}
		return output;
	}

	function normalizeMarkup(value, parameters, context) {
		var output = String(value || '');
		for (var pass = 0; pass < 4 && /\{[^}]+\}/.test(output); pass++) output = expandScripts(output, parameters, context);
		output = output.replace(/<sym>([^<]+)<\/sym>/gi, function(_, symbol) { return '{' + (/^T$/i.test(symbol) ? 't' : symbol) + '}'; });
		output = output.replace(/\[([^\]]+)\]/g, function(_, symbol) { return '{' + (/^T$/i.test(symbol) ? 't' : symbol) + '}'; });
		output = output.replace(/\]([^[]+)\[/g, '{$1}');
		output = output.replace(/face_if_[\s\S]*?_end/g, function(block) { return /then_([^_]*)_else_([^_]*)_end/.test(block) ? RegExp.$1 : ''; });
		output = output.replace(/<[^>]+>/g, '');
		output = output.replace(/"([0-9]+),\s*T,/g, '"{$1}, {t},').replace(/"T,/g, '"{t},');
		var pluralize = parameters.some(function(parameter) { return numberValue(parameter.value) !== 1; });
		output = output.replace(/\(s\)/g, pluralize ? 's' : '');
		return output.replace(/\s+([,.;:])/g, '$1').replace(/\s+/g, ' ').trim();
	}

	function renderReminder(item, parameters, context) {
		if (!item.reminderRaw) return '';
		return normalizeMarkup(item.reminderRaw, parameters || [], context || {});
	}

	return {
		compileDefinition:compileDefinition,
		stripParameterSeparators:stripParameterSeparators,
		renderReminder:renderReminder,
		normalizeMarkup:normalizeMarkup,
		evaluateExpression:evaluateExpression,
		splitMseMatch:splitMseMatch
	};
});
