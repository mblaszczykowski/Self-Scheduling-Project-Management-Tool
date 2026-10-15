const { chromium } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
    const baseURL = process.env.FLOWLINK_BASE_URL ?? 'http://localhost:8187';
    const output = path.resolve(__dirname, '../../docs/screenshots');
    await fs.mkdir(output, { recursive: true });
    const browser = await chromium.launch();
    const context = await browser.newContext({ baseURL, viewport: { width: 1600, height: 1100 }, reducedMotion: 'reduce', colorScheme: 'light' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    async function capture(name, fullPage = false) {
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(output, name + '.png'), fullPage });
    }
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).waitFor();
    await capture('login');
    await page.getByLabel('Email', { exact: true }).fill('demo@flowlink.dev');
    await page.getByLabel('Password', { exact: true }).fill('Demo1234!');
    await page.locator('main').getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.waitForURL('**/dashboard');
    await page.locator('main[aria-busy="false"]').waitFor();
    await page.getByText('E-commerce platform redesign', { exact: true }).waitFor();
    await capture('dashboard');
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await capture('dashboard-dark');
    await page.getByRole('button', { name: 'Switch to light mode' }).click();
    await page.goto('/projects?projectKey=ECOM');
    await page.getByRole('button', { name: 'Optimize', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Today', exact: true }).click();
    await capture('timeline');
    await page.goto('/projects');
    await page.getByRole('button', { name: 'Optimize', exact: true }).waitFor();
    const simulation = page.waitForResponse(response => response.url().endsWith('/api/optimization/simulate'));
    await page.getByRole('button', { name: 'Optimize', exact: true }).click();
    const response = await simulation;
    if (!response.ok()) throw new Error('Optimization preview failed: ' + await response.text());
    const result = await response.json();
    await page.getByText('Schedule Optimization Ready').waitFor();
    await page.getByRole('button', { name: 'Today', exact: true }).click();
    await capture('schedule-optimizer');
    await page.goto('/projects');
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await page.getByRole('table').waitFor();
    await capture('list');
    await page.goto('/projects?selectedIssue=ECOM-3');
    await page.getByRole('dialog').waitFor();
    await page.getByRole('button', { name: 'Add comment', exact: true }).waitFor();
    await capture('task-detail');
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Account settings', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await capture('account');
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/projects');
    await page.getByRole('table').waitFor();
    await capture('mobile-list');
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await capture('mobile-menu');
    if (errors.length) throw new Error(errors.join('\n'));
    await fs.writeFile(path.join(output, 'capture.json'), JSON.stringify({
        capturedAt: new Date().toISOString(),
        source: 'production Docker Compose images with demo-seed.sql',
        desktopViewport: { width: 1600, height: 1100 },
        mobileViewport: { width: 390, height: 844 },
        browser: await browser.version(),
        originalMetrics: result.originalMetrics,
        optimizedMetrics: result.optimizedMetrics,
        chosenRule: result.chosenRule,
        tasksShifted: result.tasksShifted,
        screenshots: ['login', 'dashboard', 'dashboard-dark', 'timeline', 'schedule-optimizer', 'list', 'task-detail', 'account', 'mobile-list', 'mobile-menu'],
    }, null, 2) + '\n');
    await browser.close();
    console.log('Captured 10 screenshots from the running app.');
})().catch(error => { console.error(error); process.exit(1); });
