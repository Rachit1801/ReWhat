import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';
const fixture = (name: string) => path.resolve('.local', name);
async function importFile(page: Page, filename: string) {
  await page.locator('input[type="file"]').setInputFiles(fixture(filename));
}
test('first import and media work fully offline; refreshing clears the session', async ({ page, context }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open a chat', exact: true })).toBeVisible();
  const requests: string[] = [];
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  await context.setOffline(true);
  await importFile(page, 'media.zip');
  await page.getByRole('button', { name: 'You', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Alex', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Search conversation', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search messages' }).fill('tiny photo');
  await page.getByRole('button', { name: 'Enlarge pixel.png', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('img')).toBeVisible();
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
  expect(await context.cookies()).toEqual([]);
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Open a chat', exact: true })).toBeVisible();
});
test('ambiguous dates and multiple transcripts have explicit choices', async ({ page }) => {
  await page.goto('/'); await importFile(page, 'ambiguous.zip');
  await page.getByRole('button', { name: /Day \/ Month \/ Year/ }).click();
  await page.getByRole('button', { name: 'You', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('3 April 2026');
  await importFile(page, 'multiple.zip');
  await expect(page.getByRole('heading', { name: 'Choose a conversation' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'another.txt' })).toBeVisible();
});
test('media failure is readable, HTML is inert, and local audio can play', async ({ page }) => {
  await page.goto('/'); await importFile(page, 'media.zip');
  await page.getByRole('button', { name: 'You', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('<script>alert("unsafe")</script>');
  await expect(page.locator('.conversation-inner script')).toHaveCount(0);
  await expect(page.getByRole('log')).toContainText('Attachment unavailable');
  await expect(page.getByRole('log')).toContainText('Preview unavailable');
  const audio = page.locator('audio');
  await expect(audio).toHaveCount(1);
  await audio.evaluate(async el => { await (el as HTMLAudioElement).play(); });
  expect(await audio.evaluate(el => (el as HTMLAudioElement).paused)).toBe(false);
});
test('100,000-message chat stays virtualized and search finds the last record', async ({ page }) => {
  await page.goto('/'); await importFile(page, 'large.zip');
  await page.getByRole('button', { name: 'You', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('Message 99999');
  expect(await page.locator('.message-row').count()).toBeLessThan(100);
  await page.getByRole('button', { name: 'Search conversation', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search messages' }).fill('Message 50000');
  await expect(page.locator('.active-match')).toContainText('Message 50000');
});
test('mobile and desktop layouts fit the viewport', async ({ page }) => {
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 844 }); await page.goto('/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await page.getByRole('button', { name: 'Just looking? Try a demo' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    await expect(page.getByRole('log')).toBeVisible();
  }
});
