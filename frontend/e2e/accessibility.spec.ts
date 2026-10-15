import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';
import { expect, Page, test } from '@playwright/test';
import type { AxeResults } from 'axe-core';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'];

test('core desktop, dialog and mobile screens have no automatic accessibility violations', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
    const screens: Array<{ screen: string; violations: AxeResults['violations']; incomplete: AxeResults['incomplete'] }> = [];
    async function scan(screen: string) {
        await page.evaluate(() => document.fonts.ready);
        await expect(page.locator('html')).not.toHaveClass(/theme-transitioning/);
        const result = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
        screens.push({ screen, violations: result.violations, incomplete: result.incomplete });
    }
    async function verifyDialogFocus() {
        const dialog = page.getByRole('dialog');
        const controls = await dialog.locator('button, input, select, textarea, [tabindex]').count();
        for (let index = 0; index < controls + 2; index++) {
            await page.keyboard.press('Tab');
            expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
        }
        await page.keyboard.press('Shift+Tab');
        expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
    }
    async function ready() {
        await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
    }
    async function openProjects(page: Page) {
        await page.goto('/projects');
        await ready();
    }

    await page.goto('/login');
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
    await scan('login');
    await page.getByLabel('Email', { exact: true }).fill(process.env.FLOWLINK_DEMO_EMAIL ?? 'demo@flowlink.dev');
    await page.getByLabel('Password', { exact: true }).fill(process.env.FLOWLINK_DEMO_PASSWORD ?? 'Demo1234!');
    await page.locator('main').getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await ready();
    await scan('dashboard-light');
    await page.getByRole('button', { name: 'Create new item', exact: true }).click();
    await expect(page.getByRole('menu', { name: 'Create options', exact: true })).toBeVisible();
    await scan('create-menu');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Notifications/ }).click();
    await expect(page.getByRole('group', { name: 'Notifications', exact: true })).toBeVisible();
    await scan('notification-menu');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await scan('dashboard-dark');
    await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
    await openProjects(page);
    await page.getByRole('button', { name: 'Timeline', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Optimize', exact: true })).toBeVisible();
    await scan('projects-timeline');
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await expect(page.getByRole('table')).toBeVisible();
    await scan('projects-list');
    await page.goto('/projects?selectedIssue=ECOM-3');
    await expect(page.getByRole('dialog', { name: 'Edit task', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add comment', exact: true })).toBeVisible();
    await scan('task-dialog');
    await verifyDialogFocus();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Account settings', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await scan('account-dialog');
    await verifyDialogFocus();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 844 });
    await openProjects(page);
    await expect(page.getByRole('table')).toBeVisible();
    await scan('mobile-list');
    await page.getByRole('button', { name: 'Open menu', exact: true }).click();
    await expect(page.getByRole('navigation', { name: 'Mobile navigation', exact: true })).toBeVisible();
    await scan('mobile-menu');

    const reportPath = testInfo.outputPath('accessibility-results.json');
    await writeFile(reportPath, JSON.stringify(screens, null, 2));
    await testInfo.attach('accessibility-results', { path: reportPath, contentType: 'application/json' });
    const failures = screens.flatMap(screen => screen.violations.map(violation => ({
        screen: screen.screen, id: violation.id, impact: violation.impact, help: violation.help,
        nodes: violation.nodes.map(node => ({ target: node.target, summary: node.failureSummary })),
    })));
    console.log(JSON.stringify(failures, null, 2));
    expect(failures, 'See accessibility-results attachment for exact targets and incomplete checks').toEqual([]);
});
