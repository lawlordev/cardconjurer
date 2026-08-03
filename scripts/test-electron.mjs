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
    env: {...process.env, SET_CONJURER_USER_DATA: userData, ELECTRON_ENABLE_LOGGING: '1'}
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
  await page.screenshot({path: path.join(evidence, '02-editor.png'), fullPage: true});
  await page.click('#desktop-packs');
  await page.waitForSelector('#desktop-drawer.opened');
  await page.waitForTimeout(350);
  await page.screenshot({path: path.join(evidence, '03-frame-packs.png'), fullPage: true});
  await page.click('#desktop-drawer .textbox-editor-close');
  await page.click('#desktop-settings');
  await page.waitForSelector('#desktop-channel');
  await page.waitForTimeout(350);
  await page.screenshot({path: path.join(evidence, '04-settings.png'), fullPage: true});
  await page.click('#desktop-drawer .textbox-editor-close');
  await page.locator('.creator-card-action-dropdown').first().click();
  await page.getByRole('button', {name: 'Print', exact: true}).click();
  await page.waitForSelector('#desktop-print:not([hidden])');
  const printPage = page.locator('.desktop-print-page');
  if (await printPage.count() < 2) throw new Error('Print preview did not create front and default back pages.');
  await page.screenshot({path: path.join(evidence, '05-print-preview.png'), fullPage: true});
  if (errors.length) throw new Error(`Renderer errors:\n${errors.join('\n')}`);
  console.log(`Electron smoke test passed. Evidence: ${evidence}`);
} finally {
  if (application) await application.close();
  await rm(userData, {recursive: true, force: true});
}
