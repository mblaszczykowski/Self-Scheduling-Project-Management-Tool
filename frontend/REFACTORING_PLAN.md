# Frontend Refactoring Plan

## Priority 1: Long Lines (Quick Wins)

### 1.1 Extract Filter Icons (FilterBar.jsx)
Lines 32-42 have 370-500 char SVG definitions inline.
- Create `filterIcons.js` with named icon constants
- Import and reference by name

### 1.2 Break Long ClassNames (Comments.js, TaskProjectModal.jsx)
Lines with 200+ char className strings.
- Use template literals with line breaks
- Group related classes on separate lines

### 1.3 Extract Date Calculations (UnifiedView.jsx:105-106)
```javascript
// Before (128 chars):
projectStartDate = new Date(Math.min(...tasks.map(t => new Date(t.startDate)))).toISOString().split('T')[0];

// After:
const getProjectDateRange = (tasks) => {
  const dates = tasks.map(t => new Date(t.startDate).getTime());
  return new Date(Math.min(...dates)).toISOString().split('T')[0];
};
```

---

## Priority 2: Duplicated Code

### 2.1 Create useClickOutside Hook
**Files affected:** UnifiedView.jsx, TaskProjectModal.jsx

```javascript
// hooks/useClickOutside.js
export const useClickOutside = (ref, onClickOutside) => {
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        onClickOutside();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onClickOutside]);
};
```

### 2.2 Export Config Constants from helpers.js
**Files affected:** FilterBar, TaskListView, TimelineView, TaskForm

```javascript
// util/helpers.js - add at module level
export const STATUS_CONFIG = getStatusConfig();
export const PRIORITY_CONFIG = getPriorityConfig();
```

Remove duplicate `const STATUS_CONFIG = getStatusConfig()` from 4 files.

---

## Priority 3: Comments to Descriptive Names

### 3.1 Rename Generic Functions
| Current | New Name |
|---------|----------|
| `getErrorMessage` | `extractApiErrorMessage` |
| `openModal` | `openEntityModal` |
| `handleButtonMouseEnter` | `showTooltipAtButton` |

### 3.2 Remove Obvious Comments
Delete comments that just restate the code:
- `// Process all tasks with computed properties` (line describes itself)
- `// Task lookup map` (variable name is clear)

---

## Priority 4: Code Quality

### 4.1 Consistent Formatting (All files)
- Max 100 chars per line
- One statement per line (no `setX(); setY(); setZ();`)

### 4.2 Extract DependencyBadges Component (TaskListView.jsx:34-53)
Move `renderDependencies()` to small presentational component.

---

## Files to Touch (in order)

1. `hooks/useClickOutside.js` - CREATE
2. `util/helpers.js` - ADD exports
3. `components/projects/FilterBar.jsx` - icons + imports
4. `components/projects/UnifiedView.jsx` - hook + formatting
5. `components/modals/TaskProjectModal.jsx` - hook + formatting
6. `components/comments/Comments.js` - formatting
7. `components/projects/TaskListView.jsx` - remove config duplication
8. `components/projects/TimelineView.jsx` - remove config duplication
9. `components/modals/TaskForm.jsx` - remove config duplication

---

## Out of Scope
- No logic changes
- No new abstractions beyond useClickOutside
- No CSS extraction (keep Tailwind inline)
- No file splitting beyond the hook
