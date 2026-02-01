/**
 * Timeline-related constants for the UnifiedView component.
 * Centralizes magic numbers for better maintainability.
 */

export const TIMELINE_CONSTANTS = {
    // Day column width in pixels
    DAY_WIDTH: 25,

    // Sidebar dimensions
    SIDEBAR_EXPANDED_WIDTH: 280,
    SIDEBAR_COLLAPSED_WIDTH: 48,

    // Task row heights
    TASK_ROW_HEIGHT_COLLAPSED: 36,
    TASK_ROW_HEIGHT_EXPANDED: 54,

    // Visual offset for dependency lines crossing project boundaries
    // Compensates for the visual gap between project sections
    CROSS_PROJECT_DEPENDENCY_OFFSET: 1.4,

    // Timeline padding (extra space at the end of timeline)
    TIMELINE_END_PADDING: 300,
};

/**
 * Gets task row height based on sidebar state.
 */
export const getTaskRowHeight = (isSidebarCollapsed) =>
    isSidebarCollapsed
        ? TIMELINE_CONSTANTS.TASK_ROW_HEIGHT_COLLAPSED
        : TIMELINE_CONSTANTS.TASK_ROW_HEIGHT_EXPANDED;

/**
 * Gets sidebar width based on collapsed state.
 */
export const getSidebarWidth = (isCollapsed) =>
    isCollapsed
        ? TIMELINE_CONSTANTS.SIDEBAR_COLLAPSED_WIDTH
        : TIMELINE_CONSTANTS.SIDEBAR_EXPANDED_WIDTH;

export default TIMELINE_CONSTANTS;
