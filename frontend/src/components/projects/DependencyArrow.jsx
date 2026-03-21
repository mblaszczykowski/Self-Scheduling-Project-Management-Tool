import React from 'react';
import {
    calculateTaskPosition,
} from '../../util/helpers';
import { TIMELINE_CONSTANTS, getTaskRowHeight } from '../../config/timelineConstants';

const { CROSS_PROJECT_DEPENDENCY_OFFSET } = TIMELINE_CONSTANTS;

const PADDING = 14;
const STUB = 12;
const RADIUS = 8;

const DependencyArrow = ({
    depTask,
    task,
    taskPosition,
    sidebarCollapsed,
    timelineStart,
    projectIndex,
    depProjectIndex,
    depTaskIndex,
    taskGlobalIndex,
    projectRowOffsets,
}) => {
    let relativeDepIndex = (
        projectRowOffsets[depProjectIndex] + depTaskIndex
    ) - taskGlobalIndex;
    if (depProjectIndex !== projectIndex) {
        relativeDepIndex -= CROSS_PROJECT_DEPENDENCY_OFFSET;
    }

    const verticalSpacing = getTaskRowHeight(sidebarCollapsed);
    const rawStartY = relativeDepIndex * verticalSpacing + verticalSpacing / 2;
    const rawEndY = verticalSpacing / 2;
    const depPosition = calculateTaskPosition(
        depTask.startDate,
        depTask.dueDate,
        timelineStart
    );
    const startX = depPosition.marginLeft + depPosition.width;
    const endX = taskPosition.marginLeft;

    // Compute SVG vertical bounds first, then work in local coords
    const allRawY = [rawStartY, rawEndY];

    // For overlapping deps, we may need a midY between rows
    const isForward = endX > startX + STUB * 4;
    const isSameRow = Math.abs(rawEndY - rawStartY) < 1;
    const midRawY = (rawStartY + rawEndY) / 2;

    if (!isForward && !isSameRow) {
        allRawY.push(midRawY);
    }

    const minRawY = Math.min(...allRawY);
    const maxRawY = Math.max(...allRawY);
    const svgTop = minRawY - PADDING;
    const svgHeight = maxRawY - minRawY + PADDING * 2;

    // Convert to local SVG coords (relative to svgTop)
    const sy = rawStartY - svgTop;
    const ey = rawEndY - svgTop;

    let points;

    if (isSameRow) {
        points = [[startX, sy], [endX, ey]];
    } else if (isForward) {
        // L-route: right from source → down → right to target
        const vertX = startX + STUB;
        points = [
            [startX, sy],
            [vertX, sy],
            [vertX, ey],
            [endX, ey],
        ];
    } else {
        // Z-route for overlapping: right → down to mid → left → down → right
        const x1 = startX + STUB;
        const x2 = endX - STUB;
        const my = midRawY - svgTop;

        if (Math.abs(x1 - x2) < STUB) {
            points = [
                [startX, sy],
                [x1, sy],
                [x1, ey],
                [endX, ey],
            ];
        } else {
            points = [
                [startX, sy],
                [x1, sy],
                [x1, my],
                [x2, my],
                [x2, ey],
                [endX, ey],
            ];
        }
    }

    const pathD = buildRoundedPath(points, RADIUS);
    const markerId = `dep-arrow-${depTask.id}-${task.id}`;

    return (
        <svg
            className="absolute"
            style={{
                top: `${svgTop}px`,
                left: 0,
                width: '100%',
                height: `${svgHeight}px`,
                pointerEvents: 'none',
                zIndex: 2,
                overflow: 'visible',
            }}
        >
            <defs>
                <marker
                    id={markerId}
                    markerWidth="8"
                    markerHeight="6"
                    refX="7"
                    refY="3"
                    orient="auto"
                >
                    <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                </marker>
            </defs>
            <path
                d={pathD}
                stroke="#94a3b8"
                strokeWidth="1.5"
                fill="none"
                strokeDasharray="4 2"
                markerEnd={`url(#${markerId})`}
            />
        </svg>
    );
};

function buildRoundedPath(points, maxR) {
    if (points.length < 2) return '';
    if (points.length === 2) {
        return `M ${points[0][0]} ${points[0][1]} L ${points[1][0]} ${points[1][1]}`;
    }

    let d = `M ${points[0][0]} ${points[0][1]}`;

    for (let i = 1; i < points.length - 1; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        const next = points[i + 1];

        const dx1 = curr[0] - prev[0];
        const dy1 = curr[1] - prev[1];
        const len1 = Math.hypot(dx1, dy1);

        const dx2 = next[0] - curr[0];
        const dy2 = next[1] - curr[1];
        const len2 = Math.hypot(dx2, dy2);

        if (len1 === 0 || len2 === 0) {
            d += ` L ${curr[0]} ${curr[1]}`;
            continue;
        }

        const r = Math.min(maxR, len1 / 2, len2 / 2);

        const bx = curr[0] - (dx1 / len1) * r;
        const by = curr[1] - (dy1 / len1) * r;
        const ax = curr[0] + (dx2 / len2) * r;
        const ay = curr[1] + (dy2 / len2) * r;

        d += ` L ${bx} ${by} Q ${curr[0]} ${curr[1]} ${ax} ${ay}`;
    }

    const last = points[points.length - 1];
    d += ` L ${last[0]} ${last[1]}`;
    return d;
}

export default React.memo(DependencyArrow);
