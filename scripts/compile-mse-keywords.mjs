import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vendorPath = path.join(root, 'vendor', 'mse', 'keywords_en');
const outputPath = path.join(root, 'js', 'mseKeywordCatalog.js');
const sourceBranch = 'develop';
const sourceUrl = `https://raw.githubusercontent.com/MagicSetEditorPacks/Full-Magic-Pack/${sourceBranch}/data/magic.mse-game/keywords_en`;
const commitsUrl = `https://api.github.com/repos/MagicSetEditorPacks/Full-Magic-Pack/commits?sha=${sourceBranch}&path=data/magic.mse-game/keywords_en&per_page=1`;

// Full Magic Pack's develop branch removed Worthy while its printed card still
// uses the mechanic. Retain the reviewed main-branch definition alongside the
// develop catalog instead of modifying the vendored upstream source.
const supplementalKeywords = [{
	keyword: 'worthy',
	match: 'worthy',
	mode: 'expert',
	reminder: "A creature is worthy if it's a legendary non-Villain that's red and/or white."
}];

function argument(name) {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : '';
}

function slug(value) {
	return String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'keyword';
}

function parseBlocks(source) {
	const parameters = [];
	const modes = [];
	const keywords = [];
	let type = '';
	let current = null;
	let lastProperty = '';

	function finish() {
		if (!current) return;
		if (type === 'parameter') parameters.push(current);
		if (type === 'mode') modes.push(current);
		if (type === 'keyword') keywords.push(current);
		current = null;
		lastProperty = '';
	}

	for (const rawLine of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
		const headerLine = rawLine.trimEnd();
		if (headerLine === 'keyword parameter type:') {
			finish(); type = 'parameter'; current = {}; continue;
		}
		if (headerLine === 'keyword mode:') {
			finish(); type = 'mode'; current = {}; continue;
		}
		if (headerLine === 'keyword:') {
			finish(); type = 'keyword'; current = {}; continue;
		}
		if (!current) continue;
		const property = rawLine.match(/^\t([^#\t][^:]*):(?:\s(.*))?$/);
		if (!property) {
			if (lastProperty && /^\t\t/.test(rawLine) && rawLine.trim() && !rawLine.trim().startsWith('#')) {
				current[lastProperty] = (current[lastProperty] ? current[lastProperty] + ' ' : '') + rawLine.trim();
			}
			continue;
		}
		const key = property[1].trim().replace(/ /g, '_');
		const value = property[2] == null ? '' : property[2];
		current[key] = value;
		lastProperty = key;
	}
	finish();
	return {parameters, modes, keywords};
}

const parameterExamples = {
	mana: '{2}{R}',
	cost: '{2}',
	number: '2',
	action: '— Discard a card',
	one_word: 'creature',
	p: 'p',
	name: 'Knight',
	prefix: 'Forest',
	english_number: 'two',
	a: '',
	'*s': 's',
	nonland: ' nonland ',
	mill: 'mill',
	iterate: ' twice',
	energy: ' pays EE'
};

// Full Magic Pack occasionally uses atom parameters as low-level capture tricks.
// Keep mseMatch byte-for-byte exact, while giving the app readable examples and
// one narrowly corrected runtime pattern for the malformed upstream Detain entry.
const runtimeMatchOverrides = {
	detain: 'detain <atom-param>english_number</atom-param> target<atom-param>nonland</atom-param><atom-param>one_word</atom-param>'
};

const exampleOverrides = {
	'hexproof-from': 'Hexproof from blue',
	detain: 'detain two target nonland creatures',
	'partner-with': 'Partner with Knight',
	'treasure-token': 'Treasure token',
	'food-token': 'Food token',
	'gold-token': 'Gold token',
	mill: 'mill two cards',
	'shard-token': 'Shard token',
	'blood-token': 'Blood token',
	'stun-counters': 'stun counters',
	'powerstone-token': 'Powerstone token',
	'map-token': 'Map token',
	'junk-token': 'Junk token',
	'becomes-plotted': 'becomes plotted',
	'lander-token': 'Lander token',
	'mutagen-tokens': 'Mutagen tokens',
	disappear: 'Disappear — When this creature enters, if a permanent left the battlefield under your control this turn, create a 1/1 black Ninja creature token.',
	recruit: 'When this creature enters, recruit.',
	storied: 'Storied',
	'hone-counters': 'Put a hone counter on each Equipment you control.',
	rulebreaker: 'Rulebreaker — A deck with this commander can have any land cards.',
	'heartwood-token': 'Create a Heartwood token.'
};

const definitionOverrides = {
	disappear: {
		rulesRaw: 'Disappear — [effect], if a permanent left the battlefield under your control this turn.'
	},
	'hone-counters': {placement:'line-end'},
	'heartwood-token': {
		reminderRaw: '{if param1.value == "ns" then "They’re red and green artifacts" else "It’s a red and green artifact"} with "[T]: Add [R] or [G]."',
		placement:'line-end'
	}
};

function displayPatternFor(match) {
	return String(match || '')
		.replace(/<atom-param[^>]*>([^<]+)<\/atom-param>/g, '<$1>')
		.replace(/^Hexproo<name> from <name>$/i, 'Hexproof from <name>')
		.replace(/^Partne<name> with <name>$/i, 'Partner with <name>')
		.replace(/^detain <english_number> target<nonland><one_word>$/i, 'Detain <english_number> target <nonland> <one_word>')
		.replace(/toke<\*s>/gi, 'token(s)')
		.replace(/car<\*s>/gi, 'card(s)')
		.replace(/counte<\*s>/gi, 'counter(s)')
		.replace(/becom<\*s>/gi, 'become(s)');
}

function exampleFor(match) {
	return String(match || '').replace(/<atom-param[^>]*>([^<]+)<\/atom-param>/g, (_, type, offset, source) => {
		if (type === 'cost') return source[offset - 1] === ' ' ? '{2}' : ' {2}';
		return parameterExamples[type] ?? type;
	});
}

function buildCatalog(source, metadata = {}) {
	const parsed = parseBlocks(source);
	const upstreamKeywordCount = parsed.keywords.length;
	for (const supplemental of supplementalKeywords) {
		const alreadyPresent = parsed.keywords.some((keyword) => keyword.keyword === supplemental.keyword && keyword.match === supplemental.match);
		if (!alreadyPresent) parsed.keywords.push(supplemental);
	}
	const ids = new Map();
	const keywords = parsed.keywords.map((keyword) => {
		const base = slug(keyword.keyword);
		const ordinal = (ids.get(base) || 0) + 1;
		ids.set(base, ordinal);
		const id = ordinal === 1 ? base : `${base}-${ordinal}`;
		const runtimeMatch = runtimeMatchOverrides[id] || keyword.match;
		const definition = {
			id,
			name: keyword.keyword,
			mode: keyword.mode,
			mseMatch: keyword.match,
			runtimeMatch,
			displayPattern: displayPatternFor(runtimeMatch),
			reminderRaw: keyword.reminder || '',
			rulesRaw: keyword.rules || '',
			example: exampleOverrides[id] || exampleFor(runtimeMatch),
			placement: keyword.mode === 'action' || String(keyword.reminder || '').includes('handle_action_rt') ? 'line-end' : 'inline',
			builtIn: true
		};
		return {...definition, ...(definitionOverrides[id] || {})};
	});
	return {
		source: {
			repository: 'MagicSetEditorPacks/Full-Magic-Pack',
			path: 'data/magic.mse-game/keywords_en',
			branch: sourceBranch,
			commit: metadata.commit || 'f1891ee0ed0038d233760d2f5b779923579c38bb',
			sha256: crypto.createHash('sha256').update(source).digest('hex'),
			syncedAt: metadata.syncedAt || '2026-08-05',
			upstreamKeywordCount,
			supplementalDefinitions: supplementalKeywords.map((keyword) => keyword.keyword)
		},
		modes: parsed.modes.map((mode) => ({
			name: mode.name,
			description: mode.description || '',
			isDefault: mode.is_default === 'true'
		})),
		parameterTypes: Object.fromEntries(parsed.parameters.map((parameter) => [parameter.name, {
			name: parameter.name,
			match: parameter.match || '',
			optional: parameter.optional !== 'false',
			separatorBefore: parameter.separator_before_is || '',
			separatorAfter: parameter.separator_after_is || '',
			example: parameter.example || parameterExamples[parameter.name] || parameter.name
		}])),
		keywords
	};
}

function serialize(catalog) {
	return `(function(root, factory) {\n\tvar catalog = factory();\n\tif (typeof module === 'object' && module.exports) module.exports = catalog;\n\tif (root) root.CardConjurerMseKeywordCatalog = catalog;\n})(typeof window !== 'undefined' ? window : globalThis, function() {\n\t'use strict';\n\treturn ${JSON.stringify(catalog, null, '\t')};\n});\n`;
}

async function upstreamSource() {
	const [sourceResponse, commitsResponse] = await Promise.all([
		fetch(sourceUrl),
		fetch(commitsUrl, {headers:{Accept:'application/vnd.github+json', 'User-Agent':'Set-Conjurer-keyword-sync'}})
	]);
	if (!sourceResponse.ok) throw new Error(`MSE keyword download failed (${sourceResponse.status}).`);
	if (!commitsResponse.ok) throw new Error(`MSE keyword commit lookup failed (${commitsResponse.status}).`);
	const commits = await commitsResponse.json();
	return {source:await sourceResponse.text(), commit:commits[0]?.sha || ''};
}

const sync = process.argv.includes('--sync');
const check = process.argv.includes('--check');
const externalSource = argument('--source');
let source;
let commit = argument('--commit');
if (sync) {
	const upstream = await upstreamSource();
	source = upstream.source;
	commit = upstream.commit;
	await fs.mkdir(path.dirname(vendorPath), {recursive:true});
	await fs.writeFile(vendorPath, source);
} else {
	source = await fs.readFile(externalSource ? path.resolve(externalSource) : vendorPath, 'utf8');
	if (externalSource && process.argv.includes('--vendor')) {
		await fs.mkdir(path.dirname(vendorPath), {recursive:true});
		await fs.writeFile(vendorPath, source);
	}
}

const catalog = buildCatalog(source, {commit});
if (catalog.source.upstreamKeywordCount !== 373) throw new Error(`Expected 373 upstream MSE keywords, found ${catalog.source.upstreamKeywordCount}.`);
if (catalog.keywords.length !== 374) throw new Error(`Expected 374 built-in keywords, found ${catalog.keywords.length}.`);
if (catalog.keywords.filter((keyword) => keyword.reminderRaw).length !== 312) throw new Error('Expected 312 non-empty reminder definitions.');
const output = serialize(catalog);
if (check) {
	const existing = await fs.readFile(outputPath, 'utf8');
	if (existing !== output) throw new Error('Generated MSE keyword catalog is stale. Run npm run keywords:compile.');
	console.log(`MSE keyword catalog is current: ${catalog.keywords.length} definitions at ${catalog.source.commit}.`);
} else {
	await fs.writeFile(outputPath, output);
	console.log(`Compiled ${catalog.keywords.length} MSE keywords (${catalog.keywords.filter((keyword) => keyword.reminderRaw).length} reminders) from ${catalog.source.commit}.`);
}
