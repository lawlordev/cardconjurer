import {copyFile, mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import { _electron as electron, chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const userData = await mkdtemp(path.join(os.tmpdir(), 'set-conjurer-e2e-'));
const packFixture = await mkdtemp(path.join(os.tmpdir(), 'set-conjurer-pack-fixture-'));
const evidence = process.env.SET_CONJURER_EVIDENCE_DIR || path.join(os.tmpdir(), 'set-conjurer-evidence');
await mkdir(evidence, {recursive: true});
const errors = [];
let application;
const packagedExecutable = process.env.SET_CONJURER_TEST_EXECUTABLE || '';
let packagedProcess;

async function buildMinimalPackFixture() {
  const source = await readFile(path.join(root, 'js', 'frames', 'packM15Regular-1.js'), 'utf8');
  const assets = new Set([...source.matchAll(/['"`](\/img\/frames\/[^'"`$}]+)['"`]/g)].map((match) => match[1].replace(/^\//, '')));
  assets.add('img/frames/m15/regular/m15FrameA.png');
  const placeholder = path.join(root, 'img', 'frames', 'cornerCutout.png');
  for (const asset of assets) {
    const variants = asset.toLowerCase().endsWith('.png')
      ? [asset, asset.replace(/\.png$/i, 'Thumb.png')]
      : [asset];
    for (const variant of variants) {
      const destination = path.join(packFixture, variant);
      await mkdir(path.dirname(destination), {recursive: true});
      if (variant.toLowerCase().endsWith('.svg')) {
        await writeFile(destination, '<svg xmlns="http://www.w3.org/2000/svg" width="1005" height="1407"><rect width="1005" height="1407" fill="#111827"/></svg>\n');
      } else {
        await copyFile(placeholder, destination);
      }
    }
  }
  const symbol = path.join(packFixture, 'img', 'setSymbols', 'custom', 'test-c.png');
  await mkdir(path.dirname(symbol), {recursive: true});
  await copyFile(placeholder, symbol);
}

await buildMinimalPackFixture();

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function launchPackaged() {
  const port = await availablePort();
  packagedProcess = spawn(packagedExecutable, [`--remote-debugging-port=${port}`], {
    cwd: root,
    env: {...process.env, SET_CONJURER_USER_DATA: userData, SET_CONJURER_TEST_PACK_ROOT: packFixture, ELECTRON_ENABLE_LOGGING: '1'},
    detached: true,
    windowsHide: true,
    stdio: 'ignore'
  });
  packagedProcess.unref();
  let browser;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); break; }
    catch (error) { await new Promise((resolve) => setTimeout(resolve, 125)); }
  }
  if (!browser) throw new Error('Packaged Electron did not open its local debugging endpoint.');
  let page;
  for (let attempt = 0; attempt < 80 && !page; attempt += 1) {
    page = browser.contexts().flatMap((context) => context.pages()).find((candidate) => candidate.url().startsWith('set-conjurer://'));
    if (!page) await new Promise((resolve) => setTimeout(resolve, 125));
  }
  if (!page) throw new Error('Packaged Electron did not create the Set Conjurer window.');
  return {firstWindow: async () => page, close: async () => { await page.close().catch(() => {}); await browser.close(); }};
}

try {
  application = packagedExecutable ? await launchPackaged() : await electron.launch({
    args: [root], cwd: root,
    env: {...process.env, SET_CONJURER_USER_DATA: userData, SET_CONJURER_TEST_PACK_ROOT: packFixture, SET_CONJURER_ALLOW_TEST_INSTANCE: '1', ELECTRON_ENABLE_LOGGING: '1'}
  });
  const page = await application.firstWindow();
  page.on('console', (message) => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(`console: ${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('response', (response) => {
    const resourceType = response.request().resourceType();
    if (response.status() >= 400 && (['document','script','stylesheet'].includes(resourceType) || (resourceType === 'image' && response.url().startsWith('set-conjurer://')))) errors.push(`response ${response.status()}: ${response.url()}`);
  });
  try {
    await page.waitForSelector('#desktop-onboarding[open]', {timeout: 20_000});
  } catch (error) {
    await page.screenshot({path: path.join(evidence, '00-failure.png'), fullPage: true});
    console.error(`URL: ${page.url()}\nTitle: ${await page.title()}\nBody: ${(await page.locator('body').innerText().catch(() => '')).slice(0, 2000)}\nErrors: ${errors.join('\n')}`);
    throw error;
  }
  await page.screenshot({path: path.join(evidence, '01-onboarding.png'), fullPage: true});
  const standard = page.locator('#desktop-onboarding-packs [data-pack-id="standard"]');
  if (!(await standard.isChecked()) || !(await standard.isDisabled())) throw new Error('Standard pack is not required and locked on.');
  if (await page.locator('#desktop-onboarding-packs .desktop-onboarding-pack small').count() !== 7) throw new Error('Onboarding does not show a size for every pack.');
  if (!(await page.locator('#desktop-onboarding-total').innerText()).startsWith('Total download:')) throw new Error('Onboarding does not show the selected total.');
  if (await page.locator('#desktop-onboarding-progress').count() !== 1) throw new Error('Onboarding does not have exactly one aggregate progress indicator.');
  if (await page.locator('#desktop-onboarding-packs [data-pack-id="tokens"]').isDisabled()) throw new Error('Published optional packs are not selectable on first launch.');
  await page.click('#desktop-onboarding-start');
  await page.waitForSelector('.creator-workspace.is-ready', {timeout: 45_000});
  await page.waitForFunction(() => {
    const canvas = document.querySelector('#previewCanvas');
    if (!canvas) return false;
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    for (let index = 3; index < pixels.length; index += 160) if (pixels[index] > 0) return true;
    return false;
  }, null, {timeout: 20_000});
  await page.waitForTimeout(500);
  errors.length = 0; // Pre-onboarding frame requests are expected before packs activate and the page reloads.
  const requiredFrameAvailable = await page.evaluate(async () => (await fetch('/img/frames/m15/regular/m15FrameA.png')).ok);
  if (!requiredFrameAvailable) throw new Error('The installed Standard pack does not resolve its default frame asset.');

  await page.locator('#creator-menu-tabs .selectable').filter({hasText: /^Text$/}).click();
  const rulesField = page.locator('.text-field-card[data-text-key="rules"]');
  if (process.env.SET_CONJURER_KEYWORD_E2E === '1') {
    const defaultWorkflow = await page.evaluate(() => {
	  const api = window.CardConjurerKeywordReminders;
	  const source = api.DEFAULT_KEYWORDS.map((item) => item.example).join('\n');
	  const first = api.applyAll(source);
	  const second = api.applyAll(first.text);
	  return {
		count: api.DEFAULT_KEYWORDS.length,
		reminderCount: api.DEFAULT_KEYWORDS.filter((item) => item.reminderRaw).length,
		pseudoCount: api.DEFAULT_KEYWORDS.filter((item) => item.mode === 'pseudo').length,
		occurrenceCount: first.occurrences.length,
		changeCount: first.changes.length,
		formattedCount: first.occurrences.filter((item) => item.hasGeneratedFormatting).length,
		idempotent: second.text === first.text && second.changes.length === 0
	  };
	});
	if (defaultWorkflow.occurrenceCount !== defaultWorkflow.count || defaultWorkflow.changeCount !== defaultWorkflow.count || defaultWorkflow.formattedCount !== defaultWorkflow.pseudoCount || !defaultWorkflow.idempotent) throw new Error(`Complete MSE catalog workflow failed: ${JSON.stringify(defaultWorkflow)}`);
    const rulesInput = rulesField.locator('.text-field-input');
	await rulesInput.fill('Flying\nScry 2\nEquip Knight {2}\nInvestigate\nWard {2}');
	await page.waitForFunction(() => document.querySelectorAll('.keyword-occurrence-row').length === 5);
	if ((await rulesInput.inputValue()).includes('{i}(')) throw new Error('Typing a recognized keyword inserted reminder text without an explicit checkbox click.');
	if (await page.locator('.keyword-occurrence-row input:checked').count()) throw new Error('Recognized keyword checkboxes must start unchecked.');

    await page.click('#keyword-manager-open');
    await page.waitForSelector('#keyword-manager-drawer.opened');
	if (await page.locator('#keyword-auto-reminders').count()) throw new Error('The removed automatic reminder option is still rendered.');
	if (await page.locator('#keyword-default-count, .keyword-defaults, #keyword-custom-placement, .keyword-empty-state').count()) throw new Error('Legacy keyword manager controls are still rendered.');
	if ((await page.locator('.keyword-library-row').count()) !== defaultWorkflow.count) throw new Error('Keyword manager did not show the complete MSE catalog.');
	const keywordLayout = await page.evaluate(() => {
	  const drawer = document.querySelector('#keyword-manager-drawer');
	  const heading = drawer.querySelector('.textbox-editor-heading');
	  const toolbar = drawer.querySelector('.keyword-library-heading');
	  const search = drawer.querySelector('#keyword-search');
	  const list = drawer.querySelector('#keyword-library-list');
	  const initial = [heading, toolbar, search].map((item) => item.getBoundingClientRect().top);
	  list.scrollTop = Math.min(600, list.scrollHeight);
	  const after = [heading, toolbar, search].map((item) => item.getBoundingClientRect().top);
	  return {
		drawerOverflow: getComputedStyle(drawer).overflowY,
		listOverflow: getComputedStyle(list).overflowY,
		rowHeight: list.querySelector('.keyword-library-row').getBoundingClientRect().height,
		fixed: initial.every((value, index) => Math.abs(value - after[index]) < 1),
		names: [...list.querySelectorAll('.keyword-library-summary strong')].map((item) => item.textContent.trim())
	  };
	});
	if (keywordLayout.drawerOverflow !== 'hidden' || keywordLayout.listOverflow !== 'auto' || keywordLayout.rowHeight < 30 || !keywordLayout.fixed) throw new Error(`Keyword drawer chrome or rows rendered incorrectly: ${JSON.stringify(keywordLayout)}`);
	const sortedKeywordNames = [...keywordLayout.names].sort((left, right) => left.localeCompare(right, undefined, {sensitivity:'base'}));
	if (keywordLayout.names.some((name, index) => name !== sortedKeywordNames[index])) throw new Error('Keyword library is not alphabetized.');
	await page.fill('#keyword-search', 'blocked except');
	if (!(await page.locator('.keyword-library-row').count())) throw new Error('Reminder-text keyword search returned no results.');
	await page.fill('#keyword-search', 'Vigilance');
	if (!(await page.locator('.keyword-library-row').count())) throw new Error('Name keyword search returned no results.');
	await page.fill('#keyword-search', 'one_word');
	if (!(await page.locator('.keyword-library-row').count())) throw new Error('Recognition-pattern keyword search returned no results.');
	await page.click('#keyword-search-clear');
	const initialSelection = page.locator('.keyword-library-row').nth(0);
	const nextSelection = page.locator('.keyword-library-row').nth(1);
	await initialSelection.locator('.keyword-library-summary').click();
	if (!(await initialSelection.locator('.keyword-library-details').isVisible())) throw new Error('Selecting a keyword did not reveal its recognition and reminder text.');
	if ((await page.locator('.keyword-library-row.selected .keyword-library-details dt').allTextContents()).join('|') !== 'Recognition pattern|Reminder text|Example') throw new Error('Expanded keyword details did not include recognition, reminder, and example fields.');
	await nextSelection.locator('.keyword-library-summary').click();
	if ((await page.locator('.keyword-library-row.selected').count()) !== 1 || await initialSelection.locator('.keyword-library-details').isVisible()) throw new Error('Selecting a keyword did not deselect the previous keyword.');
	await page.fill('#keyword-search', 'Detain');
	const detainRow = page.locator('.keyword-library-row[data-keyword-id="detain"]');
	await detainRow.locator('.keyword-library-summary').click();
	const detainDetails = await detainRow.locator('.keyword-library-details').innerText();
	if (!/Detain <english_number> target <nonland> <one_word>/.test(detainDetails) || !/those creatures can't attack or block/.test(detainDetails) || !/detain two target nonland creatures/.test(detainDetails) || /<atom-param>|\{if |param1/.test(detainDetails)) throw new Error(`Detain exposed malformed MSE internals: ${detainDetails}`);
	await page.locator('#keyword-search-clear').hover();
	const searchClearLayout = await page.evaluate(() => {
	  const search = document.querySelector('.keyword-search').getBoundingClientRect();
	  const clear = document.querySelector('#keyword-search-clear').getBoundingClientRect();
	  return {inside:clear.top >= search.top && clear.bottom <= search.bottom, centerDelta:Math.abs((search.top + search.height / 2) - (clear.top + clear.height / 2)), transform:getComputedStyle(document.querySelector('#keyword-search-clear')).transform};
	});
	if (!searchClearLayout.inside || searchClearLayout.centerDelta > 1 || searchClearLayout.transform === 'none') throw new Error(`Keyword search clear hover escaped its field: ${JSON.stringify(searchClearLayout)}`);
	await page.click('#keyword-search-clear');
	await page.click('#keyword-custom-toggle');
	if ((await page.locator('#keyword-custom-toggle').innerText()) !== 'Cancel' || !(await page.locator('#keyword-custom-form').isVisible())) throw new Error('Add did not become Cancel and reveal the custom keyword form.');
	if (await page.locator('.keyword-pattern-help').count()) throw new Error('The removed inline custom-pattern help paragraph is still rendered.');
	if (await page.locator('#keyword-custom-preview-status').count() || await page.locator('.keyword-occurrence-heading small').count()) throw new Error('Removed keyword helper copy is still rendered.');
    await page.fill('#keyword-custom-name', 'Ward');
    await page.fill('#keyword-custom-pattern', 'Ward {cost}');
    await page.fill('#keyword-custom-reminder', 'Whenever this permanent becomes the target of a spell or ability an opponent controls, counter it unless that player pays {cost}.');
	await page.fill('#keyword-custom-example', 'Ward {2}');
	await page.waitForFunction(() => document.querySelector('#keyword-custom-preview')?.dataset.state === 'match');
	const previewReminder = page.locator('#keyword-custom-preview-output em');
	if (!/Ward/.test(await page.locator('#keyword-custom-preview-output').innerText()) || !/Whenever/.test(await page.locator('#keyword-custom-preview-output').innerText()) || (await page.locator('#keyword-custom-preview-output .keyword-preview-mana').count()) < 2 || (await previewReminder.count()) !== 1 || (await previewReminder.evaluate((element) => getComputedStyle(element).fontStyle)) !== 'italic') throw new Error('The live test example did not render expanded card text, italic reminder text, and mana symbols.');
	const formActionLayout = await page.evaluate(() => {
	  const help = document.querySelector('#keyword-help-open').getBoundingClientRect();
	  const save = document.querySelector('#keyword-custom-save').getBoundingClientRect();
	  return {helpLeft:help.left, saveLeft:save.left, centerDelta:Math.abs((help.top + help.height / 2) - (save.top + save.height / 2))};
	});
	if (formActionLayout.helpLeft >= formActionLayout.saveLeft || formActionLayout.centerDelta > 1) throw new Error(`Keyword Help is not aligned left of Save Keyword: ${JSON.stringify(formActionLayout)}`);
	await page.click('#keyword-help-open');
	await page.waitForSelector('#keyword-help-drawer.opened');
	await page.waitForFunction(() => Math.abs(innerWidth - document.querySelector('#keyword-help-drawer').getBoundingClientRect().right) < 1);
	await page.screenshot({path: path.join(evidence, '02-keyword-preview-help.png'), fullPage: true});
	const helpLayout = await page.evaluate(() => {
	  const drawer = document.querySelector('#keyword-help-drawer').getBoundingClientRect();
	  return {right:Math.abs(innerWidth - drawer.right), left:drawer.left, viewportWidth:innerWidth, placeholders:document.querySelectorAll('.keyword-help-reference > div').length};
	});
	if (helpLayout.right > 1 || helpLayout.left < helpLayout.viewportWidth / 2 || helpLayout.placeholders !== 8 || !/dedication to/.test(await page.locator('#keyword-help-drawer').innerText())) throw new Error(`Keyword Help did not use the complete right-side drawer pattern: ${JSON.stringify(helpLayout)}`);
	await page.keyboard.press('Escape');
	if (await page.locator('#keyword-help-drawer.opened').count() || !(await page.locator('#keyword-manager-drawer.opened').count()) || !(await page.locator('#keyword-custom-form').isVisible())) throw new Error('Escape did not close only Keyword Help and return to the custom form.');
    await page.click('#keyword-custom-save');
	await page.fill('#keyword-search', 'opponent controls');
    await page.waitForSelector('#keyword-library-list [data-keyword-source="custom"][data-keyword-id="custom-ward"]');
	if ((await page.evaluate(() => JSON.parse(localStorage.getItem('set-conjurer-custom-keywords-v1'))[0].placement)) !== 'line-end') throw new Error('New custom keywords do not default to end-of-line reminder placement.');
	await page.click('#keyword-search-clear');

    await page.locator('#keyword-import-file').setInputFiles({
      name: 'keyword-import.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        format: 'set-conjurer-keywords', schemaVersion: 1, keywords: [
		  {id:'custom-astral', name:'Astral', pattern:'Astral {number}', reminder:'This enters with {number} astral counters.', example:'Astral 2'},
		  {id:'custom-dedication', name:'Dedication', pattern:'dedication to <atom-param>one_word</atom-param>', reminder:'Each {color_to_mana(param1)} in the mana cost of a card counts toward its dedication to {param1}.', example:'dedication to white'}
        ]
      }))
    });
	await page.waitForSelector('#keyword-library-list [data-keyword-source="custom"][data-keyword-id="custom-astral"]');
	if (await page.locator('#keyword-manager-status:not([hidden])').count()) throw new Error('Import displayed a success verification message.');
	await page.locator('#keyword-manager-drawer .textbox-editor-close').click();

	await rulesInput.fill('Tap an untapped white creature you control: Until end of turn, creatures you control get +X/+X, where X is that creature’s dedication to white. (Each {W} in the mana cost of a card counts toward its dedication to white.)');
	await page.waitForFunction(() => document.querySelectorAll('.keyword-occurrence-row').length === 1);
	if (!(await page.locator('.keyword-occurrence-row input').isChecked()) || !/Dedication/i.test(await page.locator('.keyword-occurrence-row strong').innerText())) throw new Error('An existing MSE-style custom reminder was not recognized and pre-checked.');

	await rulesInput.fill('Hellbent — This creature gets +1/+1.');
	await page.waitForFunction(() => document.querySelectorAll('.keyword-occurrence-row').length === 1);
	await page.locator('.keyword-occurrence-row .checkmark').click();
	if ((await rulesInput.inputValue()) !== '{i}Hellbent{/i} — This creature gets +1/+1.') throw new Error('Pseudo keyword checkbox did not apply only MSE ability-word italics.');

	await rulesInput.fill('Flying, vigilance, lifelink');
	await page.waitForFunction(() => document.querySelectorAll('.keyword-occurrence-row').length === 3);
	await page.locator('.keyword-occurrence-row .checkmark').nth(1).click();
	if (!/^Flying, vigilance, lifelink \{i\}\(Attacking/.test(await rulesInput.inputValue())) throw new Error('Comma-separated keyword reminder did not move after the full sequence.');

    await rulesInput.fill('Flying\nWard {2}\nFlying\nAstral 3');
    await page.waitForFunction(() => document.querySelectorAll('.keyword-occurrence-row').length === 4);
	if ((await rulesInput.inputValue()).includes('{i}(')) throw new Error('Custom keyword recognition inserted reminder text automatically.');
	for (const index of [1, 3, 0, 2]) await page.locator('.keyword-occurrence-row .checkmark').nth(index).click();
	const expandedCustomText = await rulesInput.inputValue();
	if (!expandedCustomText.includes('pays {2}') || !expandedCustomText.includes('3 astral counters')) throw new Error('Custom keyword creation/import did not participate in live recognition.');
	await page.locator('.keyword-occurrence-row .checkmark').nth(2).click();
	const suppressedText = await rulesInput.inputValue();
	if ((suppressedText.match(/\{i\}\(/g) || []).length !== 3) throw new Error('Explicit per-occurrence removal did not remove exactly one reminder.');
	const suppressionState = await page.evaluate(() => ({
	  custom: JSON.parse(localStorage.getItem('set-conjurer-custom-keywords-v1') || '[]').map((item) => item.id),
	  suppressions: card.text.rules.keywordReminderSuppressions
	}));
	if (!suppressionState.custom.includes('custom-ward') || !suppressionState.custom.includes('custom-astral') || !suppressionState.custom.includes('custom-dedication')) throw new Error(`Custom keyword persistence failed: ${JSON.stringify(suppressionState)}`);
	if (suppressionState.suppressions !== undefined) throw new Error(`Removed automatic-suppression metadata was persisted: ${JSON.stringify(suppressionState)}`);
    await page.screenshot({path: path.join(evidence, '02-keyword-workflow.png'), fullPage: true});
  }
  await rulesField.getByRole('button', {name: 'Layout', exact: true}).click();
  const typographyInput = page.locator('#textbox-editor-font-size');
  const typographyIncrease = page.getByRole('button', {name: 'Increase Text field font size adjustment', exact: true});
  const typographyBefore = Number(await typographyInput.inputValue());
  await page.evaluate(() => {
    window.__setConjurerHeldTypographyRenders = [];
    window.__setConjurerHeldTypographyInputs = [];
    document.querySelector('#textbox-editor-font-size')?.addEventListener('input', event => {
      window.__setConjurerHeldTypographyInputs.push(Number(event.currentTarget.value));
    });
    window.addEventListener('cardconjurer:preview-rendered', () => {
      window.__setConjurerHeldTypographyRenders.push(document.querySelector('#textbox-editor-font-size')?.value);
    });
  });
  await page.waitForTimeout(250); // Let the layout drawer finish sliding before targeting its control.
  const typographyButton = await typographyIncrease.boundingBox();
  if (!typographyButton) throw new Error('Typography increase control is not visible.');
  await page.mouse.move(typographyButton.x + typographyButton.width / 2, typographyButton.y + typographyButton.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1_150);
  const heldTypography = await page.evaluate(() => ({
    value: Number(document.querySelector('#textbox-editor-font-size')?.value),
    renders: [...window.__setConjurerHeldTypographyRenders],
    inputs: [...window.__setConjurerHeldTypographyInputs]
  }));
  await page.mouse.up();
  if (heldTypography.value <= typographyBefore + 1 || heldTypography.renders.length < 2) {
    throw new Error(`Held Typography did not update the preview continuously: ${JSON.stringify({typographyBefore, heldTypography})}`);
  }
  if (
    heldTypography.inputs[0] !== typographyBefore + 1
    || heldTypography.inputs.at(-1) !== heldTypography.value
    || heldTypography.inputs.some((value, index) => index > 0 && value !== heldTypography.inputs[index - 1] + 1)
  ) {
    throw new Error(`Held Typography skipped displayed values: ${JSON.stringify({typographyBefore, heldTypography})}`);
  }
  await page.locator('#textbox-editor .textbox-editor-close').click();

  if (!packagedExecutable) {
    await application.evaluate(({ipcMain}) => {
      globalThis.__setConjurerZipExportRequest = {bytes: 0, signature: [], completed: false, saved: false};
      for (const channel of ['desktop:archive-begin', 'desktop:archive-append', 'desktop:archive-complete', 'desktop:archive-save', 'desktop:archive-cancel']) ipcMain.removeHandler(channel);
      ipcMain.handle('desktop:archive-begin', () => ({id: '00000000-0000-4000-8000-000000000001'}));
      ipcMain.handle('desktop:archive-append', (_event, _id, chunk) => {
        const bytes = Buffer.from(chunk);
        globalThis.__setConjurerZipExportRequest.bytes += bytes.length;
        if (!globalThis.__setConjurerZipExportRequest.signature.length) globalThis.__setConjurerZipExportRequest.signature = [...bytes.subarray(0, 4)];
      });
      ipcMain.handle('desktop:archive-complete', () => { globalThis.__setConjurerZipExportRequest.completed = true; });
      ipcMain.handle('desktop:archive-save', () => {
        globalThis.__setConjurerZipExportRequest.saved = true;
        return {canceled: false, path: 'set-conjurer-test.zip'};
      });
      ipcMain.handle('desktop:archive-cancel', () => {});
    });
    if (await page.locator('#download-format').count()) throw new Error('The ZIP export regression requires the removed legacy format control to stay absent.');
    await page.evaluate(async () => { await window.CardConjurerSets.duplicateCard(); });
    await page.evaluate(() => {
      const input = document.querySelector('.text-field-input[data-text-key="title"]');
      input.value = 'ZIP modal preview sentinel';
      input.dispatchEvent(new Event('input', {bubbles: true}));
    });
    await page.evaluate(async () => { await window.CardConjurerSets.captureActiveCard('Prepare ZIP modal regression card', ''); });
    await page.evaluate(() => {
      window.__setConjurerZipDialogOpened = false;
      window.__setConjurerZipPreviewChanged = false;
      const preview = document.querySelector('#previewCanvas');
      const previewBeforeExport = preview.toDataURL();
      window.addEventListener('cardconjurer:preview-rendered', () => {
        if (document.querySelector('#sets-zip-dialog')?.open && preview.toDataURL() !== previewBeforeExport) window.__setConjurerZipPreviewChanged = true;
      });
      const showModal = HTMLDialogElement.prototype.showModal;
      HTMLDialogElement.prototype.showModal = function() {
        if (this.id === 'sets-zip-dialog') window.__setConjurerZipDialogOpened = true;
        return showModal.call(this);
      };
    });
    await page.locator('.sets-options-dropdown > summary').click();
    await page.getByRole('button', {name: 'Download Images', exact: true}).click();
    await page.waitForSelector('#sets-zip-dialog[open]');
    const zipModalStyles = await page.evaluate(() => {
      const dialog = document.querySelector('#sets-zip-dialog');
      const cancel = document.querySelector('#sets-zip-cancel');
      const style = (element) => { const computed = getComputedStyle(element); return {background: computed.backgroundColor, border: computed.borderTopColor, color: computed.color, radius: computed.borderTopLeftRadius}; };
      const tokenProbe = document.createElement('span');
      tokenProbe.style.cssText = 'position:absolute;visibility:hidden;border:1px solid var(--workspace-control-border);border-radius:var(--workspace-radius);color:var(--workspace-control-text);background:var(--workspace-control)';
      dialog.appendChild(tokenProbe);
      const expected = style(tokenProbe);
      tokenProbe.remove();
      return {cancel: style(cancel), expected, backdrop: getComputedStyle(dialog, '::backdrop').backgroundColor};
    });
    if (JSON.stringify(zipModalStyles.cancel) !== JSON.stringify(zipModalStyles.expected)) throw new Error(`ZIP cancel action does not inherit the themed neutral action: ${JSON.stringify(zipModalStyles)}`);
    await page.screenshot({path: path.join(evidence, '04-zip-export.png'), fullPage: true});
    let zipExportRequest = null;
    for (let attempt = 0; attempt < 80 && !zipExportRequest?.saved; attempt += 1) {
      zipExportRequest = await application.evaluate(() => globalThis.__setConjurerZipExportRequest);
      if (!zipExportRequest?.saved) await page.waitForTimeout(125);
    }
    if (!zipExportRequest?.completed || !zipExportRequest.saved || zipExportRequest.bytes === 0 || zipExportRequest.signature[0] !== 0x50 || zipExportRequest.signature[1] !== 0x4b) throw new Error(`Download Images did not stream a ZIP to the native save bridge: ${JSON.stringify(zipExportRequest)}`);
    const zipDialogState = await page.evaluate(() => ({opened: window.__setConjurerZipDialogOpened, stillOpen: document.querySelector('#sets-zip-dialog')?.open, previewChanged: window.__setConjurerZipPreviewChanged}));
    if (!zipDialogState.opened || zipDialogState.stillOpen || zipDialogState.previewChanged) throw new Error(`Download Images did not isolate and dismiss its progress modal before saving: ${JSON.stringify(zipDialogState)}`);
    if (!(await page.locator('#sets-error').evaluate((element) => element.hidden))) throw new Error(`Download Images failed: ${await page.locator('#sets-error').innerText()}`);
  }
  const sharedRadius = await page.locator('#desktop-settings').evaluate((element) => getComputedStyle(element).borderTopLeftRadius);
  const settingsPointerContract = await page.locator('#desktop-settings').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      appRegion: style.getPropertyValue('-webkit-app-region'),
      background: style.backgroundColor,
      center: {x: rect.left + (rect.width / 2), y: rect.top + (rect.height / 2)},
      hitTarget: document.elementFromPoint(rect.left + (rect.width / 2), rect.top + (rect.height / 2))?.closest('#desktop-settings')?.id || ''
    };
  });
  if (settingsPointerContract.appRegion !== 'no-drag' || settingsPointerContract.hitTarget !== 'desktop-settings') throw new Error(`Settings is not a physical pointer target outside the macOS drag region: ${JSON.stringify(settingsPointerContract)}`);
  await page.mouse.move(settingsPointerContract.center.x, settingsPointerContract.center.y);
  const settingsHover = await page.locator('#desktop-settings').evaluate((element) => ({hovered: element.matches(':hover'), background: getComputedStyle(element).backgroundColor}));
  if (!settingsHover.hovered || settingsHover.background === settingsPointerContract.background) throw new Error(`Settings does not expose its hover state to a physical pointer: ${JSON.stringify({settingsPointerContract, settingsHover})}`);
  for (const [selector, label] of [
    ['.creator-new-set', 'New Set'],
    ['.creator-card-action-buttons > button', 'card action button'],
    ['.creator-card-action-dropdown > summary', 'card action dropdown'],
    ['.sets-card-row', 'set card row'],
    ['.segmented-tab-track', 'segmented tab track'],
    ['.creator-workspace .input', 'workspace input'],
    ['.creator-workspace .readable-background', 'workspace card']
  ]) {
    const radius = await page.locator(selector).first().evaluate((element) => getComputedStyle(element).borderTopLeftRadius);
    if (radius !== sharedRadius) throw new Error(`${label} does not use the shared ${sharedRadius} radius: ${radius}`);
  }
  const concentricRadii = await page.evaluate(() => {
    const radius = (selector) => getComputedStyle(document.querySelector(selector)).borderTopLeftRadius;
    const segmentedTrack = document.querySelector('.segmented-tab-track');
    return {
      segmentedFill: getComputedStyle(segmentedTrack, '::after').borderTopLeftRadius,
      editorTab: radius('.creator-workspace .creator-menu-tabs .selectable'),
      collectorNumber: radius('.sets-card-row > b'),
      checkmark: radius('.creator-workspace .workspace-checkbox .checkmark')
    };
  });
  if (concentricRadii.segmentedFill !== concentricRadii.editorTab) throw new Error(`segmented selector and tab radii diverge: ${JSON.stringify(concentricRadii)}`);
  const [outerRadiusValue, segmentedRadiusValue, nestedRadiusValue, compactRadiusValue] = [sharedRadius, concentricRadii.segmentedFill, concentricRadii.collectorNumber, concentricRadii.checkmark].map(Number.parseFloat);
  if (!(compactRadiusValue < nestedRadiusValue && nestedRadiusValue < segmentedRadiusValue && segmentedRadiusValue < outerRadiusValue)) {
    throw new Error(`nested component radii are not concentric: ${JSON.stringify({sharedRadius, ...concentricRadii})}`);
  }
  const updateButton = page.locator('#desktop-update');
  if (await updateButton.isVisible()) throw new Error('Update action is visible before an update is available.');
  const updatePlacement = await updateButton.evaluate((button) => ({
    insideSaveStatus: Boolean(button.closest('.creator-app-context')),
    statusArea: button.parentElement?.parentElement?.classList.contains('creator-app-status-area'),
    saveStatusFollows: button.parentElement?.nextElementSibling?.classList.contains('creator-app-context')
  }));
  if (updatePlacement.insideSaveStatus || !updatePlacement.statusArea || !updatePlacement.saveStatusFollows) throw new Error(`update action is not a separate sibling of save status: ${JSON.stringify(updatePlacement)}`);
  await page.mouse.move(600, 400);
  await updateButton.evaluate((button) => { button.hidden = false; button.className = 'creator-app-action desktop-update-action phase-available'; button.textContent = 'Update Now'; });
  const [newSetStyle, saveStatusHeight, updateStyle] = await Promise.all([
    page.locator('.creator-new-set').evaluate((element) => { const style = getComputedStyle(element); return {background: style.backgroundColor, border: style.borderTopColor, color: style.color, radius: style.borderTopLeftRadius, weight: style.fontWeight}; }),
    page.locator('.creator-app-context').evaluate((element) => getComputedStyle(element).height),
    updateButton.evaluate((element) => { const style = getComputedStyle(element); return {background: style.backgroundColor, border: style.borderTopColor, color: style.color, height: style.height, radius: style.borderTopLeftRadius, weight: style.fontWeight}; })
  ]);
  const {height: updateHeight, ...updateAppearance} = updateStyle;
  if (JSON.stringify(updateAppearance) !== JSON.stringify(newSetStyle)) throw new Error(`Update Now does not match New Set styling: ${JSON.stringify({newSetStyle, updateStyle})}`);
  if (updateHeight !== saveStatusHeight) throw new Error(`Update Now does not match save-status height: ${JSON.stringify({saveStatusHeight, updateHeight})}`);
  const progressStyle = await updateButton.evaluate((button) => {
    button.className = 'creator-app-action desktop-update-action phase-downloading'; button.disabled = true; button.textContent = '42%'; button.style.setProperty('--update-progress', '151.2deg');
    const style = getComputedStyle(button); const progress = getComputedStyle(button, '::before');
    return {opacity: style.opacity, cursor: style.cursor, height: style.height, progressBackground: progress.backgroundImage, text: button.textContent};
  });
  if (progressStyle.opacity !== '1' || progressStyle.cursor !== 'wait' || progressStyle.height !== saveStatusHeight || progressStyle.progressBackground === 'none' || progressStyle.text !== '42%') throw new Error(`update progress is not visibly contained in the standalone action: ${JSON.stringify({saveStatusHeight, progressStyle})}`);
  const restartStyle = await updateButton.evaluate((button) => {
    button.className = 'creator-app-action desktop-update-action phase-staged'; button.disabled = false; button.textContent = 'Restart';
    const style = getComputedStyle(button); return {background: style.backgroundColor, border: style.borderTopColor, color: style.color, height: style.height, radius: style.borderTopLeftRadius, weight: style.fontWeight};
  });
  const {height: restartHeight, ...restartAppearance} = restartStyle;
  if (JSON.stringify(restartAppearance) !== JSON.stringify(newSetStyle) || restartHeight !== saveStatusHeight) throw new Error(`Restart does not match New Set styling and save-status height: ${JSON.stringify({newSetStyle, saveStatusHeight, restartStyle})}`);
  await updateButton.evaluate((button) => { button.hidden = true; button.removeAttribute('style'); });
  const cardActions = page.locator('.creator-card-action-buttons');
  if (await cardActions.getByRole('button', {name: 'Copy Card', exact: true}).count()) throw new Error('Copy Card action is still present.');
  const importCardDropdown = cardActions.locator('.creator-card-action-dropdown').filter({hasText: 'Import Card'});
  if (await importCardDropdown.count() !== 1) throw new Error('Import Card dropdown is missing.');
  const importChevron = importCardDropdown.locator(':scope > summary .card-specific-chevron');
  const importChevronClosedBox = await importChevron.boundingBox();
  await importCardDropdown.locator(':scope > summary').click();
  await page.waitForTimeout(160);
  const importChevronOpenBox = await importChevron.boundingBox();
  if (!importChevronClosedBox || !importChevronOpenBox || Math.abs((importChevronClosedBox.y + importChevronClosedBox.height / 2) - (importChevronOpenBox.y + importChevronOpenBox.height / 2)) > 0.5) throw new Error('Import Card chevron shifts vertically while rotating.');
  for (const label of ['.cardconjurer-card file', 'Card search']) {
    if (!(await importCardDropdown.getByRole('button', {name: label, exact: true}).isVisible())) throw new Error(`Import Card option is missing: ${label}`);
  }
  await importCardDropdown.getByRole('button', {name: 'Card search', exact: true}).click();
  await page.waitForSelector('#card-search-drawer.opened[aria-hidden="false"]');
  await page.evaluate(() => window.CardConjurerSets.closeCardSearch(false));
  await importCardDropdown.locator(':scope > summary').click();
  const fileChooserPromise = page.waitForEvent('filechooser');
  await importCardDropdown.getByRole('button', {name: '.cardconjurer-card file', exact: true}).click();
  const fileChooser = await fileChooserPromise;
  if (!(await fileChooser.element().evaluate((input) => input.id === 'sets-card-import'))) throw new Error('Import Card file action did not open the card import input.');
  await fileChooser.setFiles([]);
  await page.locator('.creator-grid').evaluate((grid) => {
    grid.style.transition = 'none';
  });
  const newSetDropdown = page.locator('.creator-new-set-dropdown');
  const newSetTrigger = newSetDropdown.locator(':scope > summary');
  await newSetTrigger.click();
  if (!(await newSetDropdown.evaluate((element) => element.open))) throw new Error('New Set did not open from its trigger.');
  const newSetMenuBackground = await newSetDropdown.locator(':scope > .creator-action-dropdown-menu').evaluate((menu) => getComputedStyle(menu).backgroundColor);
  if (newSetMenuBackground !== 'rgb(17, 24, 39)') throw new Error(`New Set menu is not opaque: ${newSetMenuBackground}`);
  const newSetOptionBackgrounds = await newSetDropdown.locator(':scope > .creator-action-dropdown-menu > button').evaluateAll((buttons) => buttons.map((button) => getComputedStyle(button).backgroundColor));
  if (newSetOptionBackgrounds.some((background) => background !== 'rgb(17, 24, 39)')) throw new Error(`New Set option rows are not opaque: ${newSetOptionBackgrounds.join(', ')}`);
  const [newSetMenuRadius, newSetOptionRadius] = await Promise.all([
    newSetDropdown.locator(':scope > .creator-action-dropdown-menu').evaluate((element) => Number.parseFloat(getComputedStyle(element).borderTopLeftRadius)),
    newSetDropdown.locator(':scope > .creator-action-dropdown-menu > button').first().evaluate((element) => Number.parseFloat(getComputedStyle(element).borderTopLeftRadius))
  ]);
  if (!(newSetOptionRadius < newSetMenuRadius)) throw new Error(`New Set option radius is not inset from its menu: ${JSON.stringify({newSetMenuRadius, newSetOptionRadius})}`);
  await page.evaluate(() => {
    const grid = document.querySelector('.creator-grid');
    const menu = document.querySelector('.creator-new-set-dropdown > .creator-action-dropdown-menu');
    if (grid && menu) {
      const menuRect = menu.getBoundingClientRect();
      grid.style.setProperty('--sets-panel-width', `${menuRect.left + (menuRect.width / 2)}px`);
    }
  });
  const newSetDividerHitTarget = await page.evaluate(() => {
    const menu = document.querySelector('.creator-new-set-dropdown > .creator-action-dropdown-menu');
    const divider = document.querySelector('.workspace-resizer-left');
    if (!menu || !divider) return null;
    const menuRect = menu.getBoundingClientRect();
    const dividerRect = divider.getBoundingClientRect();
    const x = dividerRect.left + (dividerRect.width / 2);
    const y = menuRect.top + (menuRect.height / 2);
    const target = document.elementFromPoint(x, y);
    return {
      hit: x >= menuRect.left && x <= menuRect.right && target?.closest('.creator-action-dropdown-menu') === menu ? 'menu' : target?.className || target?.tagName || 'unknown',
      menu: {left: menuRect.left, right: menuRect.right, top: menuRect.top, bottom: menuRect.bottom},
      divider: {left: dividerRect.left, right: dividerRect.right, width: dividerRect.width},
      viewportWidth: window.innerWidth
    };
  });
  if (newSetDividerHitTarget?.hit !== 'menu') throw new Error(`New Set menu does not intercept the panel divider: ${JSON.stringify(newSetDividerHitTarget)}`);
  await newSetTrigger.click();
  if (await newSetDropdown.evaluate((element) => element.open)) throw new Error('New Set did not close when its trigger was clicked again.');
  await page.locator('.creator-grid').evaluate((grid) => grid.style.removeProperty('--sets-panel-width'));
  await newSetTrigger.click();
  await page.locator('.creator-card-actions').click({position: {x: 2, y: 2}});
  if (await newSetDropdown.evaluate((element) => element.open)) throw new Error('New Set did not close after an outside click.');
  await newSetTrigger.click();
  await page.keyboard.press('Escape');
  if (await newSetDropdown.evaluate((element) => element.open)) throw new Error('New Set did not close with Escape.');
  await page.locator('.creator-grid').evaluate((grid) => grid.style.setProperty('--sets-panel-width', '208px'));
  await page.waitForTimeout(100);
  const narrowCardListLayout = await page.locator('.sets-card-scroll').evaluate((scroll) => {
    const row = scroll.querySelector('.sets-card-row');
    const collectorNumber = row?.querySelector(':scope > b');
    if (!row || !collectorNumber) return null;
    const scrollRect = scroll.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const collectorRect = collectorNumber.getBoundingClientRect();
    return {
      clientWidth: scroll.clientWidth,
      scrollWidth: scroll.scrollWidth,
      scrollRight: scrollRect.right,
      rowRight: rowRect.right,
      collectorRight: collectorRect.right
    };
  });
  if (!narrowCardListLayout) throw new Error('Could not measure a card row at the minimum left-panel width.');
  if (narrowCardListLayout.scrollWidth > narrowCardListLayout.clientWidth + 1 || narrowCardListLayout.rowRight > narrowCardListLayout.scrollRight + 1 || narrowCardListLayout.collectorRight > narrowCardListLayout.scrollRight + 1) throw new Error(`Card rows overflow the minimum left-panel width: ${JSON.stringify(narrowCardListLayout)}`);
  await page.screenshot({path: path.join(evidence, '02-narrow-panel.png'), fullPage: true});
  await page.locator('.creator-grid').evaluate((grid) => grid.style.removeProperty('--sets-panel-width'));
  await page.screenshot({path: path.join(evidence, '02-editor.png'), fullPage: true});
  if (!packagedExecutable) {
    const settingsPacks = await page.evaluate(() => window.setConjurerDesktop.packs.list());
    await application.evaluate(({ipcMain}, packs) => {
      ipcMain.removeHandler('desktop:packs-list');
      ipcMain.handle('desktop:packs-list', async () => {
        await new Promise((resolve) => setTimeout(resolve, 800));
        return packs;
      });
      ipcMain.removeHandler('desktop:packs-refresh');
      ipcMain.handle('desktop:packs-refresh', async () => {
        await new Promise((resolve) => setTimeout(resolve, 1_200));
        return packs;
      });
    }, settingsPacks);
  }
  const settingsClickStarted = Date.now();
  await page.click('#desktop-settings');
  await page.waitForSelector('#desktop-drawer.opened');
  const settingsOpenMs = Date.now() - settingsClickStarted;
  if (settingsOpenMs > 500) throw new Error(`Settings drawer waited ${settingsOpenMs}ms before opening.`);
  if (!packagedExecutable) {
    await page.waitForSelector('#desktop-settings-content.desktop-settings-loading .creator-loading-spinner');
    const settingsLoadingStyle = await page.locator('#desktop-settings-content.desktop-settings-loading').evaluate((element) => {
      const copy = element.querySelector('.desktop-settings-loading-copy');
      const spinner = element.querySelector('.creator-loading-spinner');
      const body = element.parentElement;
      const drawer = element.closest('#desktop-drawer');
      const style = getComputedStyle(element);
      const copyStyle = getComputedStyle(copy);
      const bodyRect = body.getBoundingClientRect();
      const copyRect = copy.getBoundingClientRect();
      const spinnerRect = spinner.getBoundingClientRect();
      const groupRect = {left: Math.min(copyRect.left, spinnerRect.left), right: Math.max(copyRect.right, spinnerRect.right), top: Math.min(copyRect.top, spinnerRect.top), bottom: Math.max(copyRect.bottom, spinnerRect.bottom)};
      const tokenProbe = document.createElement('span');
      tokenProbe.style.color = 'var(--workspace-text)';
      document.body.appendChild(tokenProbe);
      const expectedColor = getComputedStyle(tokenProbe).color;
      tokenProbe.remove();
      return {
        drawerDisplay: getComputedStyle(drawer).display,
        position: style.position,
        inset: [style.top, style.right, style.bottom, style.left],
        placeContent: style.placeContent,
        color: copyStyle.color,
        expectedColor,
        horizontalOffset: Math.abs(((groupRect.left + groupRect.right) / 2) - ((bodyRect.left + bodyRect.right) / 2)),
        verticalOffset: Math.abs(((groupRect.top + groupRect.bottom) / 2) - ((bodyRect.top + bodyRect.bottom) / 2))
      };
    });
    if (settingsLoadingStyle.drawerDisplay !== 'flex' || settingsLoadingStyle.position !== 'absolute' || settingsLoadingStyle.inset.some((value) => value !== '0px') || settingsLoadingStyle.placeContent !== 'center' || settingsLoadingStyle.color !== settingsLoadingStyle.expectedColor || settingsLoadingStyle.horizontalOffset > 2 || settingsLoadingStyle.verticalOffset > 2) throw new Error(`Settings loading state is not centered with workspace text: ${JSON.stringify(settingsLoadingStyle)}`);
  }
  await page.waitForSelector('#desktop-channel', {state: 'attached'});
  await page.waitForTimeout(350);
  const packRowRadius = await page.locator('.desktop-pack-row').first().evaluate((element) => getComputedStyle(element).borderTopLeftRadius);
  if (packRowRadius !== sharedRadius) throw new Error(`settings drawer card does not use the shared ${sharedRadius} radius: ${packRowRadius}`);
  await page.screenshot({path: path.join(evidence, '03-settings-and-frame-packs.png'), fullPage: true});
  await page.click('#desktop-drawer .textbox-editor-close');
  await page.click('#desktop-settings');
  await page.waitForSelector('#desktop-drawer.opened');
  await page.click('#desktop-drawer .textbox-editor-close');
  await page.evaluate(() => {
    const renderPrintImages = window.CardConjurerSets.renderPrintImages;
    window.CardConjurerSets.renderPrintImages = async function(...args) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return renderPrintImages.apply(this, args);
    };
  });
  await page.locator('.creator-card-action-dropdown').first().click();
  await page.getByRole('button', {name: 'Print', exact: true}).click();
  await page.waitForSelector('#desktop-print:not([hidden])');
  await page.waitForSelector('#desktop-print-loading[open]');
  if ((await page.locator('#desktop-print-loading').innerText()).trim() !== 'Loading Pages...') throw new Error('Print preview loading state does not show the expected message.');
  const printLoadingStyle = await page.locator('#desktop-print-loading').evaluate((dialog) => {
    const copy = dialog.querySelector('.desktop-settings-loading-copy');
    const spinner = dialog.querySelector('.creator-loading-spinner');
    const copyStyle = getComputedStyle(copy);
    const spinnerStyle = getComputedStyle(spinner);
    return {fontFamily: copyStyle.fontFamily, fontSize: copyStyle.fontSize, fontWeight: copyStyle.fontWeight, spinnerWidth: Number.parseFloat(spinnerStyle.width), spinnerHeight: Number.parseFloat(spinnerStyle.height), spinnerAnimation: spinnerStyle.animationName};
  });
  if (!printLoadingStyle.fontFamily.includes('Montserrat') || printLoadingStyle.fontSize !== '11.52px' || printLoadingStyle.fontWeight !== '700' || Math.abs(printLoadingStyle.spinnerWidth - 18.4) > 0.1 || Math.abs(printLoadingStyle.spinnerHeight - 18.4) > 0.1 || printLoadingStyle.spinnerAnimation !== 'creator-loading-spin') throw new Error(`Print preview does not reuse the Settings loading treatment: ${JSON.stringify(printLoadingStyle)}`);
  await page.locator('#desktop-print-loading').waitFor({state: 'hidden'});
  for (const [selector, label] of [
    ['.desktop-print-toolbar-actions > button', 'print toolbar button'],
    ['.desktop-print .workspace-select-trigger', 'print dropdown'],
    ['.desktop-print-card', 'print card row']
  ]) {
    const radius = await page.locator(selector).first().evaluate((element) => getComputedStyle(element).borderTopLeftRadius);
    if (radius !== sharedRadius) throw new Error(`${label} does not use the shared ${sharedRadius} radius: ${radius}`);
  }
  const printQuantityRadius = await page.locator('.desktop-print-quantity').first().evaluate((element) => Number.parseFloat(getComputedStyle(element).borderTopLeftRadius));
  if (!(printQuantityRadius < outerRadiusValue)) throw new Error(`print quantity control is not concentric within its card: ${printQuantityRadius}px`);
  for (const selectId of ['#desktop-print-paper', '#desktop-print-backs']) {
    const trigger = page.locator(`${selectId} + .workspace-select > .workspace-select-trigger`);
    const chevron = trigger.locator('.card-specific-chevron');
    const [triggerBox, closedChevronBox] = await Promise.all([trigger.boundingBox(), chevron.boundingBox()]);
    if (!triggerBox || !closedChevronBox || Math.abs((triggerBox.x + triggerBox.width) - (closedChevronBox.x + closedChevronBox.width) - 12) > 3) throw new Error(`${selectId} chevron is not pinned to the right edge.`);
    await trigger.click();
    await page.waitForTimeout(160);
    const openChevronBox = await chevron.boundingBox();
    if (!openChevronBox || Math.abs((closedChevronBox.y + closedChevronBox.height / 2) - (openChevronBox.y + openChevronBox.height / 2)) > 0.5) {
      const chevronStyles = await chevron.evaluate((element) => ({transform: getComputedStyle(element).transform, transformOrigin: getComputedStyle(element).transformOrigin}));
      throw new Error(`${selectId} chevron shifts vertically while rotating: ${JSON.stringify({closedChevronBox, openChevronBox, chevronStyles})}`);
    }
    const dropdown = trigger.locator('..');
    if (!(await dropdown.evaluate((element) => element.classList.contains('open')))) throw new Error(`${selectId} did not open.`);
    await trigger.click();
    if (await dropdown.evaluate((element) => element.classList.contains('open'))) throw new Error(`${selectId} did not close when its trigger was clicked again.`);
  }
  const printPage = page.locator('.desktop-print-page');
  if (await printPage.count() < 2) throw new Error('Print preview did not create front and default back pages.');
  await page.screenshot({path: path.join(evidence, '05-print-preview.png'), fullPage: true});
  if (errors.length) throw new Error(`Renderer errors:\n${errors.join('\n')}`);
  console.log(`Electron smoke test passed. Evidence: ${evidence}`);
} finally {
  if (application) await application.close();
  if (packagedProcess && !packagedProcess.killed) packagedProcess.kill();
  await new Promise((resolve) => setTimeout(resolve, 400));
  await rm(userData, {recursive: true, force: true, maxRetries: 20, retryDelay: 100});
  await rm(packFixture, {recursive: true, force: true, maxRetries: 20, retryDelay: 100});
}
