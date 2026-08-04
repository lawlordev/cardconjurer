import {mkdtemp, mkdir, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import { _electron as electron } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const userData = await mkdtemp(path.join(os.tmpdir(), 'set-conjurer-regression-'));
const evidence = process.env.SET_CONJURER_EVIDENCE_DIR || path.join(os.tmpdir(), 'set-conjurer-regression-evidence');
await mkdir(evidence, {recursive: true});

const errors = [];
const checkpoints = [];
let application;
let page;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForSaved() {
  await page.waitForFunction(() => {
    const status = document.querySelector('#sets-global-status');
    return status && status.textContent !== 'Saving…';
  }, {timeout: 10_000});
}

async function checkpoint(name, action, {settle = 250, screenshot = false} = {}) {
  const errorCount = errors.length;
  await action();
  await page.waitForTimeout(settle);
  await waitForSaved();
  const newErrors = errors.slice(errorCount);
  if (newErrors.length) throw new Error(`${name} produced renderer errors:\n${newErrors.join('\n')}`);
  checkpoints.push(name);
  if (screenshot) {
    const number = String(checkpoints.length).padStart(2, '0');
    await page.screenshot({path: path.join(evidence, `${number}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`), fullPage: true});
  }
}

async function selectEditorTab(name) {
  await page.locator('#creator-menu-tabs h3', {hasText: name}).click();
  await page.waitForSelector(`#creator-menu-${name === 'Card Details' ? 'cardDetails' : name.toLowerCase()}:not(.hidden)`);
}

async function setCheckbox(selector, checked) {
  const input = page.locator(selector);
  if (await input.isChecked() === checked) return;
  await input.locator('xpath=ancestor::label[1]').click();
  assert(await input.isChecked() === checked, `${selector} did not change to ${checked ? 'checked' : 'unchecked'}.`);
}

async function selectOption(control, value) {
  const select = typeof control === 'string' ? page.locator(control) : control;
  if (await select.isVisible()) {
    await select.selectOption(value);
  } else {
    const dropdown = select.locator('xpath=following-sibling::div[contains(concat(" ", normalize-space(@class), " "), " workspace-select ")][1]');
    await dropdown.locator('.workspace-select-trigger').click();
    await dropdown.locator(`.workspace-select-choice[data-value="${value}"]`).click({force: true});
  }
  assert(await select.inputValue() === value, `Select did not change to ${value}.`);
}

async function waitForCardCount(count) {
  await page.waitForFunction((expected) => {
    const counter = document.querySelector('#sets-workspace-content .creator-eyebrow');
    return counter && counter.textContent.trim().startsWith(`${expected} card`);
  }, count, {timeout: 15_000});
}

try {
  application = await electron.launch({
    args: [root],
    cwd: root,
    env: {...process.env, SET_CONJURER_USER_DATA: userData, SET_CONJURER_ALLOW_TEST_INSTANCE: '1', ELECTRON_ENABLE_LOGGING: '1'}
  });
  page = await application.firstWindow();
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400 && ['document','script','stylesheet'].includes(response.request().resourceType())) {
      errors.push(`response ${response.status()}: ${response.url()}`);
    }
  });

  try {
    await page.waitForSelector('#desktop-onboarding[open]', {timeout: 20_000});
  } catch (error) {
    await page.screenshot({path: path.join(evidence, '00-startup-failure.png'), fullPage: true});
    console.error(`URL: ${page.url()}\nTitle: ${await page.title()}\nBody: ${(await page.locator('body').innerText().catch(() => '')).slice(0, 2000)}\nErrors: ${errors.join('\n')}`);
    throw error;
  }

  await checkpoint('onboarding', async () => {
    const standard = page.locator('#desktop-onboarding-packs [data-pack-id="standard"]');
    assert(await standard.isChecked(), 'Standard frame pack was not selected by default.');
    assert(await standard.isDisabled(), 'Standard frame pack was not required and locked on.');
    await page.click('#desktop-onboarding-start');
    await page.waitForSelector('.creator-workspace.is-ready', {timeout: 45_000});
  }, {settle: 500, screenshot: true});

  await checkpoint('set-details', async () => {
    await page.getByRole('tab', {name: 'Set Details', exact: true}).click();
    await page.locator('[data-set-field="name"]').fill('Regression Set');
    await page.locator('[data-set-field="description"]').fill('Full Electron interaction coverage');
    await page.locator('[data-set-field="releaseDate"]').fill('2026-08-03');
    await page.locator('[data-set-field="creator"]').fill('Regression Runner');
    await page.locator('[data-set-text="notes"]').fill('Notes save without inline handlers.');
    await page.locator('[data-set-text="story"]').fill('## Regression Story\n\n- Markdown preview');
    await page.locator('[data-set-text="story"]').press('Tab');
    assert(await page.locator('#sets-story-preview h2').textContent() === 'Regression Story', 'Markdown story preview did not update.');
    await page.getByRole('button', {name: 'Markdown Help'}).click();
    assert(await page.locator('#markdown-help-drawer').evaluate((element) => element.classList.contains('opened')), 'Markdown help drawer did not open.');
    await page.locator('#markdown-help-drawer .textbox-editor-close').click();
    await page.getByRole('tab', {name: 'Cards', exact: true}).click();
    await page.getByRole('tab', {name: 'Set Details', exact: true}).click();
    assert(await page.locator('[data-set-field="name"]').inputValue() === 'Regression Set', 'Set name did not persist across tab rendering.');
    assert(await page.locator('[data-set-field="creator"]').inputValue() === 'Regression Runner', 'Set creator did not persist across tab rendering.');
  }, {screenshot: true});

  await checkpoint('collector-settings', async () => {
    await page.getByRole('tab', {name: 'Collector', exact: true}).click();
    await page.locator('[data-set-field="code"]').fill('RGT');
    await page.locator('[data-set-field="language"]').fill('FR');
    await page.locator('[data-set-text="copyright"]').fill('© 2026 Regression Test.');
    await setCheckbox('[data-copyright-note-style]', true);
    await selectOption('[data-collector-style]', 'pre-one');
    const firstGroupDown = page.locator('[data-set-action="move-collector-group"][data-group-delta="1"]').first();
    if (await firstGroupDown.count()) await firstGroupDown.click();
    await page.locator('[data-set-text="copyright"]').press('Tab');
    assert((await page.locator('#sets-switcher option:checked').textContent()).includes('RGT'), 'Set switcher did not reflect the edited code.');
    assert(await page.locator('#info-set').inputValue() === 'RGT', 'Active card did not rehydrate after a set code change.');
    assert(await page.locator('#info-language').inputValue() === 'FR', 'Active card did not rehydrate after a language change.');
  }, {screenshot: true});

  await checkpoint('set-symbols', async () => {
    await page.getByRole('tab', {name: 'Set Symbol', exact: true}).click();
    await page.locator('[data-symbol-code]').fill('ltr');
    await page.locator('[data-symbol-load-all]').click();
    await page.waitForFunction(() => Array.from(document.querySelectorAll('[data-symbol-source]')).every((input) => input.value.includes('/ltr-')), {timeout: 10_000});
    await page.locator('[data-symbol-source="rare"]').fill('/img/setSymbols/official/ltr-r.svg');
    await page.locator('[data-symbol-source="rare"]').press('Tab');
    await page.locator('[data-symbol-clear]').click();
    assert(await page.locator('[data-symbol-source="rare"]').inputValue() === '', 'Clear Symbols did not clear the rarity sources.');
    await page.locator('[data-symbol-code]').fill('ltr');
    await page.locator('[data-symbol-load-all]').click();
  });

  await checkpoint('card-list-search', async () => {
    await page.getByRole('tab', {name: 'Cards', exact: true}).click();
    await page.locator('[data-card-search]').fill('no-such-regression-card');
    assert((await page.locator('#sets-tab-panel').innerText()).includes('No matching cards'), 'Card search did not filter the list.');
    await page.locator('[data-set-action="clear-card-search"]').click();
    assert(await page.locator('[data-card-search]').inputValue() === '', 'Card search clear action did not reset the query.');
  });

  await checkpoint('frame-editor', async () => {
    await selectEditorTab('Frame');
    await page.locator('#frameSearch').fill('regular');
    await page.locator('#frameCategoryFilters .frame-category-filter', {hasText: 'Standard'}).click();
    await page.locator('#frameCatalog .frame-catalog-item:not([hidden])').first().click();
    await page.locator('#creator-menu-frame .frame-advanced-toggle').click();
    await setCheckbox('#show-guidelines', true);
    await setCheckbox('#show-guidelines', false);
    await page.locator('#creator-menu-frame .sets-search-clear').click();
    assert(await page.locator('#frameSearch').inputValue() === '', 'Frame search clear action did not reset the query.');
    const customizeSelect = page.locator('#frameCustomizeControls select').first();
    if (await customizeSelect.count()) {
      const values = await customizeSelect.locator('option').evaluateAll((options) => options.map((option) => option.value));
      if (values.length > 1) await selectOption(customizeSelect, values[1]);
    }
  });

  await checkpoint('text-editor', async () => {
    await selectEditorTab('Text');
    await page.getByLabel('Title', {exact: true}).fill('Regression Adept');
    await page.getByLabel('Mana Cost', {exact: true}).fill('{2}{U}');
    await page.getByLabel('Type', {exact: true}).fill('Creature — Human Wizard');
    await page.getByLabel('Rules Text', {exact: true}).fill('When Regression Adept enters, draw a card.');
    await page.getByLabel('Power/Toughness', {exact: true}).fill('2/3');
    await setCheckbox('[aria-label="Auto-size Title"]', false);
    await page.locator('.text-field-card[data-text-key="title"] .text-field-layout-button').click();
    await page.waitForSelector('#textbox-editor.opened');
    await page.locator('#textbox-editor-x').fill('90');
    await page.locator('#textbox-editor .textbox-editor-close').click();
    await page.getByRole('button', {name: 'Formatting Help'}).click();
    await page.waitForSelector('#formatting-help-drawer.opened');
    await page.locator('#formatting-help-drawer .textbox-editor-close').click();
  }, {settle: 500, screenshot: true});

  await checkpoint('art-editor', async () => {
    await selectEditorTab('Art');
    await page.locator('#art-artist').fill('Regression Artist');
    await setCheckbox('#art-update-autofit', true);
    await page.locator('#creator-menu-art [aria-controls="art-layout-drawer"]').click();
    await page.waitForSelector('#art-layout-drawer.opened');
    await page.locator('#art-x').fill('120');
    await page.locator('#art-y').fill('80');
    await page.locator('#art-zoom').fill('110');
    await page.locator('#art-rotate').fill('5');
    await setCheckbox('#art-preserve-position', true);
    await page.locator('#art-layout-drawer .textbox-editor-close').click();
    await page.locator('#creator-menu-art .frame-advanced-toggle').click();
    await setCheckbox('#grayscale-art', true);
    await setCheckbox('#show-guidelines-2', true);
    await page.getByRole('button', {name: 'Remove Art'}).click();
  });

  await checkpoint('watermark-editor', async () => {
    await selectEditorTab('Watermark');
    await page.locator('#watermark-search').fill('planeswalker');
    await page.getByRole('button', {name: 'Use Planeswalker watermark', exact: true}).click();
    await page.locator('#watermark-opacity').fill('55');
    await page.locator('#creator-menu-watermark [aria-controls="watermark-layout-drawer"]').click();
    await page.waitForSelector('#watermark-layout-drawer.opened');
    await page.locator('#watermark-x').fill('420');
    await page.locator('#watermark-y').fill('760');
    await page.locator('#watermark-zoom').fill('95');
    await page.locator('#watermark-layout-drawer .textbox-editor-close').click();
    await page.locator('#creator-menu-watermark .frame-advanced-toggle').click();
    await setCheckbox('#watermark-auto-colors', false);
    await selectOption('#watermark-left', '#8cacc5');
    await selectOption('#watermark-right', '#598c52');
    await page.getByRole('button', {name: 'Remove Watermark'}).click();
  }, {settle: 500, screenshot: true});

  await checkpoint('card-details', async () => {
    await selectEditorTab('Card Details');
    await selectOption('[data-card-detail="rarity"]', 'rare');
    await page.locator('#info-note').fill('Regression note');
    await page.locator('#serial-number').fill('7');
    await page.locator('#serial-total').fill('100');
    await setCheckbox('#collector-use-star', true);
    await page.locator('#creator-menu-cardDetails [aria-controls="serial-layout-drawer"]').click();
    await page.waitForSelector('#serial-layout-drawer.opened');
    await page.locator('#serial-x').fill('180');
    await page.locator('#serial-scale').fill('1.1');
    await page.locator('#serial-layout-drawer .textbox-editor-close').click();
  }, {settle: 500, screenshot: true});

  await checkpoint('card-actions-and-history', async () => {
    await page.getByRole('button', {name: 'New Card', exact: true}).click();
    await waitForCardCount(2);
    await page.getByRole('button', {name: 'Duplicate', exact: true}).click();
    await waitForCardCount(3);
    await page.getByRole('button', {name: 'Add Variant', exact: true}).click();
    await waitForCardCount(4);
    await page.waitForTimeout(1_000);
    await page.getByRole('tab', {name: 'Set Details', exact: true}).click();
    await page.locator('[data-set-field="description"]').fill('History checkpoint');
    await page.locator('[data-set-field="description"]').press('Tab');
    await page.waitForTimeout(500);
    let historySteps = 0;
    while (await page.locator('[data-set-field="description"]').inputValue() === 'History checkpoint' && historySteps < 12) {
      await page.locator('#sets-undo-app').click();
      historySteps++;
      await page.waitForTimeout(350);
    }
    assert(await page.locator('[data-set-field="description"]').inputValue() === 'Full Electron interaction coverage', 'Undo did not restore the prior set description.');
    for (let index = 0; index < historySteps; index++) {
      await page.locator('#sets-redo-app').click();
      await page.waitForTimeout(350);
    }
    assert(await page.locator('[data-set-field="description"]').inputValue() === 'History checkpoint', 'Redo did not restore the edited set description.');
  });

  await checkpoint('set-actions', async () => {
    await page.locator('.sets-options-dropdown summary').click();
    await page.locator('[data-set-action="duplicate-set"]').click();
    await page.waitForFunction(() => document.querySelector('#sets-switcher option:checked')?.textContent.includes('Copy'));
    await page.locator('.creator-new-set-dropdown summary').click();
    await page.getByRole('button', {name: 'Create New', exact: true}).click();
    await page.waitForFunction(() => document.querySelectorAll('#sets-switcher option').length === 3);
    const setOptions = await page.locator('#sets-switcher option').evaluateAll((options) => options.map((option) => ({value: option.value, text: option.textContent})));
    assert(setOptions.length === 3, 'Expected original, duplicate, and newly created sets.');
    await selectOption('#sets-switcher', setOptions[0].value);
    await selectOption('#sets-switcher', setOptions[2].value);
    assert(await page.locator('#sets-switcher').inputValue() === setOptions[2].value, 'Newly created set could not be selected.');
  });

  await checkpoint('import-drawer', async () => {
    const importMenu = page.locator('.creator-card-action-dropdown').filter({hasText: 'Import Card'});
    await importMenu.locator('summary').click();
    await importMenu.getByRole('button', {name: 'Card search', exact: true}).click();
    await page.waitForSelector('#card-search-drawer.opened');
    await page.locator('#card-search-drawer .textbox-editor-close').click();
  });

  await checkpoint('desktop-settings', async () => {
    await page.click('#desktop-settings');
    await page.waitForSelector('#desktop-drawer.opened');
    await page.waitForSelector('#desktop-channel', {state: 'attached'});
    assert((await page.locator('#desktop-drawer').innerText()).includes('Frame Packs'), 'Settings did not include Frame Packs.');
    await page.locator('#desktop-drawer .textbox-editor-close').click();
  }, {screenshot: true});

  await checkpoint('print-preview', async () => {
    const exportMenu = page.locator('.creator-card-action-dropdown').filter({hasText: 'Export Card'});
    await exportMenu.locator('summary').click();
    await exportMenu.getByRole('button', {name: 'Print', exact: true}).click();
    await page.waitForSelector('#desktop-print:not([hidden])');
    assert(await page.locator('.desktop-print-page').count() >= 2, 'Print preview did not create front and default back pages.');
  }, {settle: 500, screenshot: true});

  if (errors.length) throw new Error(`Renderer errors:\n${errors.join('\n')}`);
  console.log(`Electron regression passed ${checkpoints.length} checkpoints. Evidence: ${evidence}`);
  console.log(checkpoints.map((checkpoint) => `- ${checkpoint}`).join('\n'));
} catch (error) {
  if (page) await page.screenshot({path: path.join(evidence, '99-regression-failure.png'), fullPage: true}).catch(() => {});
  throw error;
} finally {
  if (application) await application.close();
  await rm(userData, {recursive: true, force: true});
}
