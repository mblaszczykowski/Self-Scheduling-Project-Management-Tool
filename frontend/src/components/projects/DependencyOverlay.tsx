import React, { useState, useEffect, useCallback } from 'react';
import { DependencyOverlayProps } from './types';

const STUB = 12;
const RADIUS = 8;
const CLEARANCE = 8;

/** Screen-space geometry of a rendered task bar within the timeline. */
interface BarInfo {
    right: number;
    left: number;
    cy: number;
}

type Point = number[];

interface ArrowBase {
    id: string;
    sx: number;
    sy: number;
    ex: number;
    ey: number;
}

interface Arrow extends ArrowBase {
    d: string;
}

function buildRoundedPath(points: Point[], maxR: number): string {
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

/**
 * Check if a vertical line at x from minY to maxY crosses any bar.
 */
function verticalCrossesBars(x: number, sy: number, ey: number, allBars: BarInfo[]): boolean {
    const minY = Math.min(sy, ey);
    const maxY = Math.max(sy, ey);
    return allBars.some(
        b => b.cy > minY + CLEARANCE && b.cy < maxY - CLEARANCE &&
            x >= b.left - CLEARANCE && x <= b.right + CLEARANCE
    );
}

/**
 * Find the best Y for a horizontal segment between sy and ey
 * that doesn't cross any bars in the x range [x1..x2].
 */
function findClearMidY(sy: number, ey: number, x1: number, x2: number, allBars: BarInfo[]): number {
    const minY = Math.min(sy, ey);
    const maxY = Math.max(sy, ey);
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);

    // Collect cy values of bars that overlap with horizontal x range
    const conflictCys = allBars
        .filter(b => b.cy > minY + CLEARANCE && b.cy < maxY - CLEARANCE &&
            b.right > minX - CLEARANCE && b.left < maxX + CLEARANCE)
        .map(b => b.cy)
        .sort((a, b) => a - b);

    if (conflictCys.length === 0) return (sy + ey) / 2;

    // Build candidate gaps: before first, between consecutive, after last
    const edges = [minY + CLEARANCE, ...conflictCys, maxY - CLEARANCE];
    let bestY = (sy + ey) / 2;
    let bestDist = Infinity;

    for (let i = 0; i < edges.length - 1; i++) {
        const gapCenter = (edges[i] + edges[i + 1]) / 2;
        const gapSize = edges[i + 1] - edges[i];
        if (gapSize < CLEARANCE * 2) continue; // too narrow
        const dist = Math.abs(gapCenter - (sy + ey) / 2);
        if (dist < bestDist) {
            bestDist = dist;
            bestY = gapCenter;
        }
    }

    return bestY;
}

function buildArrowPath(sx: number, sy: number, ex: number, ey: number, allBars: BarInfo[]): string {
    if (Math.abs(ey - sy) < 1) {
        return `M ${sx} ${sy} L ${ex} ${ey}`;
    }

    // Strategy: try vertical near target first (ex - STUB),
    // then near source (sx + STUB), then find a clear channel.
    // ALWAYS enter target from the left — never let horizontal
    // go backward through the target bar.

    const nearTarget = ex - STUB;
    const nearSource = sx + STUB;

    // --- CASE 1: Forward dep with vertical near target (cleanest) ---
    if (ex > sx + STUB * 4 && !verticalCrossesBars(nearTarget, sy, ey, allBars)) {
        return buildRoundedPath(
            [[sx, sy], [nearTarget, sy], [nearTarget, ey], [ex, ey]],
            RADIUS,
        );
    }

    // --- CASE 2: Forward dep with vertical near source ---
    if (ex > sx + STUB * 4 && !verticalCrossesBars(nearSource, sy, ey, allBars)) {
        return buildRoundedPath(
            [[sx, sy], [nearSource, sy], [nearSource, ey], [ex, ey]],
            RADIUS,
        );
    }

    // --- CASE 3: No single clear vertical channel. Use Z-route ---
    // Route: right from source → down to midY → left/right to near target → down → enter target
    // Vertical 1 near source, vertical 2 near target, horizontal at midY between rows.
    const x1 = nearSource;
    const x2 = nearTarget;
    const midY = findClearMidY(sy, ey, x1, x2, allBars);

    return buildRoundedPath(
        [[sx, sy], [x1, sy], [x1, midY], [x2, midY], [x2, ey], [ex, ey]],
        RADIUS,
    );
}

const DependencyOverlay = ({
    containerRef,
    allTasks,
    taskKeyMap,
    expandedProjects,
    projectKeyToProject,
    filteredTaskIds,
    filteredProjectKeys,
    hasActiveFilters,
    projectKeyFilter,
}: DependencyOverlayProps) => {
    const [arrows, setArrows] = useState<Arrow[]>([]);
    const [dims, setDims] = useState({ w: 0, h: 0 });

    const compute = useCallback(() => {
        const el = containerRef.current;
        if (!el) return;

        const barEls = el.querySelectorAll<HTMLElement>('[data-task-key]');
        const barMap = new Map<string, BarInfo>();
        const allBars: BarInfo[] = [];
        const cr = el.getBoundingClientRect();
        const sl = el.scrollLeft;
        const st = el.scrollTop;

        barEls.forEach(bar => {
            const r = bar.getBoundingClientRect();
            const info = {
                right: r.right - cr.left + sl,
                left: r.left - cr.left + sl,
                cy: (r.top + r.bottom) / 2 - cr.top + st,
            };
            barMap.set(bar.dataset.taskKey, info);
            allBars.push(info);
        });

        const result: ArrowBase[] = [];
        for (const task of allTasks) {
            if (!filteredTaskIds.has(task.id)) continue;
            const proj = projectKeyToProject.get(task.projectKey);
            if (!proj || !expandedProjects[proj.projectKey]) continue;
            if (projectKeyFilter && proj.projectKey !== projectKeyFilter) continue;
            if (!filteredProjectKeys.has(proj.projectKey) && hasActiveFilters) continue;

            const target = barMap.get(task.taskKey);
            if (!target) continue;

            for (const depKey of (task.dependencies || [])) {
                const dep = taskKeyMap.get(depKey);
                if (!dep || !filteredTaskIds.has(dep.id)) continue;
                const dp = projectKeyToProject.get(dep.projectKey);
                if (!dp || !expandedProjects[dp.projectKey]) continue;
                if (projectKeyFilter && dp.projectKey !== projectKeyFilter) continue;
                if (!filteredProjectKeys.has(dp.projectKey) && hasActiveFilters) continue;

                const source = barMap.get(depKey);
                if (!source) continue;

                result.push({
                    id: `${depKey}-${task.taskKey}`,
                    sx: source.right,
                    sy: source.cy,
                    ex: target.left,
                    ey: target.cy,
                });
            }
        }

        setArrows(result.map(a => ({
            ...a,
            d: buildArrowPath(a.sx, a.sy, a.ex, a.ey, allBars),
        })));
        setDims({ w: el.scrollWidth, h: el.scrollHeight });
    }, [containerRef, allTasks, taskKeyMap, expandedProjects,
        projectKeyToProject, filteredTaskIds, filteredProjectKeys,
        hasActiveFilters, projectKeyFilter]);

    useEffect(() => {
        const id = requestAnimationFrame(compute);
        return () => cancelAnimationFrame(id);
    }, [compute]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => requestAnimationFrame(compute));
        ro.observe(el);
        return () => ro.disconnect();
    }, [containerRef, compute]);

    if (arrows.length === 0) return null;

    return (
        <svg
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: dims.w,
                height: dims.h,
                pointerEvents: 'none',
                zIndex: 2,
            }}
        >
            <defs>
                <marker
                    id="dep-arrowhead"
                    markerWidth="8"
                    markerHeight="6"
                    refX="7"
                    refY="3"
                    orient="auto"
                >
                    <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                </marker>
                <marker
                    id="dep-dot"
                    markerWidth="6"
                    markerHeight="6"
                    refX="3"
                    refY="3"
                >
                    <circle cx="3" cy="3" r="2" fill="#94a3b8" />
                </marker>
            </defs>
            {arrows.map(({ id, d, sx, sy }) => (
                <React.Fragment key={id}>
                    <path
                        d={d}
                        stroke="#94a3b8"
                        strokeWidth="1.5"
                        fill="none"
                        strokeDasharray="4 2"
                        markerEnd="url(#dep-arrowhead)"
                        markerStart="url(#dep-dot)"
                    />
                </React.Fragment>
            ))}
        </svg>
    );
};

export default React.memo(DependencyOverlay);
