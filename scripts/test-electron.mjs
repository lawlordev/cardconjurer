import {mkdtemp, mkdir, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import { _electron as electron } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const userData = await mkdtemp(path.join(os.tmpdir(), 'set-conjurer-e2e-'));
const evidence = process.env.SET_CONJURER_EVIDENCE_DIR || path.join(os.tmpdir(), 'set-conjurer-evidence');
await mkdir(evidence, {recursive: true});
const errors = [];
let application;

try {
  application = await electron.launch({
    args: [root],
    cwd: root,
    env: {...process.env, SET_CONJURER_USER_DATA: userData, SET_CONJURER_ALLOW_TEST_INSTANCE: '1', ELECTRON_ENABLE_LOGGING: '1'}
  });
  const page = await application.firstWindow();
  page.on('console', (message) => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(`console: ${message.text()}`); });
  page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 400 && ['document','script','stylesheet'].includes(response.request().resourceType())) errors.push(`response ${response.status()}: ${response.url()}`);
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
  await page.click('#desktop-onboarding-start');
  await page.waitForSelector('.creator-workspace.is-ready', {timeout: 45_000});
  const cardActions = page.locator('.creator-card-action-buttons');
  if (await cardActions.getByRole('button', {name: 'Copy Card', exact: true}).count()) throw new Error('Copy Card action is still present.');
  const importCardDropdown = cardActions.locator('.creator-card-action-dropdown').filter({hasText: 'Import Card'});
  if (await importCardDropdown.count() !== 1) throw new Error('Import Card dropdown is missing.');
  await importCardDropdown.locator(':scope > summary').click();
  for (const label of ['.cardconjurer-card file', 'Card search']) {
    if (!(await importCardDropdown.getByRole('button', {name: label, exact: true}).isVisible())) throw new Error(`Import Card option is missing: ${label}`);
  }
  await importCardDropdown.locator(':scope > summary').click();
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
  await page.screenshot({path: path.join(evidence, '02-editor.png'), fullPage: true});
  await page.click('#desktop-settings');
  await page.waitForSelector('#desktop-drawer.opened');
  await page.waitForSelector('#desktop-channel', {state: 'attached'});
  await page.waitForTimeout(350);
  await page.screenshot({path: path.join(evidence, '03-settings-and-frame-packs.png'), fullPage: true});
  await page.click('#desktop-drawer .textbox-editor-close');
  await page.locator('.creator-card-action-dropdown').first().click();
  await page.getByRole('button', {name: 'Print', exact: true}).click();
  await page.waitForSelector('#desktop-print:not([hidden])');
  for (const selectId of ['#desktop-print-paper', '#desktop-print-backs']) {
    const trigger = page.locator(`${selectId} + .workspace-select > .workspace-select-trigger`);
    const chevron = trigger.locator('.card-specific-chevron');
    const [triggerBox, chevronBox] = await Promise.all([trigger.boundingBox(), chevron.boundingBox()]);
    if (!triggerBox || !chevronBox || Math.abs((triggerBox.x + triggerBox.width) - (chevronBox.x + chevronBox.width) - 12) > 3) throw new Error(`${selectId} chevron is not pinned to the right edge.`);
    await trigger.click();
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
  await rm(userData, {recursive: true, force: true});
}
