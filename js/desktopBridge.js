(function(root) {
	'use strict';
	var api = root.setConjurerDesktop;
	if (!api) return;
	var drawerReturnFocus = null;
	var selectedPaper = (function() { try { return ['US','CA'].includes(new Intl.Locale(navigator.language).region) ? 'letter' : 'a4'; } catch (error) { return 'letter'; } })();
	var selectedBack = 'standard';

	function escapeHtml(value) {
		return String(value == null ? '' : value).replace(/[&<>"']/g, function(character) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]; });
	}
	function icon(name) {
		return name === 'packs' ? '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7 12 3l8 4-8 4-8-4Z"/><path d="m4 12 8 4 8-4M4 17l8 4 8-4"/></svg>' : '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>';
	}
	function shell() {
		document.body.classList.add('desktop-shell');
		var legacyHeader = document.querySelector('body > header'); if (legacyHeader) legacyHeader.hidden = true;
		['.hamburger','.circle','.menu'].forEach(function(selector) { var node = document.querySelector(selector); if (node) node.hidden = true; });
		if (document.querySelector('#desktop-drawer')) return;
		document.body.insertAdjacentHTML('beforeend',
			'<div id="desktop-overlay" class="desktop-overlay" hidden></div>' +
			'<aside id="desktop-drawer" class="textbox-editor layout-drawer desktop-drawer" role="dialog" aria-modal="true" aria-hidden="true"><div class="desktop-drawer-header"><h2 id="desktop-drawer-title" class="textbox-editor-title">Set Conjurer</h2><button type="button" class="textbox-editor-close" aria-label="Close">×</button></div><div id="desktop-drawer-body" class="layout-drawer-body"></div></aside>' +
			'<dialog id="desktop-onboarding" class="sets-dialog desktop-onboarding"><form method="dialog"><span class="creator-eyebrow">Welcome to Set Conjurer</span><h2>Your local card studio</h2><p>Choose the frame packs you want available. Standard is required and selected for you.</p><div id="desktop-onboarding-packs" class="desktop-pack-list"></div><div id="desktop-onboarding-progress" class="desktop-inline-status" aria-live="polite"></div><small>Set Conjurer is an open-source desktop fork of Kyle Burton\'s Card Conjurer, adapted for local set creation.</small><div class="sets-dialog-actions"><button id="desktop-onboarding-start" type="button" class="sets-confirm">Download &amp; Continue</button></div></form></dialog>' +
			'<section id="desktop-print" class="desktop-print" hidden aria-label="Print cards"><header class="desktop-print-toolbar"><div><span class="creator-eyebrow">Print</span><h2 id="desktop-print-title">Print Set</h2></div><label>Paper<select id="desktop-print-paper" class="input"><option value="letter">US Letter</option><option value="a4">A4</option></select></label><label>Backs<select id="desktop-print-backs" class="input"><option value="standard">Standard card back</option><option value="none">No backs</option></select></label><button type="button" id="desktop-print-close">Cancel</button><button type="button" class="sets-primary" id="desktop-print-run">Print</button></header><div class="desktop-print-content"><aside id="desktop-print-cards" class="desktop-print-card-list"></aside><main id="desktop-print-pages" class="desktop-print-pages"></main></div></section>'
		);
		document.querySelector('#desktop-drawer .textbox-editor-close').addEventListener('click', closeDrawer);
		document.querySelector('#desktop-overlay').addEventListener('click', closeDrawer);
		document.querySelector('#desktop-onboarding-start').addEventListener('click', completeOnboarding);
		document.querySelector('#desktop-print-close').addEventListener('click', closePrint);
		document.querySelector('#desktop-print-run').addEventListener('click', runPrint);
		document.querySelector('#desktop-print-paper').addEventListener('change', function(event) { selectedPaper = event.target.value; renderPrintPages(); });
		document.querySelector('#desktop-print-paper').value = selectedPaper;
		document.querySelector('#desktop-print-backs').addEventListener('change', function(event) { selectedBack = event.target.value; });
		document.addEventListener('keydown', function(event) { if (event.key === 'Escape') { closeDrawer(); closePrint(); } });
	}
	function toolbar() {
		var host = document.querySelector('.creator-app-context');
		if (!host || document.querySelector('#desktop-toolbar-actions')) return;
		host.insertAdjacentHTML('afterbegin', '<span id="desktop-toolbar-actions" class="desktop-toolbar-actions"><button type="button" class="creator-app-action desktop-icon-action" id="desktop-packs" title="Manage Frame Packs" aria-label="Manage Frame Packs">' + icon('packs') + '</button><button type="button" class="creator-app-action desktop-update-action" id="desktop-update" hidden>Update Now</button><button type="button" class="creator-app-action desktop-icon-action" id="desktop-settings" title="Settings" aria-label="Settings">' + icon('settings') + '</button></span>');
		document.querySelector('#desktop-packs').addEventListener('click', function(event) { openPacks(event.currentTarget); });
		document.querySelector('#desktop-settings').addEventListener('click', function(event) { openSettings(event.currentTarget); });
		document.querySelector('#desktop-update').addEventListener('click', updateAction);
	}
	function openDrawer(title, content, trigger) {
		drawerReturnFocus = trigger || document.activeElement;
		document.querySelector('#desktop-drawer-title').textContent = title;
		document.querySelector('#desktop-drawer-body').innerHTML = content;
		var drawer = document.querySelector('#desktop-drawer'); drawer.classList.add('opened'); drawer.setAttribute('aria-hidden','false');
		var overlay = document.querySelector('#desktop-overlay'); overlay.hidden = false;
		drawer.querySelector('.textbox-editor-close').focus();
	}
	function closeDrawer() {
		var drawer = document.querySelector('#desktop-drawer'); if (!drawer || !drawer.classList.contains('opened')) return;
		drawer.classList.remove('opened'); drawer.setAttribute('aria-hidden','true'); document.querySelector('#desktop-overlay').hidden = true;
		if (drawerReturnFocus && drawerReturnFocus.isConnected) drawerReturnFocus.focus();
	}
	function packCard(pack, selectable) {
		var checked = pack.required || pack.installed;
		var disabled = pack.required || !pack.available;
		var status = pack.installed ? 'Installed · ' + escapeHtml(pack.installedVersion || '') : pack.source === 'bundled-seed' ? 'Included in this local build' : pack.available ? 'Available to download' : 'Not available in this build yet';
		return '<label class="desktop-pack-row"><input type="checkbox" data-pack-id="' + pack.id + '" ' + (checked ? 'checked ' : '') + (disabled ? 'disabled ' : '') + '><span><strong>' + escapeHtml(pack.displayName) + (pack.required ? ' <em>Required</em>' : '') + '</strong><small>' + escapeHtml(pack.description) + '</small><small>' + status + '</small></span>' + (selectable && pack.installed && !pack.required ? '<button type="button" data-remove-pack="' + pack.id + '" class="danger">Remove</button>' : '') + '</label>';
	}
	async function openPacks(trigger) {
		var packs = await api.packs.list(); openDrawer('Frame Packs', '<p class="desktop-drawer-intro">Install only the frame families you want. Existing cards stay saved if a pack is removed.</p><div class="desktop-pack-list">' + packs.map(function(pack) { return packCard(pack, true); }).join('') + '</div><div id="desktop-pack-progress" class="desktop-inline-status"></div><button type="button" id="desktop-pack-install" class="sets-primary">Apply Changes</button>', trigger);
		document.querySelector('#desktop-pack-install').addEventListener('click', async function() { var ids = Array.from(document.querySelectorAll('#desktop-drawer [data-pack-id]:checked')).map(function(input) { return input.dataset.packId; }); await api.packs.install(ids); await openPacks(trigger); });
		document.querySelectorAll('[data-remove-pack]').forEach(function(button) { button.addEventListener('click', async function(event) {
			var id = event.currentTarget.dataset.removePack; var affected = 0;
			if (root.CardConjurerSets && root.FRAME_REGISTRY) affected = root.CardConjurerSets.getState().cards.filter(function(card) { var pack = card.uiState && (card.uiState.activeFrameCustomizationPack || card.uiState.activeFramePack); return pack && root.FRAME_REGISTRY.category(pack) === id; }).length;
			if (affected && !confirm(affected + ' saved card' + (affected === 1 ? ' uses' : 's use') + ' this pack and will be temporarily unrenderable. Remove it anyway?')) return;
			await api.packs.remove(id); await openPacks(trigger);
		}); });
	}
	async function openSettings(trigger) {
		var info = await api.app.info(); var channel = await api.updates.channel();
		openDrawer('Settings', '<section class="desktop-settings-section"><h4>Updates</h4><label class="desktop-setting-row"><span><strong>Release channel</strong><small>Stable is recommended. Beta receives preview builds.</small></span><select id="desktop-channel" class="input"><option value="stable" ' + (channel === 'stable' ? 'selected' : '') + '>Stable</option><option value="beta" ' + (channel === 'beta' ? 'selected' : '') + '>Beta</option></select></label><button id="desktop-check-update" type="button">Check for Updates</button></section><section class="desktop-settings-section"><h4>About</h4><p><strong>Set Conjurer ' + escapeHtml(info.version) + '</strong><br><span class="input-description">' + escapeHtml(info.platform + ' · ' + info.arch) + '</span></p><p class="input-description">A local-first open-source desktop fork of Card Conjurer, originally created by Kyle Burton and maintained by its contributors. No account, cloud storage, or telemetry.</p><button id="desktop-report-issue" type="button">Report an Issue on GitHub</button></section>', trigger);
		document.querySelector('#desktop-channel').addEventListener('change', function(event) { void api.updates.setChannel(event.target.value); });
		document.querySelector('#desktop-check-update').addEventListener('click', function() { void api.updates.check(); });
		document.querySelector('#desktop-report-issue').addEventListener('click', function() { void api.app.reportIssue(); });
	}
	async function onboarding() {
		if (await api.app.onboardingComplete()) return;
		var packs = await api.packs.list(); document.querySelector('#desktop-onboarding-packs').innerHTML = packs.map(function(pack) { return packCard(pack, false); }).join('');
		document.querySelector('#desktop-onboarding').showModal();
	}
	async function completeOnboarding() {
		var status = document.querySelector('#desktop-onboarding-progress'); var button = document.querySelector('#desktop-onboarding-start');
		button.disabled = true; status.textContent = 'Preparing frame packs…';
		try { var ids = Array.from(document.querySelectorAll('#desktop-onboarding-packs [data-pack-id]:checked')).map(function(input) { return input.dataset.packId; }); await api.packs.install(ids); await api.app.completeOnboarding(); location.reload(); }
		catch (error) { status.textContent = error.message; button.disabled = false; }
	}
	function updateControl(state) {
		var button = document.querySelector('#desktop-update'); if (!button) return;
		button.hidden = !['available','downloading','verifying','staged','failed'].includes(state.phase);
		button.className = 'creator-app-action desktop-update-action phase-' + state.phase;
		button.disabled = ['downloading','verifying'].includes(state.phase);
		button.style.setProperty('--update-progress', Math.round(state.progress || 0) * 3.6 + 'deg');
		button.textContent = state.phase === 'staged' ? 'Restart' : state.phase === 'available' ? 'Update Now' : state.phase === 'failed' ? 'Retry Update' : Math.round(state.progress || 0) + '%';
		button.title = state.message;
	}
	async function updateAction() { var state = await api.updates.state(); if (state.phase === 'staged') return api.app.restart(); if (state.phase === 'available') return api.updates.begin(); return api.updates.check(); }
	async function ensureRequiredPacks(requirements) {
		var ids = (requirements || []).map(function(item) { return typeof item === 'string' ? item : item.id; }).filter(Boolean);
		if (!ids.length) return;
		var installed = await api.packs.list(); var missing = ids.filter(function(id) { var pack = installed.find(function(item) { return item.id === id; }); return !pack || !pack.installed; });
		if (!missing.length) return;
		if (!confirm('This file needs the ' + missing.join(', ') + ' frame pack' + (missing.length === 1 ? '' : 's') + ' to match the sender. Download now?')) throw new Error('Import canceled because required frame packs are missing.');
		await api.packs.install(missing);
	}
	var printCards = [];
	async function openPrint(scope) {
		if (!root.CardConjurerSets) return;
		await root.CardConjurerSets.captureActiveCard(); var state = root.CardConjurerSets.getState(); var set = state.sets.find(function(item) { return item.id === state.activeSetId; });
		printCards = state.cards.filter(function(card) { return card.setId === state.activeSetId && (scope !== 'card' || card.id === set.activeCardId); });
		document.querySelector('#desktop-print-title').textContent = scope === 'card' ? 'Print Card' : 'Print Set'; document.querySelector('#desktop-print').hidden = false; document.body.classList.add('desktop-printing'); renderPrintList(); renderPrintPages();
	}
	function renderPrintList() {
		document.querySelector('#desktop-print-cards').innerHTML = printCards.map(function(card, index) { var title = card.derived && card.derived.title || 'Untitled Card'; return '<label class="desktop-print-card"><span class="sets-card-thumbnail">' + (card.thumbnail ? '<img src="' + card.thumbnail + '" alt="">' : '') + '</span><span><strong>' + escapeHtml(title) + '</strong><small>' + escapeHtml(card.collectorNumber || '') + '</small></span><input class="input" type="number" min="0" max="99" value="' + (card.printQuantity == null ? 1 : card.printQuantity) + '" data-print-index="' + index + '" aria-label="Quantity for ' + escapeHtml(title) + '"></label>'; }).join('');
		document.querySelectorAll('[data-print-index]').forEach(function(input) { input.addEventListener('change', function(event) { var card = printCards[Number(event.target.dataset.printIndex)]; card.printQuantity = root.SetConjurerPrint.quantity(event.target.value); event.target.value = card.printQuantity; void root.CardConjurerSets.updatePrintQuantity(card.id, card.printQuantity); renderPrintPages(); }); });
	}
	function cardPrintHtml(card) { return '<article class="desktop-print-slot">' + (card.thumbnail ? '<img src="' + card.thumbnail + '" alt="">' : '<span>Preview unavailable</span>') + '<i class="trim-tick trim-top"></i><i class="trim-tick trim-bottom"></i><i class="trim-tick trim-left"></i><i class="trim-tick trim-right"></i></article>'; }
	function renderPrintPages() {
		if (!root.SetConjurerPrint) return; var pages = root.SetConjurerPrint.pages(printCards);
		document.querySelector('#desktop-print-pages').innerHTML = pages.map(function(cards, index) {
			var front = '<section class="desktop-print-page paper-' + selectedPaper + '" aria-label="Front print page ' + (index + 1) + '"><div class="desktop-print-grid">' + cards.map(cardPrintHtml).join('') + '</div></section>';
			if (selectedBack !== 'standard') return front;
			var mirrored = root.SetConjurerPrint.backSlots(cards);
			var back = '<section class="desktop-print-page desktop-print-page-back paper-' + selectedPaper + '" aria-label="Back print page ' + (index + 1) + '"><div class="desktop-print-grid">' + mirrored.map(function(card) { return card ? '<article class="desktop-print-slot"><img src="/core/standard-card-back.png" alt="Standard card back"></article>' : '<article class="desktop-print-slot" aria-hidden="true"></article>'; }).join('') + '</div></section>';
			return front + back;
		}).join('');
	}
	function closePrint() { var view = document.querySelector('#desktop-print'); if (view && !view.hidden) { view.hidden = true; document.body.classList.remove('desktop-printing'); } }
	async function runPrint() { await api.print.run({paper: selectedPaper, backMode: selectedBack}); }
	root.SetConjurerDesktop = {openPacks: openPacks, openSettings: openSettings, openPrint: openPrint, ensureRequiredPacks: ensureRequiredPacks};

	shell();
	document.body.addEventListener('htmx:afterSwap', function() { toolbar(); });
	var observer = new MutationObserver(toolbar); observer.observe(document.querySelector('#content'), {childList:true, subtree:true});
	api.packs.onProgress(function(progress) { var status = document.querySelector('#desktop-pack-progress') || document.querySelector('#desktop-onboarding-progress'); if (status) status.textContent = progress.message + ' ' + Math.round(progress.percent) + '%'; });
	api.updates.onState(updateControl); api.files.onAssociatedFile(function(file) { if (root.CardConjurerSets) void root.CardConjurerSets.importText(file.name.endsWith('.cardconjurer-card') ? 'card' : 'set', file.content); });
	void api.updates.state().then(updateControl); void onboarding(); toolbar();
})(window);
