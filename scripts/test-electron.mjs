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
  const sharedRadius = await page.locator('#desktop-settings').evaluate((element) => getComputedStyle(element).borderTopLeftRadius);
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
  if (!(await updateButton.evaluate((button) => button.hidden))) throw new Error('Update action is visible before an update is available.');
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
  await page.screenshot({path: path.join(evidence, '02-editor.png'), fullPage: true});
  await page.click('#desktop-settings');
  await page.waitForSelector('#desktop-drawer.opened');
  await page.waitForSelector('#desktop-channel', {state: 'attached'});
  await page.waitForTimeout(350);
  const packRowRadius = await page.locator('.desktop-pack-row').first().evaluate((element) => getComputedStyle(element).borderTopLeftRadius);
  if (packRowRadius !== sharedRadius) throw new Error(`settings drawer card does not use the shared ${sharedRadius} radius: ${packRowRadius}`);
  await page.screenshot({path: path.join(evidence, '03-settings-and-frame-packs.png'), fullPage: true});
  await page.click('#desktop-drawer .textbox-editor-close');
  await page.locator('.creator-card-action-dropdown').first().click();
  await page.getByRole('button', {name: 'Print', exact: true}).click();
  await page.waitForSelector('#desktop-print:not([hidden])');
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
  await rm(userData, {recursive: true, force: true});
}
