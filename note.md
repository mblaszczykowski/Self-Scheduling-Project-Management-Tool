start with all security,performance, architecture, data integrity, fix bugs for backend and frontend
leave the infrastructure stuff

then do this:
Quick Wins

1. Persist filter/view state to localStorage — currently resets on page reload
2. Add loading states to submit buttons (TaskForm, ProjectForm, AccountModal)
3. Password strength indicator on RegisterForm
4. Character counts on text inputs with max lengths
5. Fix mobile overflow — TaskForm sidebar is fixed w-[400px], breaks on mobile
6. Fix aria-controls mismatch — Header mobile menu button references non-existent ID  

Major UX Features Missing

- Global search — currently only searches task summary, not descriptions/comments/projects
- Keyboard shortcuts — no shortcuts for create, navigate, or update actions
- Drag & drop — no task reordering or status changes via drag
- Dark mode / theme switcher
- Kanban board view — only list and timeline views exist
- Calendar view for due dates
- Activity log / change history on tasks
- Real-time updates — currently polling every 30s, no WebSocket support
- Burndown charts / velocity tracking


migrate to typescript
gaps
- No linting config — relying on CRA defaults only, no Prettier/ESLint rules
- No pre-commit hooks — no husky/lint-staged     