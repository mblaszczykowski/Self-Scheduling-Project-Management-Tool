// src/components/Timeline.jsx

import React, {useContext, useEffect, useMemo, useRef, useState} from 'react';
import TaskProjectModal from './TaskProjectModal';
import Header from './Header';
import {useLocation, useNavigate} from 'react-router-dom';
import {AddIcon, CollapseIcon, ExpandIcon} from './Icons';
import {DataContext} from '../context/DataContext';
import axios from "axios";

const Timeline = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const {
        projects,
        loading,
        error,
        updateTask,
    } = useContext(DataContext);

    const [projectKeyFilter, setProjectKeyFilter] = useState(null);

    const wasResizingRef = useRef(false);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [modalType, setModalType] = useState(null); // 'task' or 'project'
    const [modalMode, setModalMode] = useState(null); // 'create' or 'edit'
    const [currentProject, setCurrentProject] = useState(null);
    const [currentTask, setCurrentTask] = useState(null);
    const dataContext = useContext(DataContext);

    const today = new Date();
    const headerRef = useRef(null);
    const timelineRef = useRef(null);
    const [resizingTask, setResizingTask] = useState(null);
    const isResizingRef = useRef(false);

    // Process projects to ensure each task has a taskKey and calculate project boundaries
    // Inside the useMemo hook for processedProjects
    const processedProjects = useMemo(() => {
        return projects.map((project) => {
            // Add taskKey and ensure labels is an array
            const tasksWithKeys = project.tasks?.map((task) => ({
                ...task,
                taskKey: task.taskKey || `${project.projectKey}-${task.id}`,
                reporter: task.reporter?.email || 'N/A',
                labels: Array.isArray(task.labels) ? task.labels : [],
                progress: task.progress ?? 0, // Treat null progress as 0%
            })) || [];

            // Sort tasks by startDate
            tasksWithKeys.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

            // Calculate projectStartDate and projectDueDate based on tasks
            let projectStartDate = null;
            let projectDueDate = null;

            if (tasksWithKeys.length > 0) {
                const allStartDates = tasksWithKeys.map((task) => new Date(task.startDate));
                const allDueDates = tasksWithKeys.map((task) => new Date(task.dueDate));

                projectStartDate = new Date(Math.min(...allStartDates)).toISOString().split('T')[0];
                projectDueDate = new Date(Math.max(...allDueDates)).toISOString().split('T')[0];
            }

            // Calculate projectProgress
            const totalProgress = tasksWithKeys.reduce((acc, task) => acc + task.progress, 0);
            const projectProgress = tasksWithKeys.length > 0
                ? Math.round(totalProgress / tasksWithKeys.length)
                : 0;

            return {
                ...project,
                tasks: tasksWithKeys,
                projectStartDate,
                projectDueDate,
                projectProgress, // Add projectProgress here
            };
        });
    }, [projects]);

    const projectRowOffsets = useMemo(() => {
        let offset = 0
        return processedProjects.map((project) => {
            const current = offset
            offset += project.tasks.length
            return current
        })
    }, [processedProjects])

    // Manage expanded projects locally using a state object
    const [expandedProjects, setExpandedProjects] = useState(() => {
        const initialExpanded = {};
        processedProjects.forEach((project) => {
            initialExpanded[project.projectKey] = projectKeyFilter
                ? project.projectKey === projectKeyFilter
                : true;
        });
        return initialExpanded;
    });

    // Update expandedProjects when projects or projectKeyFilter changes
    useEffect(() => {
        setExpandedProjects((prev) => {
            const updated = { ...prev };
            processedProjects.forEach((project) => {
                if (projectKeyFilter) {
                    updated[project.projectKey] = project.projectKey === projectKeyFilter;
                } else {
                    // If no filter, maintain current expanded state or default to true
                    if (!(project.projectKey in updated)) {
                        updated[project.projectKey] = true;
                    }
                }
            });
            return updated;
        });
    }, [processedProjects, projectKeyFilter]);

    // Parse URL parameters to handle selectedIssue and projectKeyFilter
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const selectedIssue = params.get('selectedIssue');
        const projectKeyParam = params.get('projectKey');
        if (projectKeyParam) {
            setProjectKeyFilter(projectKeyParam);
        } else {
            setProjectKeyFilter(null);
        }

        if (selectedIssue && processedProjects.length > 0) {
            const [projectKey, taskId] = selectedIssue.split('-');
            const taskIdInt = parseInt(taskId, 10);
            const project = processedProjects.find((p) => p.projectKey === projectKey);
            const task = project?.tasks.find((t) => t.id === taskIdInt);
            if (project && task) {
                openModal('task', 'edit', project, task);
            }
        }
    }, [location.search, processedProjects]);

    // Handle task resizing using context's updateTask function
    useEffect(() => {
        if (!resizingTask) return;

        const handleMouseMove = (e) => {
            const { taskKey, projectKey, side, startX } = resizingTask;
            const deltaX = e.clientX - startX;
            const dayWidth = 25;
            const deltaDays = Math.round(deltaX / dayWidth);

            if (deltaDays === 0) return;

            // Update the startX for the next move
            setResizingTask((prev) => ({
                ...prev,
                startX: e.clientX,
            }));

            // Find the project and task
            const project = processedProjects.find((p) => p.projectKey === projectKey);
            if (!project) return;

            const task = project.tasks.find((t) => t.taskKey === taskKey);
            if (!task) return;

            // Calculate new dates based on resizing
            let newStartDate = new Date(task.startDate);
            let newDueDate = new Date(task.dueDate);

            if (side === 'left') {
                newStartDate.setDate(newStartDate.getDate() + deltaDays);
                if (newStartDate <= new Date(task.dueDate)) {
                    task.startDate = newStartDate.toISOString().split('T')[0];
                }
            } else if (side === 'right') {
                newDueDate.setDate(newDueDate.getDate() + deltaDays);
                if (newDueDate >= new Date(task.startDate)) {
                    task.dueDate = newDueDate.toISOString().split('T')[0];
                }
            }

            // Prepare taskDTO
            const taskDTO = {
                summary: task.summary,
                description: task.description,
                status: task.status,
                startDate: task.startDate,
                dueDate: task.dueDate,
                assignee: task.assignee,
                labels: task.labels,
                dependencies: task.dependencies,
            };

            // Update the task via context's updateTask
            updateTask(projectKey, task.id, taskDTO)
                .then(() => {
                    // Data is refreshed via context
                })
                .catch((error) => {
                    console.error('Error updating task:', error);
                });
        };

        const handleMouseUp = () => {
            if (resizingTask) {
                isResizingRef.current = false;
                wasResizingRef.current = true;

                // Reset wasResizingRef.current after a short delay
                setTimeout(() => {
                    wasResizingRef.current = false;
                }, 100); // Adjust the delay as needed

                setResizingTask(null);
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        // Cleanup
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizingTask, processedProjects, updateTask]);

    const handleLogout = () => {
        axios
            .delete('/api/auth/logout')
            .then(() => {
                dataContext.setUser(null);
                navigate('/login');
            })
            .catch((error) => {
                console.error('Logout failed', error);
            });
    };

    // Event handlers
    const handleMouseDown = (e, taskKey, projectKey, side) => {
        e.preventDefault();
        isResizingRef.current = true;
        wasResizingRef.current = false;
        setResizingTask({ taskKey, projectKey, side, startX: e.clientX });
    };

    const toggleExpand = (projectKey) => {
        setExpandedProjects((prev) => ({
            ...prev,
            [projectKey]: !prev[projectKey],
        }));
    };

    const openModal = (type, mode, project, task = null) => {
        setModalType(type);
        setModalMode(mode);
        setCurrentProject(project);
        setCurrentTask(task);
        setModalOpen(true);

        if (type === 'task' && task) {
            navigate(`/timeline?selectedIssue=${task.taskKey}`, { replace: true });
        }
    };

    const closeModal = () => {
        setModalOpen(false);
        setCurrentProject(null);
        setCurrentTask(null);
        navigate('/timeline', { replace: true });
    };

    // Render functions
    const renderDaysForMonth = (startDate, endDate) => {
        const days = [];
        const dayWidth = 25;
        let currentDay = new Date(startDate);

        while (currentDay <= endDate) {
            const isToday =
                today.toLocaleDateString() === currentDay.toLocaleDateString();
            days.push(
                <div
                    key={currentDay.toISOString()}
                    className={`text-xs p-1 border-l border-gray-300 ${
                        currentDay.getDay() === 0 || currentDay.getDay() === 6 ? 'bg-gray-200' : ''
                    } ${isToday ? 'bg-blue-200' : ''}`}
                    style={{ width: `${dayWidth}px`, minWidth: `${dayWidth}px` }}
                >
                    {currentDay.getDate()}
                </div>
            );
            currentDay.setDate(currentDay.getDate() + 1);
        }

        return days;
    };

    const renderMonths = (startDate, endDate) => {
        const months = [];
        const dayWidth = 25;
        let currentMonth = new Date(startDate);

        while (currentMonth <= endDate) {
            const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
            const nextMonth = new Date(
                currentMonth.getFullYear(),
                currentMonth.getMonth() + 1,
                1
            );
            const monthEnd = new Date(nextMonth.getTime() - 1);

            const daysInMonth = Math.round(
                (monthEnd - monthStart) / (1000 * 60 * 60 * 24)
            );
            const monthWidth = daysInMonth * dayWidth;

            months.push(
                <div
                    key={currentMonth.toISOString()}
                    className="flex flex-col text-center border-r border-gray-300"
                    style={{ width: `${monthWidth}px` }}
                >
                    <div className="text-xs font-medium border-b border-gray-300 p-1">
                        {currentMonth
                            .toLocaleDateString('default', { month: 'short' })
                            .toUpperCase()}{' '}
                        {currentMonth.getFullYear()}
                    </div>
                    <div className="flex">{renderDaysForMonth(monthStart, monthEnd)}</div>
                </div>
            );
            currentMonth = nextMonth;
        }
        return months;
    };

    const calculateTaskPosition = (startDate, dueDate, timelineStart) => {
        const start = new Date(startDate);
        const due = new Date(dueDate);
        const timelineStartDate = new Date(timelineStart);

        const daysOffset = Math.round((start - timelineStartDate) / (1000 * 60 * 60 * 24));
        const durationDays = Math.round((due - start) / (1000 * 60 * 60 * 24)) + 1;

        return {
            marginLeft: daysOffset * 25, // 25px per day
            width: durationDays * 25, // 25px per day
        };
    };

    const getTimelineBounds = () => {
        const allDates = processedProjects.flatMap((project) =>
            project.tasks?.flatMap((task) => [
                new Date(task.startDate).getTime(),
                new Date(task.dueDate).getTime(),
            ]) || []
        );

        if (allDates.length === 0) {
            // No tasks, so set default timeline from today to next few weeks
            const timelineStart = new Date();
            const timelineEnd = new Date();
            timelineEnd.setDate(timelineEnd.getDate() + 21); // Next 3 weeks
            return { timelineStart, timelineEnd };
        }

        const earliestDate = new Date(Math.min(...allDates));
        const latestDate = new Date(Math.max(...allDates));

        const timelineStart = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
        const timelineEnd = new Date(latestDate.getFullYear(), latestDate.getMonth() + 1, 0);

        return { timelineStart, timelineEnd };
    };

    const syncScroll = () => {
        if (headerRef.current && timelineRef.current) {
            headerRef.current.scrollLeft = timelineRef.current.scrollLeft;
        }
    };

    const { timelineStart, timelineEnd } = getTimelineBounds();

    const calculateTimelineWidth = () => {
        const dayWidth = 25; // Width of each day in pixels
        const timelineStartDate = new Date(timelineStart);
        const timelineEndDate = new Date(timelineEnd);

        const totalDays = Math.round(
            (timelineEndDate - timelineStartDate) / (1000 * 60 * 60 * 24)
        );
        const totalWidth = totalDays * dayWidth;

        return totalWidth + 300;
    };

    const generateBezierPath = (startX, startY, endX, endY) => {
        const controlPointOffsetX = Math.abs(endX - startX) / 2;

        return `M ${startX} ${startY} C ${startX + controlPointOffsetX} ${startY}, ${
            endX - controlPointOffsetX
        } ${endY}, ${endX} ${endY}`;
    };

    // Handle project filter change from UI
    const handleProjectFilterChange = (e) => {
        const selectedProjectKey = e.target.value;
        setProjectKeyFilter(selectedProjectKey);

        // Update the URL query parameter
        const params = new URLSearchParams(location.search);
        if (selectedProjectKey === 'All') {
            params.delete('projectKey');
        } else {
            params.set('projectKey', selectedProjectKey);
        }
        navigate(`/timeline?${params.toString()}`);
    };

    return (
        <div className="relative p-6 text-gray-900 flex flex-col min-h-screen">
            <div className="flex-grow rounded-3xl px-6 py-4 bg-white flex flex-col">
                <Header
                    onLogout={handleLogout}
                    onCreateProject={() => openModal('project', 'create')}
                    onCreateTask={() => openModal('task', 'create')}
                />
                {/* Existing Timeline code */}
                {processedProjects.length === 0 ? (
                    <div className="text-center mt-10 text-gray-600">
                        <p>Create a project to get started.</p>
                    </div>
                ) : (
                    <>
                        {/* Project Filter UI */}
                        <div className="mb-4 ml-4">
                            <label htmlFor="projectFilter" className="block text-sm font-medium text-gray-700 mb-1">
                                Filter by Project:
                            </label>
                            <select
                                id="projectFilter"
                                value={projectKeyFilter || 'All'}
                                onChange={handleProjectFilterChange}
                                className="w-1/4 p-2 border border-gray-300 rounded-lg"
                            >
                                <option value="All">All Projects</option>
                                {processedProjects.map((project) => (
                                    <option key={project.projectKey} value={project.projectKey}>
                                        {project.summary} ({project.projectKey})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div
                            className="flex mb-4 overflow-hidden rounded-xl shadow-lg"
                            ref={headerRef}
                            onScroll={syncScroll}
                        >
                            <div className="sticky left-0 z-10 min-w-[300px] flex items-center justify-center text-center font-semibold bg-[#F3F3F3] rounded-l-xl border-r">
                                Projects
                            </div>

                            <div className="flex-1 flex relative bg-[#F3F3F3]">
                                {renderMonths(timelineStart, timelineEnd)}
                            </div>
                        </div>

                        <div className="space-y-4 overflow-auto flex-grow" ref={timelineRef} onScroll={syncScroll}>
                            {processedProjects
                                .filter((project) => !projectKeyFilter || project.projectKey === projectKeyFilter)
                                .map((project, projectIndex) => (
                                    <div key={project.projectKey} className="relative">
                                        <div
                                            className="flex group hover:bg-gray-100 transition duration-300 rounded-t-lg"
                                            style={{
                                                width: `${calculateTimelineWidth()}px`,
                                            }}
                                        >
                                            <div
                                                className="sticky rounded-t-2xl left-0 z-10 min-w-[300px] flex items-center justify-between space-x-3 p-3 bg-[#F3F3F3] shadow-lg">
                                                <div className="flex items-center space-x-3">
                                                    <button
                                                        onClick={() => toggleExpand(project.projectKey)}
                                                        className="focus:outline-none text-gray-500 hover:text-gray-800 transition duration-300"
                                                    >
                                                        {expandedProjects[project.projectKey] ? <CollapseIcon/> :
                                                            <ExpandIcon/>}
                                                    </button>
                                                    <div
                                                        className="cursor-pointer"
                                                        onClick={() => openModal('project', 'edit', project)}
                                                    >
                                                        <div
                                                            className="font-semibold text-sm hover:text-blue-600 transition duration-300"
                                                        >
                                                            {project.projectKey}: {project.summary.length > 18 ? `${project.summary.substring(0, 21)}...` : project.summary}
                                                        </div>
                                                        <span
                                                            className="font-semibold text-xs bg-gray-200 text-gray-800 p-1 rounded-xl px-2 text-center">
                                                            Progress: {project.projectProgress}%
                                                        </span>
                                                        <span
                                                            className="font-semibold text-xs bg-gray-200 text-gray-800 p-1 rounded-xl px-2 text-center">
                                                            Edit project
                                                        </span>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => openModal('task', 'create', project)}
                                                    className="text-blue-600 hover:text-blue-800 transition duration-300"
                                                >
                                                    <AddIcon/>
                                                </button>
                                            </div>
                                            <div className="flex-1 flex items-center relative">
                                                {/* Render Project Start and End on Timeline */}
                                                {project.projectStartDate && project.projectDueDate && (
                                                    <div
                                                        className="absolute bg-blue-700 h-5 rounded-full shadow-md"
                                                        style={calculateTaskPosition(
                                                            project.projectStartDate,
                                                            project.projectDueDate,
                                                            timelineStart
                                                        )}
                                                    />
                                                )}
                                            </div>
                                        </div>

                                        {expandedProjects[project.projectKey] && (
                                            <div className="flex flex-col">
                                                {project.tasks.map((task, taskIndex) => {
                                                    const taskPosition = calculateTaskPosition(
                                                        task.startDate,
                                                        task.dueDate,
                                                        timelineStart
                                                    );
                                                    const isLastTask = taskIndex === project.tasks.length - 1;
                                                    const taskGlobalIndex = projectRowOffsets[projectIndex] + taskIndex
                                                    return (
                                                        <div
                                                            key={task.taskKey}
                                                            className={`flex relative-container group hover:bg-gray-100 transition duration-300 ${
                                                                isLastTask ? 'rounded-b-2xl' : 'rounded-lg'
                                                            }`}
                                                            style={{
                                                                width: `${calculateTimelineWidth()}px`,
                                                            }}
                                                        >
                                                            <div
                                                                className={`sticky left-0 z-10 w-[300px] flex items-center shadow-lg p-3 pl-6 cursor-pointer bg-white ${
                                                                    isLastTask ? 'rounded-b-2xl' : ''
                                                                }`}
                                                                onClick={() => {
                                                                    if (isResizingRef.current || wasResizingRef.current) return;
                                                                    openModal('task', 'edit', project, task);
                                                                }}
                                                            >
                                                                <span className="font-medium text-sm flex flex-wrap items-center space-x-1 break-words">
{task.taskKey}: {task.summary.length > 18 ? `${task.summary.substring(0, 15)}...` : task.summary}
                                                                    {task.status && (
                                                                        <span
                                                                            className={`text-xs p-1 rounded-full ml-1 ${
                                                                                task.status === 'Done'
                                                                                    ? 'bg-green-200 text-green-800'
                                                                                    : task.status === 'In Progress'
                                                                                        ? 'bg-yellow-200 text-yellow-800'
                                                                                        : 'bg-red-200 text-red-800'
                                                                            }`}
                                                                        >
                                                                            {task.status}
                                                                        </span>
                                                                    )}
                                                                    {/*{task.assignee && (*/}
                                                                    {/*    <span className="text-xs p-1 bg-blue-100 text-white rounded-full">*/}
                                                                    {/*        <svg className="h-5 w-5 text-gray-600" fill="currentColor" viewBox="0 0 24 24">*/}
                                                                    {/*            <path d="M12 12c2.76 0 5-2.24 5-5S14.76 2 12 2 7 4.24 7 7s2.24 5 5 5zm0 2c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4z" />*/}
                                                                    {/*        </svg>*/}
                                                                    {/*    </span>*/}
                                                                    {/*)}*/}
                                                                    <span className="text-xs p-1 bg-gray-200 text-gray-800 rounded-full">
                                                                        {task.progress ? `${task.progress}%` : '0%'}
                                                                    </span>
                                                                </span>
                                                            </div>
                                                            <div className="flex-1 flex items-center relative">
                                                                <div
                                                                    className={`absolute ${
                                                                        task.isCritical ? 'bg-red-500' : 'bg-blue-400'
                                                                    } h-4 rounded-full shadow-lg cursor-pointer`}
                                                                    style={{
                                                                        marginLeft: `${taskPosition.marginLeft}px`,
                                                                        width: `${taskPosition.width}px`,
                                                                    }}
                                                                    onClick={(e) => {
                                                                        if (isResizingRef.current || wasResizingRef.current) {
                                                                            e.stopPropagation();
                                                                            return;
                                                                        }
                                                                        openModal('task', 'edit', project, task);
                                                                    }}
                                                                >
                                                                    {/* Resize Handles */}
                                                                    <div
                                                                        className="absolute left-0 top-0 h-full w-2 cursor-w-resize"
                                                                        onMouseDown={(e) => {
                                                                            e.stopPropagation();
                                                                            handleMouseDown(
                                                                                e,
                                                                                task.taskKey,
                                                                                project.projectKey,
                                                                                'left'
                                                                            );
                                                                        }}
                                                                    ></div>
                                                                    <div
                                                                        className="absolute right-0 top-0 h-full w-2 cursor-e-resize"
                                                                        onMouseDown={(e) => {
                                                                            e.stopPropagation();
                                                                            handleMouseDown(
                                                                                e,
                                                                                task.taskKey,
                                                                                project.projectKey,
                                                                                'right'
                                                                            );
                                                                        }}
                                                                    ></div>
                                                                </div>

                                                                {new Date(task.dueDate) < new Date() && task.progress < 100 && (
                                                                    <div
                                                                        className="absolute flex items-center space-x-0.5"
                                                                        style={{
                                                                            left: taskPosition.marginLeft + taskPosition.width / 2 - 20,
                                                                            top: -10,
                                                                        }}
                                                                    >
                                                                        <svg
                                                                            className="w-5 h-5 text-yellow-400"
                                                                            fill="currentColor"
                                                                            xmlns="http://www.w3.org/2000/svg"
                                                                            viewBox="0 0 24 24"
                                                                        >
                                                                            <circle cx="12" cy="12" r="10"
                                                                                    fill="currentColor"/>
                                                                            <line x1="12" y1="7" x2="12" y2="13"
                                                                                  stroke="black" strokeWidth="2"
                                                                                  strokeLinecap="round"/>
                                                                            <circle cx="12" cy="16" r="1" fill="black"/>
                                                                        </svg>

                                                                        <span
                                                                            className="text-xs px-1 py-0.5 rounded-md bg-yellow-300 text-black font-semibold">
            Delayed
        </span>
                                                                    </div>
                                                                )}


                                                                {/* Dependency lines */}
                                                                {task.dependencies && task.dependencies.map((dep) => {
                                                                    let depProject, depTask
                                                                    if (typeof dep === 'object') {
                                                                        depProject = processedProjects.find((p) => p.projectKey === dep.projectKey)
                                                                        if (!depProject) return null
                                                                        depTask = depProject.tasks.find((t) => t.id === dep.taskId)
                                                                    } else {
                                                                        const allTasks = processedProjects.flatMap((p) => p.tasks)
                                                                        depTask = allTasks.find((t) => t.id === dep)
                                                                        depProject = processedProjects.find((p) => p.projectKey === depTask?.projectKey)
                                                                    }
                                                                    if (!depProject || !depTask) return null

                                                                    const depProjectIndex = processedProjects.findIndex((p) => p.projectKey === depProject.projectKey)
                                                                    const depTaskIndex = depProject.tasks.findIndex((t) => t.id === depTask.id)
                                                                    const depGlobalIndex = projectRowOffsets[depProjectIndex] + depTaskIndex

                                                                    // The row difference
                                                                    let relativeDepIndex = depGlobalIndex - taskGlobalIndex

                                                                    // If tasks are in different projects, subtract 1 (or 0.5) to lift the line up a bit
                                                                    if (depProjectIndex !== projectIndex) {
                                                                        relativeDepIndex -= 1.4
                                                                    }

                                                                    const verticalSpacing = 50
                                                                    const startY = relativeDepIndex * verticalSpacing + verticalSpacing / 2
                                                                    const endY = verticalSpacing / 2
                                                                    const depPosition = calculateTaskPosition(depTask.startDate, depTask.dueDate, timelineStart)
                                                                    const startX = depPosition.marginLeft + depPosition.width
                                                                    const endX = taskPosition.marginLeft

                                                                    const minY = Math.min(startY, endY)
                                                                    const svgTop = minY
                                                                    const svgHeight = Math.abs(endY - startY) + 20
                                                                    const adjustedStartY = startY - minY
                                                                    const adjustedEndY = endY - minY

                                                                    return (
                                                                        <svg
                                                                            key={`dep-${depTask.id}-${task.id}`}
                                                                            className="absolute"
                                                                            style={{
                                                                                top: `${svgTop}px`,
                                                                                left: 0,
                                                                                width: '100%',
                                                                                height: `${svgHeight}px`,
                                                                                pointerEvents: 'none',
                                                                                zIndex: 2,
                                                                            }}
                                                                        >
                                                                            <path
                                                                                d={generateBezierPath(startX, adjustedStartY, endX, adjustedEndY)}
                                                                                stroke="blue"
                                                                                strokeWidth="2"
                                                                                fill="none"
                                                                                markerEnd="url(#arrowhead)"
                                                                            />
                                                                            <defs>
                                                                                <marker
                                                                                    id="arrowhead"
                                                                                    markerWidth="6"
                                                                                    markerHeight="4"
                                                                                    refX="0"
                                                                                    refY="2"
                                                                                    orient="auto"
                                                                                >
                                                                                    <polygon points="0 0, 6 2, 0 4" fill="blue" />
                                                                                </marker>
                                                                            </defs>
                                                                        </svg>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                        </div>
                    </>
                )}

                {modalOpen && (
                    <TaskProjectModal
                        modalType={modalType}
                        modalMode={modalMode}
                        project={currentProject}
                        task={currentTask}
                        onClose={closeModal}
                    />
                )}
            </div>
        </div>
    );
};

export default Timeline;
