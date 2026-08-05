(function(root) {
	'use strict';
	var api = root.setConjurerDesktop;
	if (!api) return;
	var drawerReturnFocus = null;
	var settingsRequestId = 0;
	var activePackActionId = null;
	var selectedPaper = (function() { try { return ['US','CA'].includes(new Intl.Locale(navigator.language).region) ? 'letter' : 'a4'; } catch (error) { return 'letter'; } })();
	var selectedBack = 'standard';
	var onboardingPacks = [];
	var resolveEditorReady;
	var editorReady = new Promise(function(resolve) { resolveEditorReady = resolve; });

	function escapeHtml(value) {
		return String(value == null ? '' : value).replace(/[&<>"']/g, function(character) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]; });
	}
	function formatBytes(value) {
		var bytes = Math.max(0, Number(value) || 0); if (!bytes) return '0 B';
		var units = ['B','KB','MB','GB','TB']; var index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
		var amount = bytes / Math.pow(1024, index); return amount.toFixed(index > 1 && amount < 10 ? 1 : 0) + ' ' + units[index];
	}
	function icon(name) {
		if (name === 'packs') return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7 12 3l8 4-8 4-8-4Z"/><path d="m4 12 8 4 8-4M4 17l8 4 8-4"/></svg>';
		if (name === 'back') return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>';
		if (name === 'print') return '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6z"/></svg>';
		return '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>';
	}
	function shell() {
		document.body.classList.add('desktop-shell');
		var legacyHeader = document.querySelector('body > header'); if (legacyHeader) legacyHeader.hidden = true;
		if (document.querySelector('#desktop-drawer')) return;
		document.body.insertAdjacentHTML('beforeend',
			'<button type="button" class="creator-app-action desktop-icon-action desktop-menu-action" id="desktop-settings" title="Settings" aria-label="Settings">' + icon('settings') + '</button>' +
			'<div id="desktop-overlay" class="desktop-overlay" hidden></div>' +
			'<aside id="desktop-drawer" class="textbox-editor layout-drawer desktop-drawer" role="dialog" aria-modal="true" aria-labelledby="desktop-drawer-title" aria-hidden="true"><div class="textbox-editor-heading"><h2 id="desktop-drawer-title" class="textbox-editor-title">Set Conjurer</h2></div><button type="button" class="textbox-editor-close" aria-label="Close drawer">×</button><div id="desktop-drawer-body" class="layout-drawer-body"></div></aside>' +
			'<dialog id="desktop-onboarding" class="sets-dialog desktop-onboarding"><form method="dialog"><header class="desktop-onboarding-header"><img class="desktop-onboarding-mark" src="/resources/icons/set-conjurer.png" alt="Set Conjurer"><h2>Welcome to Set Conjurer</h2><p>Choose the frame packs you want available offline. Pack sizes are shown before anything downloads.</p></header><div id="desktop-onboarding-packs" class="desktop-pack-list desktop-onboarding-pack-list"></div><div class="desktop-onboarding-download"><strong id="desktop-onboarding-total">Calculating download…</strong><button id="desktop-onboarding-retry" type="button" class="input" hidden>Retry pack list</button></div><div id="desktop-onboarding-progress" class="desktop-pack-progress desktop-onboarding-progress" hidden aria-live="polite"><span class="desktop-pack-progress-label"></span><span class="desktop-pack-progress-track" aria-hidden="true"><i></i></span></div><footer class="desktop-onboarding-footer"><small class="desktop-onboarding-credit">Set Conjurer is an open-source desktop fork of Kyle Burton\'s Card Conjurer, adapted for local set creation. <a href="https://github.com/lawlordev/cardconjurer" target="_blank" rel="noreferrer">View repository</a></small><button id="desktop-onboarding-start" type="button" class="sets-confirm" disabled>Download &amp; Continue</button></footer></form></dialog>' +
			'<section id="desktop-print" class="desktop-print" hidden aria-label="Print cards"><header class="desktop-print-toolbar"><button type="button" class="creator-app-action desktop-print-back" id="desktop-print-close">' + icon('back') + '<span>Back</span></button><div class="desktop-print-toolbar-actions"><select id="desktop-print-paper" class="input desktop-print-select" aria-label="Paper size"><option value="letter">US Letter</option><option value="a4">A4</option></select><select id="desktop-print-backs" class="input desktop-print-select desktop-print-back-select" aria-label="Card backs"><option value="standard">Standard card back</option><option value="none">No backs</option></select><button type="button" class="creator-app-action desktop-print-run" id="desktop-print-run" disabled>' + icon('print') + '<span>Print</span></button></div></header><div class="desktop-print-content"><aside class="desktop-print-sidebar"><div id="desktop-print-cards" class="desktop-print-card-list"></div></aside><main class="desktop-print-preview"><div id="desktop-print-pages" class="desktop-print-pages"></div></main></div></section>'
		);
		document.querySelector('#desktop-settings').addEventListener('click', function(event) { void openSettings(event.currentTarget); });
		document.querySelector('#desktop-drawer .textbox-editor-close').addEventListener('click', closeDrawer);
		document.querySelector('#desktop-overlay').addEventListener('click', closeDrawer);
		document.querySelector('#desktop-onboarding-start').addEventListener('click', completeOnboarding);
		document.querySelector('#desktop-onboarding-retry').addEventListener('click', function() { void loadOnboardingCatalog(); });
		document.querySelector('#desktop-print-close').addEventListener('click', closePrint);
		document.querySelector('#desktop-print-run').addEventListener('click', runPrint);
		document.querySelector('#desktop-print-paper').addEventListener('change', function(event) { selectedPaper = event.target.value; renderPrintPages(); });
		document.querySelector('#desktop-print-paper').value = selectedPaper;
		document.querySelector('#desktop-print-backs').addEventListener('change', function(event) { selectedBack = event.target.value; renderPrintPages(); });
		document.addEventListener('keydown', function(event) { if (event.key === 'Escape') { closeDrawer(); closePrint(); } });
	}
	function toolbar() {
		var host = document.querySelector('.creator-app-status-area');
		if (!host || document.querySelector('#desktop-toolbar-actions')) return;
		host.insertAdjacentHTML('afterbegin', '<span id="desktop-toolbar-actions" class="desktop-toolbar-actions"><button type="button" class="creator-app-action desktop-update-action" id="desktop-update" hidden>Update Now</button></span>');
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
		var required = pack.required || pack.id === 'standard';
		var checked = required || pack.installed;
		var disabled = pack.required || !pack.available || pack.id === 'standard';
		if (!selectable) return '<label class="checkbox-container input workspace-checkbox desktop-onboarding-pack"><span><strong>' + escapeHtml(pack.displayName) + '</strong><small>' + escapeHtml(pack.archiveBytes ? formatBytes(pack.archiveBytes) : 'Size unavailable') + '</small></span><input type="checkbox" data-pack-id="' + pack.id + '" ' + (checked ? 'checked ' : '') + (disabled ? 'disabled ' : '') + '><span class="checkmark"></span></label>';
		var version = pack.installedVersion || pack.availableVersion || '';
		var status = pack.installed ? 'Installed' + (version ? ' · ' + escapeHtml(version) : '') + (pack.updateAvailable ? ' · Update available in the consolidated updater' : '') : pack.available ? 'Version ' + escapeHtml(version) : 'Not available in this build yet';
		var action = pack.installed && pack.updateAvailable
			? '<button type="button" class="creator-app-action desktop-pack-action" disabled>Update available</button>'
			: pack.installed
			? required
				? '<button type="button" class="creator-app-action desktop-pack-action" disabled>Installed</button>'
				: '<button type="button" class="creator-app-action desktop-pack-action danger" data-uninstall-pack="' + pack.id + '">Uninstall</button>'
			: pack.available
				? '<button type="button" class="creator-app-action desktop-pack-action sets-primary" data-install-pack="' + pack.id + '">Install</button>'
				: '<button type="button" class="creator-app-action desktop-pack-action" disabled>Unavailable</button>';
		return '<article class="desktop-pack-row" data-pack-row="' + pack.id + '"><span><strong>' + escapeHtml(pack.displayName) + '</strong><small>' + status + '</small></span>' + action + '<div class="desktop-pack-progress" hidden aria-live="polite"><span class="desktop-pack-progress-label"></span><span class="desktop-pack-progress-track" aria-hidden="true"><i></i></span></div></article>';
	}
	function packDrawerContent(packs) {
		return '<div class="desktop-pack-list">' + packs.map(function(pack) { return packCard(pack, true); }).join('') + '</div>';
	}
	function packRow(id) { return document.querySelector('#desktop-drawer [data-pack-row="' + id + '"]'); }
	function setPackProgress(progress) {
		var row = activePackActionId && packRow(activePackActionId); if (!row) return false;
		var container = row.querySelector('.desktop-pack-progress'); var label = row.querySelector('.desktop-pack-progress-label'); var fill = row.querySelector('.desktop-pack-progress-track i');
		container.hidden = false; container.classList.remove('is-error'); label.textContent = progress.message + ' ' + Math.round(progress.percent) + '%'; fill.style.width = Math.max(0, Math.min(100, progress.percent)) + '%';
		var button = row.querySelector('.desktop-pack-action'); if (button) button.disabled = true;
		return true;
	}
	function setPackError(id, error) {
		var row = packRow(id); if (!row) return;
		var container = row.querySelector('.desktop-pack-progress'); container.hidden = false; container.classList.add('is-error');
		row.querySelector('.desktop-pack-progress-label').textContent = error && error.message ? error.message : String(error);
		row.querySelector('.desktop-pack-progress-track i').style.width = '0%';
		var button = row.querySelector('.desktop-pack-action'); if (button) button.disabled = false;
	}
	async function refreshPackList(focusId, trigger) {
		var packs = await api.packs.list(); var list = document.querySelector('#desktop-drawer .desktop-pack-list'); if (list) list.outerHTML = packDrawerContent(packs); bindPackActions(trigger);
		var row = focusId && packRow(focusId); var button = row && row.querySelector('.desktop-pack-action:not(:disabled)'); if (button) button.focus();
	}
	function bindPackActions(trigger) {
		document.querySelectorAll('#desktop-drawer [data-install-pack]').forEach(function(button) { button.addEventListener('click', async function(event) {
			var id = event.currentTarget.dataset.installPack; activePackActionId = id; setPackProgress({id: id, percent: 0, message: 'Preparing download…'});
			try { await api.packs.install([id]); await refreshPackList(id, trigger); activePackActionId = null; } catch (error) { activePackActionId = null; setPackError(id, error); }
		}); });
		document.querySelectorAll('#desktop-drawer [data-uninstall-pack]').forEach(function(button) { button.addEventListener('click', async function(event) {
			var id = event.currentTarget.dataset.uninstallPack; var affected = 0;
			if (root.CardConjurerSets && root.FRAME_REGISTRY) affected = root.CardConjurerSets.getState().cards.filter(function(card) { var pack = card.uiState && (card.uiState.activeFrameCustomizationPack || card.uiState.activeFramePack); return pack && root.FRAME_REGISTRY.category(pack) === id; }).length;
			if (affected && !confirm(affected + ' saved card' + (affected === 1 ? ' uses' : 's use') + ' this pack and will be temporarily unrenderable. Uninstall it anyway?')) return;
			activePackActionId = id; setPackProgress({id: id, percent: 0, message: 'Uninstalling…'});
			try { await api.packs.remove(id); await refreshPackList(id, trigger); activePackActionId = null; } catch (error) { activePackActionId = null; setPackError(id, error); }
		}); });
	}
	async function openPacks(trigger) {
		var packs = await api.packs.list(); openDrawer('Frame Packs', packDrawerContent(packs), trigger); bindPackActions(trigger);
	}
	function settingsDrawerContent(info, channel, packs) {
		return '<div id="desktop-settings-content"><section class="layout-control-group desktop-settings-section"><div class="layout-control-heading"><h3>Frame Packs</h3></div>' + packDrawerContent(packs) + '</section><section class="layout-control-group desktop-settings-section"><div class="layout-control-heading"><h3>Updates</h3></div><label class="desktop-setting-row"><span><strong>Release channel</strong><small>Stable receives finished releases. Beta also receives preview builds.</small></span><select id="desktop-channel" class="input"><option value="stable" ' + (channel === 'stable' ? 'selected' : '') + '>Stable</option><option value="beta" ' + (channel === 'beta' ? 'selected' : '') + '>Beta</option></select></label><button id="desktop-check-update" class="input" type="button">Check for Updates</button><p id="desktop-update-status" class="desktop-inline-status" aria-live="polite"></p><div id="desktop-update-details"></div></section><section class="layout-control-group desktop-settings-section"><div class="layout-control-heading"><h3>About</h3></div><p class="desktop-about-product"><strong>Set Conjurer ' + escapeHtml(info.version) + '</strong><small>' + escapeHtml(info.platform + ' · ' + info.arch) + '</small></p><p class="desktop-about-copy">A local-first open-source desktop fork of Card Conjurer, originally created by Kyle Burton and maintained by its contributors. No account, cloud storage, or telemetry.</p><button id="desktop-report-issue" class="input" type="button">Report an Issue on GitHub</button></section></div>';
	}
	function activeSettingsDrawer() {
		return document.querySelector('#desktop-drawer.opened #desktop-settings-content');
	}
	function bindSettingsActions(updateState) {
		var updateButton = document.querySelector('#desktop-check-update');
		updateSettingsStatus(updateState);
		document.querySelector('#desktop-channel').addEventListener('change', async function(event) { await api.updates.setChannel(event.target.value); updateSettingsStatus(await api.updates.check()); });
		updateButton.addEventListener('click', async function() { updateSettingsStatus(await api.updates.check()); });
		document.querySelector('#desktop-report-issue').addEventListener('click', function() { void api.app.reportIssue(); });
	}
	async function openSettings(trigger) {
		var requestId = ++settingsRequestId;
		openDrawer('Settings', '<div id="desktop-settings-content" class="desktop-settings-loading"><span class="creator-loading-spinner" aria-hidden="true"></span><p class="desktop-inline-status desktop-settings-loading-copy" role="status">Loading settings…</p></div>', trigger);
		var refreshPromise = api.packs.refresh().catch(function() { return null; });
		var values;
		try { values = await Promise.all([api.app.info(), api.updates.channel(), api.updates.state(), api.packs.list()]); }
		catch (error) {
			var loadingView = requestId === settingsRequestId && activeSettingsDrawer();
			if (loadingView) { loadingView.classList.remove('desktop-settings-loading'); loadingView.innerHTML = '<p class="desktop-inline-status" role="alert">Could not load settings: ' + escapeHtml(error && error.message ? error.message : error) + '</p>'; }
			return;
		}
		if (requestId !== settingsRequestId || !activeSettingsDrawer()) return;
		document.querySelector('#desktop-drawer-body').innerHTML = settingsDrawerContent(values[0], values[1], values[3]);
		bindPackActions(trigger);
		bindSettingsActions(values[2]);
		var refreshedPacks = await refreshPromise;
		var settings = activeSettingsDrawer();
		if (requestId !== settingsRequestId || !settings || !refreshedPacks) return;
		var list = settings.querySelector('.desktop-pack-list');
		if (list) list.outerHTML = packDrawerContent(refreshedPacks);
		bindPackActions(trigger);
	}
	function selectedOnboardingIds() { return Array.from(document.querySelectorAll('#desktop-onboarding-packs [data-pack-id]:checked')).map(function(input) { return input.dataset.packId; }); }
	function updateOnboardingTotal() {
		var ids = selectedOnboardingIds(); var bytes = onboardingPacks.filter(function(pack) { return ids.includes(pack.id) && !pack.installed; }).reduce(function(total, pack) { return total + (pack.archiveBytes || 0); }, 0);
		document.querySelector('#desktop-onboarding-total').textContent = 'Total download: ' + formatBytes(bytes);
	}
	function renderOnboardingPacks(packs) {
		onboardingPacks = packs; document.querySelector('#desktop-onboarding-packs').innerHTML = packs.map(function(pack) { return packCard(pack, false); }).join('');
		document.querySelectorAll('#desktop-onboarding-packs [data-pack-id]').forEach(function(input) { input.addEventListener('change', updateOnboardingTotal); });
		updateOnboardingTotal();
	}
	async function loadOnboardingCatalog() {
		var progress = document.querySelector('#desktop-onboarding-progress'); var retry = document.querySelector('#desktop-onboarding-retry'); var button = document.querySelector('#desktop-onboarding-start');
		progress.hidden = false; progress.classList.remove('is-error'); progress.querySelector('.desktop-pack-progress-label').textContent = 'Loading available frame packs…'; progress.querySelector('i').style.width = '0%'; retry.hidden = true; button.disabled = true;
		try { var packs = await api.packs.refresh(); renderOnboardingPacks(packs); progress.hidden = true; button.disabled = !packs.filter(function(pack) { return pack.required; }).every(function(pack) { return pack.available; }); }
		catch (error) { renderOnboardingPacks(await api.packs.list()); progress.classList.add('is-error'); progress.querySelector('.desktop-pack-progress-label').textContent = error.message || String(error); retry.hidden = false; }
	}
	async function onboarding() {
		if (await api.app.onboardingComplete()) { resolveEditorReady(); return; }
		document.querySelector('#desktop-onboarding').showModal(); await loadOnboardingCatalog();
	}
	async function completeOnboarding() {
		var progress = document.querySelector('#desktop-onboarding-progress'); var button = document.querySelector('#desktop-onboarding-start');
		button.disabled = true; progress.hidden = false; progress.classList.remove('is-error'); progress.querySelector('.desktop-pack-progress-label').textContent = 'Preparing selected frame packs…'; progress.querySelector('i').style.width = '0%';
		try { await api.packs.install(selectedOnboardingIds()); await api.app.completeOnboarding(); location.reload(); }
		catch (error) { progress.classList.add('is-error'); progress.querySelector('.desktop-pack-progress-label').textContent = error.message || String(error); button.disabled = false; }
	}
	function updateDetailsMarkup(state) {
		if (!state.items || !state.items.length) return '';
		return '<div class="desktop-pack-list desktop-update-item-list">' + state.items.map(function(item) {
			var versions = (item.currentVersion ? escapeHtml(item.currentVersion) + ' → ' : '') + escapeHtml(item.targetVersion);
			return '<article class="desktop-pack-row desktop-update-item"><span><strong>' + escapeHtml(item.displayName) + '</strong><small>' + versions + (item.bytes ? ' · ' + formatBytes(item.bytes) : '') + '</small></span><small>' + escapeHtml(item.phase) + '</small></article>';
		}).join('') + '</div>';
	}
	function updateSettingsStatus(state) {
		var status = document.querySelector('#desktop-update-status'); if (status) status.textContent = state.message;
		var details = document.querySelector('#desktop-update-details'); if (details) details.innerHTML = updateDetailsMarkup(state);
	}
	function updateControl(state) {
		var button = document.querySelector('#desktop-update'); if (!button) return;
		var actionableFailure = state.phase === 'failed' && state.transactionId;
		button.hidden = !(['available','downloading','verifying','staged'].includes(state.phase) || actionableFailure);
		button.className = 'creator-app-action desktop-update-action phase-' + state.phase;
		button.disabled = ['downloading','verifying'].includes(state.phase);
		button.style.setProperty('--update-progress', Math.round(state.progress || 0) * 3.6 + 'deg');
		button.textContent = state.phase === 'staged' ? 'Restart' : state.phase === 'available' ? 'Update Now' : state.phase === 'failed' ? 'Retry Update' : Math.round(state.progress || 0) + '%';
		button.title = state.message;
		updateSettingsStatus(state);
	}
	async function updateAction() { var state = await api.updates.state(); if (state.phase === 'staged') return api.app.restart(); if (state.phase === 'available' || (state.phase === 'failed' && state.transactionId)) return api.updates.begin(); return api.updates.check(); }
	async function ensureRequiredPacks(requirements) {
		var ids = (requirements || []).map(function(item) { return typeof item === 'string' ? item : item.id; }).filter(Boolean);
		if (!ids.length) return;
		var installed = await api.packs.list(); var missing = ids.filter(function(id) { var pack = installed.find(function(item) { return item.id === id; }); return !pack || !pack.installed; });
		if (!missing.length) return;
		if (!confirm('This file needs the ' + missing.join(', ') + ' frame pack' + (missing.length === 1 ? '' : 's') + ' to match the sender. Download now?')) throw new Error('Import canceled because required frame packs are missing.');
		await api.packs.install(missing);
	}
	var printCards = [];
	var printSourceUrls = [];
	var printJobToken = 0;
	function releasePrintSources() {
		printSourceUrls.forEach(function(url) { URL.revokeObjectURL(url); });
		printSourceUrls = [];
		printCards.forEach(function(card) { delete card.printSource; });
	}
	async function openPrint(scope) {
		if (!root.CardConjurerSets) return;
		var token = ++printJobToken;
		releasePrintSources();
		await root.CardConjurerSets.captureActiveCard(); var state = root.CardConjurerSets.getState(); var set = state.sets.find(function(item) { return item.id === state.activeSetId; });
		printCards = state.cards.filter(function(card) { return card.setId === state.activeSetId && (scope !== 'card' || card.id === set.activeCardId); });
		var view = document.querySelector('#desktop-print'); var printButton = document.querySelector('#desktop-print-run');
		view.hidden = false; view.classList.add('is-rendering'); document.body.classList.add('desktop-printing'); printButton.disabled = true; renderPrintList(); renderPrintPages();
		try {
			var images = await root.CardConjurerSets.renderPrintImages(printCards.map(function(card) { return card.id; }));
			if (token !== printJobToken) return;
			printCards.forEach(function(card) { var blob = images[card.id]; if (!blob) return; var url = URL.createObjectURL(blob); printSourceUrls.push(url); card.printSource = url; });
			renderPrintPages();
			await waitForPrintImages();
			if (token !== printJobToken) return;
			view.classList.remove('is-rendering'); printButton.disabled = false;
		} catch (error) {
			if (token !== printJobToken) return;
			view.classList.remove('is-rendering'); printButton.disabled = true; console.error(error);
		}
	}
	function renderPrintList() {
		document.querySelector('#desktop-print-cards').innerHTML = printCards.map(function(card, index) { var title = card.derived && card.derived.title || 'Untitled Card'; var quantity = card.printQuantity == null ? 1 : card.printQuantity; return '<article class="desktop-print-card"><span class="sets-card-thumbnail">' + (card.thumbnail ? '<img src="' + card.thumbnail + '" alt="">' : '') + '</span><span><strong>' + escapeHtml(title) + '</strong><small>' + escapeHtml(card.collectorNumber || '') + '</small></span><span class="desktop-print-quantity" aria-label="Quantity for ' + escapeHtml(title) + '"><button type="button" data-print-index="' + index + '" data-print-delta="-1" aria-label="Decrease quantity" ' + (quantity <= 0 ? 'disabled' : '') + '>−</button><output>' + quantity + '</output><button type="button" data-print-index="' + index + '" data-print-delta="1" aria-label="Increase quantity" ' + (quantity >= 99 ? 'disabled' : '') + '>+</button></span></article>'; }).join('');
		document.querySelectorAll('[data-print-delta]').forEach(function(button) { button.addEventListener('click', function(event) { var index = Number(event.currentTarget.dataset.printIndex); var card = printCards[index]; card.printQuantity = root.SetConjurerPrint.quantity(Number(card.printQuantity == null ? 1 : card.printQuantity) + Number(event.currentTarget.dataset.printDelta)); void root.CardConjurerSets.updatePrintQuantity(card.id, card.printQuantity); renderPrintList(); renderPrintPages(); }); });
	}
	function cardPrintHtml(card) { var source = root.SetConjurerPrint.source(card); return '<article class="desktop-print-slot">' + (source ? '<img src="' + source + '" alt="">' : '') + '<i class="trim-tick trim-top"></i><i class="trim-tick trim-bottom"></i><i class="trim-tick trim-left"></i><i class="trim-tick trim-right"></i></article>'; }
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
	async function waitForPrintImages() {
		var images = Array.from(document.querySelectorAll('#desktop-print-pages img'));
		await Promise.all(images.map(function(image) {
			if (image.complete && image.naturalWidth) return typeof image.decode === 'function' ? image.decode().catch(function() {}) : Promise.resolve();
			return new Promise(function(resolve) { image.addEventListener('load', resolve, {once:true}); image.addEventListener('error', resolve, {once:true}); });
		}));
	}
	function closePrint() { var view = document.querySelector('#desktop-print'); if (view && !view.hidden) { printJobToken++; releasePrintSources(); view.hidden = true; view.classList.remove('is-rendering'); document.body.classList.remove('desktop-printing'); } }
	async function runPrint() {
		var button = document.querySelector('#desktop-print-run'); if (!button || button.disabled) return;
		button.disabled = true; button.setAttribute('aria-busy','true');
		try { await waitForPrintImages(); await api.print.run({paper: selectedPaper, backMode: selectedBack}); }
		catch (error) { console.error(error); }
		finally { button.removeAttribute('aria-busy'); button.disabled = false; }
	}
	root.SetConjurerDesktop = {ready: editorReady, openPacks: openPacks, openSettings: openSettings, openPrint: openPrint, ensureRequiredPacks: ensureRequiredPacks};

	shell();
	document.body.addEventListener('htmx:afterSwap', function() { toolbar(); });
	var observer = new MutationObserver(toolbar); observer.observe(document.querySelector('#content'), {childList:true, subtree:true});
	api.packs.onProgress(function(progress) {
		var onboardingDialog = document.querySelector('#desktop-onboarding');
		if (onboardingDialog && onboardingDialog.open) {
			var container = document.querySelector('#desktop-onboarding-progress'); container.hidden = false; container.classList.remove('is-error');
			container.querySelector('.desktop-pack-progress-label').textContent = progress.message + ' ' + Math.round(progress.percent) + '% · ' + formatBytes(progress.receivedBytes) + ' / ' + formatBytes(progress.totalBytes);
			container.querySelector('i').style.width = Math.max(0, Math.min(100, progress.percent)) + '%'; return;
		}
		setPackProgress(progress);
	});
	api.updates.onState(updateControl); api.files.onAssociatedFile(function(file) { if (root.CardConjurerSets) void root.CardConjurerSets.importText(file.name.endsWith('.cardconjurer-card') ? 'card' : 'set', file.content); });
	void api.updates.state().then(updateControl); void onboarding(); toolbar();
})(window);
