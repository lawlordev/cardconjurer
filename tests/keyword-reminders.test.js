const test = require('node:test');
const assert = require('node:assert/strict');
const Keywords = require('../js/keywordReminders.js');

function memoryStorage(initial = {}) {
	const values = new Map(Object.entries(initial));
	return {
		getItem(key) { return values.has(key) ? values.get(key) : null; },
		setItem(key, value) { values.set(key, String(value)); },
		removeItem(key) { values.delete(key); },
	};
}

test('the generated catalog maps MSE develop plus the retained worthy definition', () => {
	assert.equal(Keywords.DEFAULT_KEYWORDS.length, 374);
	assert.equal(new Set(Keywords.DEFAULT_KEYWORDS.map((item) => item.id)).size, Keywords.DEFAULT_KEYWORDS.length);
	assert.deepEqual(
		Object.fromEntries(Object.entries(Keywords.MSE_CATALOG_MODE_COUNTS)),
		{old:10, core:28, expert:219, pseudo:62, action:55},
	);
	assert.equal(Keywords.MSE_CATALOG_SOURCE.branch, 'develop');
	assert.equal(Keywords.MSE_CATALOG_SOURCE.commit, 'f1891ee0ed0038d233760d2f5b779923579c38bb');
	assert.equal(Keywords.MSE_CATALOG_SOURCE.sha256, '1994bc064453038efe7e0b2cab03b4b2b3162aa3d753b0a86b1b6f7e5a8f10e6');
	assert.equal(Keywords.MSE_CATALOG_SOURCE.upstreamKeywordCount, 373);
	assert.deepEqual(Array.from(Keywords.MSE_CATALOG_SOURCE.supplementalDefinitions), ['worthy']);
	assert.equal(Keywords.DEFAULT_KEYWORDS.filter((item) => item.reminderRaw).length, 312);
	assert.equal(Keywords.DEFAULT_KEYWORDS.filter((item) => !item.reminderRaw).length, 62);
	assert.equal(Keywords.DEFAULT_KEYWORDS.filter((item) => item.mode === 'pseudo' && !item.reminderRaw).length, 62);
});

test('reviewed develop definitions match real card wording and retain worthy', () => {
	const byId = Object.fromEntries(Keywords.DEFAULT_KEYWORDS.map((keyword) => [keyword.id, keyword]));
	assert.equal(byId.disappear.mseMatch, 'Disappear');
	assert.equal(byId.disappear.reminderRaw, '');
	assert.equal(byId.disappear.rulesRaw, 'Disappear — [effect], if a permanent left the battlefield under your control this turn.');
	assert.match(byId.disappear.example, /^Disappear — When this creature enters,/);
	assert.equal(byId.recruit.mseMatch, 'recruit');
	assert.equal(byId.recruit.reminderRaw, '{handle_action_rt(to:"recruit", "Draw")} a card, then discard a card. If you discarded a nonland card, create a 1/1 white Human Soldier creature token.');
	assert.equal(byId.storied.reminderRaw, 'If you control three or more artifacts, legendaries, and/or Sagas, you have an enduring story for the rest of the game.');
	assert.equal(byId['hone-counters'].reminderRaw, 'Each hone counter on an Equipment grants +1/+0 to equipped creature.');
	assert.equal(byId.rulebreaker.mode, 'pseudo');
	assert.equal(byId['heartwood-token'].reminderRaw, '{if param1.value == "ns" then "They’re red and green artifacts" else "It’s a red and green artifact"} with "[T]: Add [R] or [G]."');
	assert.equal(byId.worthy.reminderRaw, "A creature is worthy if it's a legendary non-Villain that's red and/or white.");
});

test('reviewed develop examples reproduce printed formatting and reminder placement', () => {
	const byId = Object.fromEntries(Keywords.DEFAULT_KEYWORDS.map((keyword) => [keyword.id, keyword]));
	const apply = (id) => Keywords.applyAll(byId[id].example, [byId[id]]).text;
	assert.match(apply('disappear'), /^\{i\}Disappear\{\/i\} — When this creature enters,/);
	assert.equal(apply('recruit'), 'When this creature enters, recruit. {i}(Draw a card, then discard a card. If you discarded a nonland card, create a 1/1 white Human Soldier creature token.){/i}');
	assert.equal(apply('storied'), 'Storied {i}(If you control three or more artifacts, legendaries, and/or Sagas, you have an enduring story for the rest of the game.){/i}');
	assert.equal(apply('hone-counters'), 'Put a hone counter on each Equipment you control. {i}(Each hone counter on an Equipment grants +1/+0 to equipped creature.){/i}');
	assert.match(apply('rulebreaker'), /^\{i\}Rulebreaker\{\/i\} — A deck with this commander/);
	assert.equal(apply('heartwood-token'), 'Create a Heartwood token. {i}(It’s a red and green artifact with "{t}: Add {R} or {G}."){/i}');
});

test('every MSE definition recognizes its generated example and exposes its explicit effect', () => {
	for (const keyword of Keywords.DEFAULT_KEYWORDS) {
		assert.ok(keyword.name, `${keyword.id} needs a name`);
		assert.ok(keyword.mseMatch, `${keyword.id} needs an MSE match pattern`);
		assert.ok(keyword.example, `${keyword.id} needs a test example`);
		const occurrences = Keywords.findOccurrences(keyword.example, [keyword]);
		assert.equal(occurrences.length, 1, `${keyword.id} did not recognize exactly one occurrence`);
		const result = Keywords.toggleOccurrence(keyword.example, [], occurrences[0].signature, true, [keyword]);
		if (keyword.reminderRaw) {
			assert.match(result.text, / \{i\}\(.+\)\{\/i\}$/, `${keyword.id} did not expand its example`);
			assert.equal(result.occurrences[0].hasGeneratedReminder, true, `${keyword.id} did not recognize its generated reminder`);
			assert.doesNotMatch(result.occurrences[0].renderedReminder, /<atom-param>|\bparam\d+\b/, `${keyword.id} leaked MSE implementation syntax`);
		} else {
			assert.equal(result.occurrences[0].hasGeneratedFormatting, true, `${keyword.id} did not recognize its MSE italics`);
			assert.match(result.text, /\{i\}.+\{\/i\}/, `${keyword.id} did not apply MSE pseudo-keyword italics`);
		}
	}
});

test('built-in library details hide MSE capture tricks and resolve reminder scripts', () => {
	for (const keyword of Keywords.DEFAULT_KEYWORDS) {
		assert.doesNotMatch(Keywords.managerRecognition(keyword), /<atom-param>|Hexproo<|Partne<|toke<|car<|counte<|becom</i, `${keyword.id} exposed an internal recognition capture`);
		assert.doesNotMatch(Keywords.managerReminder(keyword), /<atom-param>|\{(?:if\b|param\d|[a-z_]+\()/i, `${keyword.id} exposed raw MSE reminder script`);
	}

	const detain = Keywords.DEFAULT_KEYWORDS.find((keyword) => keyword.id === 'detain');
	assert.equal(detain.mseMatch, 'detain<atom-param>english_number</atom-param>target<atom-param>nonland</atom-param><atom-param>one_word</atom-param>');
	assert.equal(detain.runtimeMatch, 'detain <atom-param>english_number</atom-param> target<atom-param>nonland</atom-param><atom-param>one_word</atom-param>');
	assert.equal(Keywords.managerRecognition(detain), 'Detain <english_number> target <nonland> <one_word>');
	assert.equal(detain.example, 'detain two target nonland creatures');
	assert.equal(Keywords.managerReminder(detain), "Until your next turn, those creatures can't attack or block and their activated abilities can't be activated.");
	assert.equal(Keywords.findOccurrences(detain.example, [detain]).length, 1);
	assert.equal(Keywords.findOccurrences('detaintwotarget nonland creature', [detain]).length, 0);
});

test('the complete default catalog applies in one explicit workflow without duplicates', () => {
	const source = Keywords.DEFAULT_KEYWORDS.map((item) => item.example).join('\n');
	const first = Keywords.applyAll(source);
	assert.equal(first.occurrences.length, Keywords.DEFAULT_KEYWORDS.length);
	assert.equal(first.occurrences.filter((item) => item.hasGeneratedReminder).length, 312);
	assert.equal(first.occurrences.filter((item) => item.hasGeneratedFormatting).length, 62);
	assert.equal((first.text.match(/\{i\}\(/g) || []).length, 312);
	assert.equal(first.changes.length, 374);

	const second = Keywords.applyAll(first.text);
	assert.equal(second.text, first.text);
	assert.equal(second.changes.length, 0);
});

test('recognition follows MSE whole-word matching in sentences and keyword lists', () => {
	assert.equal(Keywords.findOccurrences('A creature with flying is useful.').length, 1);
	assert.equal(Keywords.findOccurrences('Flyingmachine').length, 0);
	const result = Keywords.applyAll('Flying, vigilance');
	assert.equal(result.occurrences.length, 2);
	assert.match(result.text, /^Flying, vigilance \{i\}\(.+\)\{\/i\} \{i\}\(.+\)\{\/i\}$/);
});

test('parameterized defaults interpolate costs, numbers, text, and optional plurals', () => {
	const result = Keywords.applyAll('Equip Knight {1}\nScry 2\nHexproof from blue\nTreasure tokens');
	assert.match(result.text, /\{1\}: Attach to target Knight creature/);
	assert.match(result.text, /top two cards/);
	assert.match(result.text, /target of blue spells/);
	assert.match(result.text, /A Treasure token is an artifact/);
	assert.doesNotMatch(result.text, /\bparam\d+\b|<atom-param>/);
});

test('MSE free-text parameters retain multi-word values inside sentences', () => {
	const source = 'You and this creature have protection from the chosen color.';
	const result = Keywords.applyAll(source);
	assert.equal(result.occurrences.length, 1);
	assert.equal(result.occurrences[0].keywordText, 'protection from the chosen color.');
	assert.match(result.text, /anything the chosen color\./);
});

test('one repeated keyword occurrence can be removed and restored independently', () => {
	const source = 'Flying\nFlying';
	const occurrences = Keywords.findOccurrences(source);
	assert.equal(occurrences.length, 2);
	const first = Keywords.toggleOccurrence(source, [], occurrences[0].signature, true);
	const expanded = Keywords.toggleOccurrence(first.text, [], 'flying:1', true);
	assert.equal((expanded.text.match(/\{i\}\(/g) || []).length, 2);

	const hidden = Keywords.toggleOccurrence(expanded.text, [], occurrences[1].signature, false);
	assert.equal((hidden.text.match(/\{i\}\(/g) || []).length, 1);

	const restored = Keywords.toggleOccurrence(hidden.text, [], 'flying:1', true);
	assert.equal((restored.text.match(/\{i\}\(/g) || []).length, 2);
});

test('flavor text is not scanned for keywords', () => {
	const source = 'Flying\n{flavor}Flying through the night.';
	const occurrences = Keywords.findOccurrences(source);
	assert.equal(occurrences.length, 1);
	const result = Keywords.toggleOccurrence(source, [], occurrences[0].signature, true);
	assert.equal((result.text.match(/\{i\}\(/g) || []).length, 1);
	assert.match(result.text, /\{flavor\}Flying through the night\.$/);
});

test('custom keywords persist, expand, export, import, and merge through the versioned format', () => {
	const store = memoryStorage();
	const ward = Keywords.normalizeCustomKeyword({
		name: 'Ward',
		pattern: 'Ward {cost}',
		reminder: 'Whenever this permanent becomes the target of a spell or ability an opponent controls, counter it unless that player pays {cost}.',
		example: 'Ward {2}',
	});
	Keywords.saveCustomKeywords([ward], store);
	assert.deepEqual(Keywords.getCustomKeywords(store), [ward]);

	const definitions = Keywords.getDefinitions(store);
	const occurrence = Keywords.findOccurrences('Ward {2}', definitions)[0];
	const expanded = Keywords.toggleOccurrence('Ward {2}', [], occurrence.signature, true, definitions);
	assert.match(expanded.text, /pays \{2\}/);

	const exported = Keywords.serializeCustomKeywords(Keywords.getCustomKeywords(store));
	const imported = Keywords.parseCustomKeywords(exported);
	assert.deepEqual(imported, [ward]);
	assert.deepEqual(Keywords.mergeCustomKeywords(imported, []), [ward]);
	assert.throws(() => Keywords.parseCustomKeywords('{"format":"other","keywords":[]}'), /not a Set Conjurer keyword export/);
});

test('custom keywords copied from MSE recognize existing matching reminder text', () => {
	const dedication = Keywords.normalizeCustomKeyword({
		name: 'Dedication',
		pattern: 'dedication to <atom-param>one_word</atom-param>',
		reminder: 'Each {color_to_mana(param1)} in the mana cost of a card counts toward its dedication to {param1}.',
		example: 'dedication to white',
	});
	assert.equal(dedication.mseMatch, dedication.pattern);
	assert.equal(dedication.reminderRaw, dedication.reminder);

	const source = 'Tap an untapped white creature you control: Until end of turn, creatures you control get +X/+X, where X is that creature’s dedication to white. (Each {W} in the mana cost of a card counts toward its dedication to white.)';
	const occurrence = Keywords.findOccurrences(source, [dedication])[0];
	assert.equal(occurrence.keywordText, 'dedication to white');
	assert.equal(occurrence.renderedReminder, 'Each {W} in the mana cost of a card counts toward its dedication to white.');
	assert.equal(occurrence.hasGeneratedEffect, true);

	const removed = Keywords.toggleOccurrence(source, [], occurrence.signature, false, [dedication]);
	assert.doesNotMatch(removed.text, /\(Each \{W\}/);
	const restored = Keywords.toggleOccurrence(removed.text, [], occurrence.signature, true, [dedication]);
	assert.match(restored.text, /\{i\}\(Each \{W\} in the mana cost of a card counts toward its dedication to white\.\)\{\/i\}$/);

	const imported = Keywords.parseCustomKeywords(Keywords.serializeCustomKeywords([dedication]))[0];
	assert.equal(imported.mseMatch, dedication.pattern);
	assert.equal(Keywords.findOccurrences(source, [imported])[0].hasGeneratedEffect, true);
});

test('custom keyword test examples produce live card-text preview states', () => {
	const ward = {
		name: 'Ward',
		pattern: 'Ward {cost}',
		reminder: 'Whenever this permanent becomes the target of a spell or ability an opponent controls, counter it unless that player pays {cost}.',
		example: 'Ward {2}',
	};
	const matched = Keywords.previewCustomKeyword(ward);
	assert.equal(matched.state, 'match');
	assert.match(matched.text, /^Ward \{2\} \{i\}\(Whenever/);
	assert.match(matched.message, /after selecting/i);

	const existing = Keywords.previewCustomKeyword({
		name: 'Dedication',
		pattern: 'dedication to <atom-param>one_word</atom-param>',
		reminder: 'Each {color_to_mana(param1)} in the mana cost of a card counts toward its dedication to {param1}.',
		example: 'dedication to white. (Each {W} in the mana cost of a card counts toward its dedication to white.)',
	});
	assert.equal(existing.state, 'match');
	assert.match(existing.message, /checkbox will start checked/i);
	assert.doesNotMatch(existing.text, /color_to_mana|param1/);

	const noMatch = Keywords.previewCustomKeyword({...ward, example:'Flying'});
	assert.equal(noMatch.state, 'no-match');
	assert.equal(noMatch.text, 'Flying');
	assert.match(noMatch.message, /does not match/i);
	assert.equal(Keywords.previewCustomKeyword({...ward, example:''}).state, 'empty');
});

test('custom pattern validation rejects missing literals and unknown placeholders', () => {
	assert.throws(() => Keywords.normalizeCustomKeyword({name:'Bad', pattern:'{number}', reminder:'Nope'}), /literal text/);
	assert.throws(() => Keywords.normalizeCustomKeyword({name:'Bad', pattern:'Bad {value}', reminder:'Nope'}), /unsupported pattern placeholder/);
	assert.throws(() => Keywords.normalizeCustomKeyword({name:'Bad MSE', pattern:'Bad <atom-param>unknown</atom-param>', reminder:'Nope'}), /unknown MSE recognition parameter/);
});

test('MSE-style named parameters and formatting variants interpolate correctly', () => {
	const definitions = [
		Keywords.normalizeCustomKeyword({
			name: 'Reforge',
			pattern: 'Reforge {mana:cost} — {number:amount} {word:kind} token{s:plural}',
			reminder: 'Pay {cost}; create {amount} {kind} token{plural}.',
			example: 'Reforge {2}{R} — 3 Golem tokens',
		}),
		Keywords.normalizeCustomKeyword({
			name: 'Overload',
			pattern: 'Overload {cost:alternate}',
			reminder: 'You may cast this spell for {alternate}.',
			example: 'Overload — Discard a card',
		}),
		Keywords.normalizeCustomKeyword({
			name: 'Landwalk',
			pattern: '{prefix:land}walk',
			reminder: 'This creature can’t be blocked as long as defending player controls a {land}.',
			example: 'Islandwalk',
		}),
		Keywords.normalizeCustomKeyword({
			name: 'Amplify',
			pattern: 'Amplify {english:amount}',
			reminder: 'Reveal {amount} cards.',
			example: 'Amplify two',
		}),
		Keywords.normalizeCustomKeyword({
			name: 'Scale',
			pattern: 'Scale {number}/{number}',
			reminder: 'Scale from {number} to {number2}.',
			example: 'Scale 2/4',
		}),
	];
	const source = definitions.map((item) => item.example).join('\n');
	const result = Keywords.applyAll(source, definitions);
	assert.equal(result.occurrences.length, definitions.length);
	assert.match(result.text, /Pay \{2\}\{R\}; create 3 Golem tokens\./);
	assert.match(result.text, /cast this spell for — Discard a card\./);
	assert.match(result.text, /controls a Island\./);
	assert.match(result.text, /Reveal two cards\./);
	assert.match(result.text, /Scale from 2 to 4\./);
	assert.doesNotMatch(result.text, /\{(?:cost|amount|kind|plural|alternate|land|number2?)\}/);
});

test('action-style keywords place reminder text after sentence punctuation', () => {
	const investigate = Keywords.normalizeCustomKeyword({
		name: 'Investigate',
		pattern: 'Investigate',
		reminder: 'Create a Clue token.',
		placement: 'line-end',
		example: 'When this enters, investigate.',
	});
	const occurrence = Keywords.findOccurrences(investigate.example, [investigate])[0];
	const expanded = Keywords.toggleOccurrence(investigate.example, [], occurrence.signature, true, [investigate]);
	assert.equal(expanded.text, 'When this enters, investigate. {i}(Create a Clue token.){/i}');
	assert.equal(expanded.occurrences[0].hasGeneratedReminder, true);

	const hidden = Keywords.toggleOccurrence(expanded.text, [], expanded.occurrences[0].signature, false, [investigate]);
	assert.equal(hidden.text, investigate.example);
	const restored = Keywords.toggleOccurrence(hidden.text, [], expanded.occurrences[0].signature, true, [investigate]);
	assert.equal(restored.text, expanded.text);
});

test('typing is recognition-only and exposes no automatic insertion preference', () => {
	const source = 'Flying\nHellbent — This gets +1/+1.';
	const occurrences = Keywords.findOccurrences(source);
	assert.equal(occurrences.length, 2);
	assert.equal(source, 'Flying\nHellbent — This gets +1/+1.');
	assert.equal(Keywords.automaticEnabled, undefined);
	assert.equal(Keywords.applyAutomatic, undefined);
});

test('pseudo keywords explicitly toggle only MSE ability-word italics', () => {
	const source = 'Hellbent — This creature gets +1/+1.';
	const occurrence = Keywords.findOccurrences(source)[0];
	assert.equal(occurrence.effect, 'italicize');
	assert.equal(occurrence.hasGeneratedEffect, false);
	const enabled = Keywords.toggleOccurrence(source, [], occurrence.signature, true);
	assert.equal(enabled.text, '{i}Hellbent{/i} — This creature gets +1/+1.');
	assert.equal(enabled.occurrences[0].hasGeneratedEffect, true);
	const disabled = Keywords.toggleOccurrence(enabled.text, [], occurrence.signature, false);
	assert.equal(disabled.text, source);
});

test('one selected reminder follows an entire comma-separated keyword sequence', () => {
	const source = 'Flying, vigilance, lifelink';
	const occurrence = Keywords.findOccurrences(source).find((item) => item.definition.id === 'vigilance');
	const result = Keywords.toggleOccurrence(source, [], occurrence.signature, true);
	assert.match(result.text, /^Flying, vigilance, lifelink \{i\}\(Attacking/);
	assert.doesNotMatch(result.text, /vigilance \{i\}\(/);
});
