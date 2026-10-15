import { test, expect, Page } from '@playwright/test';

async function login(page: Page) {
    await page.goto('/login');
    await page.getByLabel('Email', { exact: true }).fill('demo@flowlink.dev');
    await page.getByLabel('Password', { exact: true }).fill('Demo1234!');
    await page.locator('main').getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false');
}

test('sign in, portfolio, task detail, and logout work through the production proxy', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await login(page);
    await expect(page.getByText('E-commerce platform redesign', { exact: true })).toBeVisible();
    await page.goto('/projects?selectedIssue=ECOM-3');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('ECOM-3', { exact: true }).first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Log out', exact: true }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Log out', exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    expect(errors).toEqual([]);
});

test('optimization previews a feasible plan without writing task dates', async ({ page }) => {
    await login(page);
    await page.goto('/projects');
    const before = await page.request.get('/api/projects/ECOM');
    expect(before.ok()).toBeTruthy();
    const tasksBefore = await before.json();
    const simulation = page.waitForResponse(response => response.url().endsWith('/api/optimization/simulate'));
    await page.getByRole('button', { name: 'Optimize', exact: true }).click();
    const response = await simulation;
    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    expect(result.optimizedMetrics.feasible).toBe(true);
    expect(result.optimizedMetrics.resourceConflicts).toBe(0);
    expect(result.previewToken).toMatch(/^[a-f\d]{64}$/);
    await expect(page.getByText('Schedule Optimization Ready')).toBeVisible();
    const after = await page.request.get('/api/projects/ECOM');
    expect(await after.json()).toEqual(tasksBefore);
});

test('mobile navigation and project list remain usable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.goto('/projects');
    await expect(page.getByRole('table')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('create, discuss, edit and delete a task without submitting its parent form accidentally', async ({ page }) => {
    await login(page);
    const key = `RV${Date.now().toString(36).slice(-6).toUpperCase()}`;
    await page.keyboard.press('p');
    let dialog = page.getByRole('dialog', { name: 'Create project', exact: true });
    await dialog.getByLabel('Project name', { exact: true }).fill('Browser regression project');
    await dialog.locator('input[name="projectKey"]').fill(key);
    await dialog.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    try {
        await page.keyboard.press('n');
        dialog = page.getByRole('dialog', { name: 'Create task', exact: true });
        await dialog.locator('select[name="projectKey"]').selectOption(key);
        await dialog.getByLabel('Task name', { exact: true }).fill('Browser regression task');
        await dialog.getByRole('button', { name: 'Create', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await page.goto(`/projects?selectedIssue=${key}-1`);
        dialog = page.getByRole('dialog', { name: 'Edit task', exact: true });
        await dialog.getByLabel('Task name', { exact: true }).fill('Unsaved task title');
        let taskUpdates = 0;
        page.on('request', request => {
            if (request.method() === 'PUT' && request.url().includes(`/tasks/${key}-1`)) taskUpdates++;
        });
        await dialog.getByRole('button', { name: 'Add comment', exact: true }).click();
        await dialog.getByLabel('Comment', { exact: true }).fill('Browser regression comment');
        await dialog.getByRole('button', { name: 'Post', exact: true }).click();
        await expect(dialog.getByText('Browser regression comment', { exact: true })).toBeVisible();
        await expect(dialog.getByLabel('Task name', { exact: true })).toHaveValue('Unsaved task title');
        expect(taskUpdates).toBe(0);
        await dialog.getByRole('button', { name: 'Save', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await page.goto(`/projects?selectedIssue=${key}-1`);
        dialog = page.getByRole('dialog', { name: 'Edit task', exact: true });
        await expect(dialog.getByLabel('Task name', { exact: true })).toHaveValue('Unsaved task title');
        await dialog.getByRole('button', { name: 'Delete task', exact: true }).click();
        await page.getByRole('alertdialog').getByRole('button', { name: 'Delete', exact: true }).click();
        await expect(dialog).toHaveCount(0);
        const project = await page.request.get(`/api/projects/${key}`);
        expect((await project.json()).tasks).toEqual([]);
    } finally {
        // This test owns only the newly created project; clean it up even when an assertion fails.
        const csrf = (await page.context().cookies()).find(cookie => cookie.name === 'XSRF-TOKEN');
        const removed = await page.request.delete(`/api/projects/${key}`, { headers: { 'X-CSRF-Token': csrf?.value ?? '' } });
        expect(removed.ok(), `Project cleanup failed: ${removed.status()} ${await removed.text()}`).toBeTruthy();
    }
});

test('apply persists the reviewed schedule for an isolated project', async ({ page }) => {
    await login(page);
    const key = `OP${Date.now().toString(36).slice(-6).toUpperCase()}`;
    const csrf = (await page.context().cookies()).find(cookie => cookie.name === 'XSRF-TOKEN');
    const headers = { 'X-CSRF-Token': csrf?.value ?? '' };
    const project = await page.request.post('/api/projects', { headers, multipart: {
        projectDTO: JSON.stringify({ projectKey: key, summary: 'Schedule browser regression', memberEmails: ['demo@flowlink.dev'] }),
    } });
    expect(project.ok()).toBeTruthy();
    try {
        const day = new Date().toISOString().slice(0, 10);
        for (let index = 1; index <= 2; index++) {
            const task = await page.request.post(`/api/projects/${key}/tasks`, { headers, multipart: {
                taskDTO: JSON.stringify({ summary: `Schedule regression ${index}`, status: 'TODO', priority: 'MEDIUM', progress: 0,
                    startDate: day, dueDate: day, assignee: 'demo@flowlink.dev' }),
            } });
            expect(task.ok()).toBeTruthy();
        }
        await page.goto(`/projects?projectKey=${key}`);
        const simulation = page.waitForResponse(response => response.url().endsWith('/api/optimization/simulate'));
        await page.getByRole('button', { name: 'Optimize', exact: true }).click();
        const result = await (await simulation).json();
        expect(result.suggestions).toHaveLength(2);
        expect(result.optimizedMetrics.resourceConflicts).toBe(0);
        const applying = page.waitForResponse(response => response.url().endsWith('/api/optimization/apply'));
        await page.getByRole('button', { name: 'Apply Schedule', exact: true }).click();
        expect((await applying).ok()).toBeTruthy();
        await expect(page.getByText('Schedule Optimization Ready')).toHaveCount(0);
        const persisted = await (await page.request.get(`/api/projects/${key}`)).json();
        for (const suggestion of result.suggestions) {
            const task = persisted.tasks.find((candidate: { taskKey: string }) => candidate.taskKey === suggestion.taskKey);
            expect(task.startDate).toBe(suggestion.suggestedStartDate);
            expect(task.dueDate).toBe(suggestion.suggestedDueDate);
        }
    } finally {
        const removed = await page.request.delete(`/api/projects/${key}`, { headers });
        expect(removed.ok(), `Project cleanup failed: ${removed.status()} ${await removed.text()}`).toBeTruthy();
    }
});
