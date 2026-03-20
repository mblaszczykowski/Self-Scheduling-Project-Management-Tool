import React from 'react';
import {
    calculateTaskPosition,
    generateBezierPath
} from '../../util/helpers';
import { TIMELINE_CONSTANTS, getTaskRowHeight } from '../../config/timelineConstants';

const { CROSS_PROJECT_DEPENDENCY_OFFSET } = TIMELINE_CONSTANTS;

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
    const startY = relativeDepIndex * verticalSpacing + verticalSpacing / 2;
    const endY = verticalSpacing / 2;
    const depPosition = calculateTaskPosition(
        depTask.startDate,
        depTask.dueDate,
        timelineStart
    );
    const startX = depPosition.marginLeft + depPosition.width;
    const endX = taskPosition.marginLeft;
    const minY = Math.min(startY, endY);
    const svgHeight = Math.abs(endY - startY) + 20;

    return (
        <svg
            key={`dep-${depTask.id}-${task.id}`}
            className="absolute"
            style={{
                top: `${minY}px`,
                left: 0,
                width: '100%',
                height: `${svgHeight}px`,
                pointerEvents: 'none',
                zIndex: 2
            }}
        >
            <path
                d={generateBezierPath(
                    startX,
                    startY - minY,
                    endX,
                    endY - minY
                )}
                stroke="#94a3b8"
                strokeWidth="1.5"
                fill="none"
                strokeDasharray="4 2"
                markerEnd="url(#arrowhead)"
            />
        </svg>
    );
};

export default React.memo(DependencyArrow);
