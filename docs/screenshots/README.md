# FlowLink screenshots

Captured from the production Docker images using the dedicated demo database on 15 October 2026. Desktop images use 1600×1100 pixels; mobile images use 390×844. Dates and numerical optimizer results depend on the seed date. The [capture metadata](capture.json) records the browser, dimensions and actual before/after metrics.

| Screen | Image | What it shows |
|---|---|---|
| Sign in | [login.png](login.png) | Product description, illustrative schedule preview and sign-in form. |
| Dashboard | [dashboard.png](dashboard.png) | Three demo projects, portfolio indicators and analytics. |
| Dark dashboard | [dashboard-dark.png](dashboard-dark.png) | The same workspace in the dark theme. |
| Timeline | [timeline.png](timeline.png) | ECOM filter, dependencies, statuses, progress and overdue labels. |
| Optimization | [schedule-optimizer.png](schedule-optimizer.png) | A simulation with metrics and suggested dates before applying changes. |
| Task list | [list.png](list.png) | Status, assignee, schedule, progress, dependencies and labels. |
| Task details | [task-detail.png](task-detail.png) | ECOM-3, rich text description, dates and threaded discussion. |
| Profile | [account.png](account.png) | Account details, password fields and email preferences. |
| Mobile list | [mobile-list.png](mobile-list.png) | Task list and filters on a narrow screen; the table scrolls horizontally for remaining columns. |
| Mobile menu | [mobile-menu.png](mobile-menu.png) | Search, navigation, creation and account actions. |

Regenerate with `npm --prefix frontend run capture:screenshots` after starting and seeding the isolated review stack. Full instructions are in [VERIFICATION.md](../VERIFICATION.md).
