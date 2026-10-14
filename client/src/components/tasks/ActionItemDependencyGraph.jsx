import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Crosshair,
  Filter,
  GitBranch,
  Info,
  Loader2,
  Maximize2,
  Minus,
  Plus,
  RefreshCw,
  Search,
  Target,
  X,
} from "lucide-react";
import {
  getActionItemGraph,
  resolveActionItemBlockers,
} from "../../api/actionItemGraphApi.js";

const GRAPH_WIDTH = 1100;
const GRAPH_HEIGHT = 560;
const NODE_WIDTH = 176;
const NODE_HEIGHT = 74;
const LEVEL_GAP = 230;
const NODE_GAP = 28;
const PADDING = 42;

const EMPTY_GRAPH = { nodes: [], edges: [] };

const asId = (value) => (value == null ? "" : String(value));

const normalizeGraph = (graph) => {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph?.edges) ? graph.edges : [];

  const nodeMap = new Map();
  nodes.forEach((node) => {
    const id = asId(node?.id);
    if (!id) return;
    nodeMap.set(id, {
      ...node,
      id,
      meeting: node.meeting || null,
    });
  });

  const normalizedEdges = edges
    .map((edge, index) => ({
      ...edge,
      id: asId(edge?.id) || `edge-${index}`,
      source: asId(edge?.source),
      target: asId(edge?.target),
      type: edge?.type || "BLOCKS",
      status: edge?.status || "ACTIVE",
      weight: Number(edge?.weight) || 1,
    }))
    .filter((edge) => edge.source && edge.target);

  // The backend normally returns both endpoints as nodes. Keeping endpoint
  // placeholders makes the visualizer resilient to partial/legacy payloads.
  normalizedEdges.forEach((edge) => {
    if (!nodeMap.has(edge.source)) {
      nodeMap.set(edge.source, { id: edge.source, type: "actionItem" });
    }
    if (!nodeMap.has(edge.target)) {
      nodeMap.set(edge.target, { id: edge.target, type: "actionItem" });
    }
  });

  return {
    nodes: Array.from(nodeMap.values()),
    edges: normalizedEdges,
  };
};

const getMeetingLabel = (meeting) => {
  if (!meeting) return "Meeting unavailable";
  if (typeof meeting === "string") return meeting;
  return meeting.title || meeting._id || meeting.id || "Meeting";
};

const getNodeLabel = (node) => {
  const id = asId(node?.id);
  if (!id) return "Unknown action item";
  return id.length > 22 ? `${id.slice(0, 10)}…${id.slice(-8)}` : id;
};

const getNodeTitle = (node) => {
  const meeting = getMeetingLabel(node?.meeting);
  return `${getNodeLabel(node)} — ${meeting}`;
};

const buildAdjacency = (nodes, edges) => {
  const outgoing = new Map();
  const incoming = new Map();
  nodes.forEach((node) => {
    outgoing.set(asId(node.id), []);
    incoming.set(asId(node.id), []);
  });
  edges.forEach((edge) => {
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    if (!incoming.has(edge.target)) incoming.set(edge.target, []);
    outgoing.get(edge.source).push(edge.target);
    incoming.get(edge.target).push(edge.source);
  });
  return { outgoing, incoming };
};

const collectNeighborhood = (rootId, adjacency, direction) => {
  if (!rootId) return new Set();
  const result = new Set([rootId]);
  const queue = [rootId];
  const map =
    direction === "upstream" ? adjacency.incoming : adjacency.outgoing;

  while (queue.length) {
    const current = queue.shift();
    for (const next of map.get(current) || []) {
      if (!result.has(next)) {
        result.add(next);
        queue.push(next);
      }
    }
  }
  return result;
};

const calculateLevels = (nodes, edges) => {
  const indegree = new Map(nodes.map((node) => [asId(node.id), 0]));
  const outgoing = new Map(nodes.map((node) => [asId(node.id), []]));

  edges.forEach((edge) => {
    if (!indegree.has(edge.target)) indegree.set(edge.target, 0);
    if (!outgoing.has(edge.source)) outgoing.set(edge.source, []);
    indegree.set(edge.target, indegree.get(edge.target) + 1);
    outgoing.get(edge.source).push(edge.target);
  });

  const queue = [];
  indegree.forEach((value, key) => {
    if (value === 0) queue.push(key);
  });

  const levels = new Map();
  queue.forEach((id) => levels.set(id, 0));
  let processed = 0;

  while (queue.length) {
    const current = queue.shift();
    processed += 1;
    const currentLevel = levels.get(current) || 0;
    for (const target of outgoing.get(current) || []) {
      const nextLevel = Math.max(levels.get(target) || 0, currentLevel + 1);
      levels.set(target, nextLevel);
      const nextDegree = indegree.get(target) - 1;
      indegree.set(target, nextDegree);
      if (nextDegree === 0) queue.push(target);
    }
  }

  // Defensive fallback for malformed/cyclic legacy data. The server rejects
  // cycles when creating dependencies, but the UI should still render a graph
  // if historical data contains one.
  if (processed < nodes.length) {
    nodes.forEach((node) => {
      const id = asId(node.id);
      if (!levels.has(id)) levels.set(id, 0);
    });
  }

  return levels;
};

const layoutGraph = (
  nodes,
  edges,
  width = GRAPH_WIDTH,
  height = GRAPH_HEIGHT,
) => {
  if (!nodes.length) return new Map();
  const levels = calculateLevels(nodes, edges);
  const groups = new Map();

  nodes.forEach((node) => {
    const level = levels.get(asId(node.id)) || 0;
    if (!groups.has(level)) groups.set(level, []);
    groups.get(level).push(node);
  });

  const maxLevel = Math.max(...groups.keys());
  const positions = new Map();

  for (let level = 0; level <= maxLevel; level += 1) {
    const group = groups.get(level) || [];
    const usableHeight = Math.max(height - PADDING * 2, NODE_HEIGHT);
    const totalHeight =
      group.length * NODE_HEIGHT + Math.max(group.length - 1, 0) * NODE_GAP;
    const startY = Math.max(
      PADDING,
      (usableHeight - totalHeight) / 2 + PADDING,
    );
    const x = Math.min(
      PADDING + level * LEVEL_GAP,
      width - NODE_WIDTH - PADDING,
    );

    group.forEach((node, index) => {
      positions.set(asId(node.id), {
        x,
        y: startY + index * (NODE_HEIGHT + NODE_GAP),
      });
    });
  }

  return positions;
};

const edgeMatchesFilter = (edge, filter) => {
  if (filter === "all") return true;
  if (filter === "active") return edge.status === "ACTIVE";
  if (filter === "resolved") return edge.status === "RESOLVED";
  if (filter === "blocks") return edge.type === "BLOCKS";
  return true;
};

const ActionItemDependencyGraph = ({
  meetingId = "",
  taskItems = [],
  onSelectTask,
  className = "",
}) => {
  const [graph, setGraph] = useState(EMPTY_GRAPH);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [view, setView] = useState("all");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [showFilters, setShowFilters] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveMessage, setResolveMessage] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef(null);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError("");
    setResolveMessage("");
    try {
      const nextGraph = await getActionItemGraph({ meetingId });
      setGraph(normalizeGraph(nextGraph));
    } catch (err) {
      setGraph(EMPTY_GRAPH);
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "Unable to load the action item dependency graph.",
      );
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const adjacency = useMemo(
    () => buildAdjacency(graph.nodes, graph.edges),
    [graph.nodes, graph.edges],
  );

  const neighborhoodIds = useMemo(() => {
    if (!selectedNodeId || view === "all")
      return new Set(graph.nodes.map((node) => asId(node.id)));
    if (view === "upstream")
      return collectNeighborhood(selectedNodeId, adjacency, "upstream");
    if (view === "downstream")
      return collectNeighborhood(selectedNodeId, adjacency, "downstream");
    return new Set(graph.nodes.map((node) => asId(node.id)));
  }, [adjacency, graph.nodes, selectedNodeId, view]);

  const visibleGraph = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const matchesSearch = (node) => {
      if (!normalizedSearch) return true;
      const meeting = getMeetingLabel(node.meeting).toLowerCase();
      return (
        asId(node.id).toLowerCase().includes(normalizedSearch) ||
        meeting.includes(normalizedSearch)
      );
    };

    const candidateNodes = graph.nodes.filter((node) => {
      const id = asId(node.id);
      return neighborhoodIds.has(id) && matchesSearch(node);
    });
    const candidateIds = new Set(candidateNodes.map((node) => asId(node.id)));
    const candidateEdges = graph.edges.filter(
      (edge) =>
        candidateIds.has(edge.source) &&
        candidateIds.has(edge.target) &&
        edgeMatchesFilter(edge, statusFilter),
    );

    return { nodes: candidateNodes, edges: candidateEdges };
  }, [graph, neighborhoodIds, search, statusFilter]);

  const positions = useMemo(
    () => layoutGraph(visibleGraph.nodes, visibleGraph.edges),
    [visibleGraph],
  );

  const selectedNode = useMemo(
    () => graph.nodes.find((node) => asId(node.id) === selectedNodeId) || null,
    [graph.nodes, selectedNodeId],
  );

  const selectedTask = useMemo(() => {
    if (!selectedNodeId) return null;
    return (
      taskItems.find(
        (task) => asId(task?.id || task?._id) === selectedNodeId,
      ) || null
    );
  }, [selectedNodeId, taskItems]);

  const blockers = useMemo(() => {
    if (!selectedNodeId) return [];
    return graph.edges.filter(
      (edge) => edge.target === selectedNodeId && edge.status === "ACTIVE",
    );
  }, [graph.edges, selectedNodeId]);

  const dependents = useMemo(() => {
    if (!selectedNodeId) return [];
    return graph.edges.filter(
      (edge) => edge.source === selectedNodeId && edge.status === "ACTIVE",
    );
  }, [graph.edges, selectedNodeId]);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const selectNode = (nodeId) => {
    setSelectedNodeId(nodeId);
    setResolveMessage("");
    const task = taskItems.find(
      (item) => asId(item?.id || item?._id) === nodeId,
    );
    if (task && onSelectTask) onSelectTask(task);
  };

  const handleResolve = async () => {
    if (!selectedNodeId || resolving) return;
    setResolving(true);
    setResolveMessage("");
    try {
      await resolveActionItemBlockers(selectedNodeId);
      await loadGraph();
      setResolveMessage("Blocker dependencies resolved.");
    } catch (err) {
      setResolveMessage(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Unable to resolve blockers.",
      );
    } finally {
      setResolving(false);
    }
  };

  const handleWheel = (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const direction = event.deltaY < 0 ? 0.1 : -0.1;
    setZoom((current) =>
      Math.min(1.8, Math.max(0.55, Number((current + direction).toFixed(2)))),
    );
  };

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;
    setIsDragging(true);
    dragStart.current = { clientX: event.clientX, clientY: event.clientY, pan };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!isDragging || !dragStart.current) return;
    const start = dragStart.current;
    setPan({
      x: start.pan.x + event.clientX - start.clientX,
      y: start.pan.y + event.clientY - start.clientY,
    });
  };

  const stopDragging = () => {
    setIsDragging(false);
    dragStart.current = null;
  };

  const increaseZoom = () =>
    setZoom((value) => Math.min(1.8, Number((value + 0.1).toFixed(2))));
  const decreaseZoom = () =>
    setZoom((value) => Math.max(0.55, Number((value - 0.1).toFixed(2))));

  const nodeCount = graph.nodes.length;
  const edgeCount = graph.edges.length;
  const activeEdgeCount = graph.edges.filter(
    (edge) => edge.status === "ACTIVE",
  ).length;

  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className}`}
      aria-label="Action item dependency graph"
    >
      <header className="border-b border-slate-200 p-5 dark:border-slate-700">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300">
              <GitBranch className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Action Item Dependency Graph
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
                Explore blockers and downstream commitments from the live
                action-item topology API.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              aria-expanded={showFilters}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
              Filters
              {showFilters ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={loadGraph}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              Refresh
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_auto_auto] dark:border-slate-700 dark:bg-slate-950/60">
            <label className="relative block">
              <span className="sr-only">
                Search action item IDs or meetings
              </span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search action item or meeting"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none ring-indigo-500 focus:ring-2 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </label>
            <label className="block">
              <span className="sr-only">Edge status filter</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="all">All edges</option>
                <option value="active">Active blockers</option>
                <option value="resolved">Resolved edges</option>
                <option value="blocks">BLOCKS only</option>
              </select>
            </label>
            <label className="block">
              <span className="sr-only">Graph view</span>
              <select
                value={view}
                onChange={(event) => setView(event.target.value)}
                disabled={!selectedNodeId}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                <option value="all">Full graph</option>
                <option value="upstream">Upstream blockers</option>
                <option value="downstream">Downstream dependents</option>
              </select>
            </label>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium dark:bg-slate-800">
            {nodeCount} nodes
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium dark:bg-slate-800">
            {edgeCount} dependencies
          </span>
          <span className="rounded-full bg-amber-50 px-3 py-1.5 font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            {activeEdgeCount} active
          </span>
          {meetingId && (
            <span className="max-w-full truncate rounded-full bg-indigo-50 px-3 py-1.5 font-medium text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
              Meeting: {meetingId}
            </span>
          )}
        </div>
      </header>

      {error ? (
        <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/70 dark:bg-red-950/30">
          <AlertCircle
            className="mx-auto mb-3 h-8 w-8 text-red-600 dark:text-red-400"
            aria-hidden="true"
          />
          <h3 className="font-semibold text-red-900 dark:text-red-200">
            Graph unavailable
          </h3>
          <p className="mx-auto mt-1 max-w-xl text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
          <button
            type="button"
            onClick={loadGraph}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : loading && !graph.nodes.length ? (
        <div className="flex min-h-[420px] items-center justify-center">
          <div className="text-center">
            <Loader2
              className="mx-auto mb-3 h-8 w-8 animate-spin text-indigo-600"
              aria-hidden="true"
            />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              Loading dependency topology…
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Fetching the organization graph from the protected API.
            </p>
          </div>
        </div>
      ) : !graph.nodes.length ? (
        <div className="flex min-h-[420px] items-center justify-center p-8">
          <div className="max-w-md text-center">
            <GitBranch
              className="mx-auto mb-4 h-12 w-12 text-slate-300 dark:text-slate-600"
              aria-hidden="true"
            />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              No dependencies yet
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
              Once action items are connected as blockers or dependencies, their
              topology will appear here automatically.
            </p>
          </div>
        </div>
      ) : !visibleGraph.nodes.length ? (
        <div className="flex min-h-[420px] items-center justify-center p-8">
          <div className="max-w-md text-center">
            <Search
              className="mx-auto mb-4 h-10 w-10 text-slate-300 dark:text-slate-600"
              aria-hidden="true"
            />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              No matching nodes
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Adjust the search, edge filter, or neighborhood view to see more
              of the topology.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setView("all");
              }}
              className="mt-4 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Clear filters
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            className="relative overflow-hidden border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950"
            style={{ minHeight: 420 }}
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
            role="application"
            aria-label="Interactive action item dependency graph. Hold Ctrl or Command while scrolling to zoom, or drag to pan."
          >
            <div className="absolute left-4 top-4 z-10 flex items-center gap-1 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
              <button
                type="button"
                title="Zoom out"
                aria-label="Zoom out"
                onClick={decreaseZoom}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-12 text-center text-xs font-semibold text-slate-600 dark:text-slate-300">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                title="Zoom in"
                aria-label="Zoom in"
                onClick={increaseZoom}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                title="Reset view"
                aria-label="Reset graph view"
                onClick={resetView}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>

            <div className="absolute right-4 top-4 z-10 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs text-slate-500 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-400">
              Drag to pan · Ctrl/⌘ + wheel to zoom
            </div>

            <svg
              viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
              className={`h-[520px] w-full select-none ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
            >
              <defs>
                <marker
                  id="action-item-arrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                </marker>
                <filter
                  id="action-item-node-shadow"
                  x="-20%"
                  y="-20%"
                  width="140%"
                  height="140%"
                >
                  <feDropShadow
                    dx="0"
                    dy="2"
                    stdDeviation="3"
                    floodOpacity="0.12"
                  />
                </filter>
              </defs>

              <g
                transform={`translate(${pan.x + GRAPH_WIDTH / 2 - (GRAPH_WIDTH / 2) * zoom} ${pan.y + GRAPH_HEIGHT / 2 - (GRAPH_HEIGHT / 2) * zoom}) scale(${zoom})`}
              >
                {visibleGraph.edges.map((edge) => {
                  const source = positions.get(edge.source);
                  const target = positions.get(edge.target);
                  if (!source || !target) return null;
                  const sourceX = source.x + NODE_WIDTH;
                  const sourceY = source.y + NODE_HEIGHT / 2;
                  const targetX = target.x;
                  const targetY = target.y + NODE_HEIGHT / 2;
                  const curve = Math.max(
                    35,
                    Math.abs(targetX - sourceX) * 0.45,
                  );
                  const path = `M ${sourceX} ${sourceY} C ${sourceX + curve} ${sourceY}, ${targetX - curve} ${targetY}, ${targetX} ${targetY}`;
                  const isSelected =
                    edge.source === selectedNodeId ||
                    edge.target === selectedNodeId;
                  return (
                    <path
                      key={edge.id}
                      d={path}
                      fill="none"
                      stroke={
                        edge.status === "RESOLVED"
                          ? "#94a3b8"
                          : isSelected
                            ? "#4f46e5"
                            : "#cbd5e1"
                      }
                      strokeWidth={isSelected ? 3 : 2}
                      strokeDasharray={
                        edge.status === "RESOLVED" ? "7 6" : undefined
                      }
                      markerEnd="url(#action-item-arrow)"
                      opacity={selectedNodeId && !isSelected ? 0.35 : 0.9}
                    />
                  );
                })}

                {visibleGraph.nodes.map((node) => {
                  const position = positions.get(asId(node.id));
                  if (!position) return null;
                  const id = asId(node.id);
                  const selected = id === selectedNodeId;
                  const connected =
                    (selectedNodeId &&
                      (adjacency.outgoing.get(selectedNodeId) || []).includes(
                        id,
                      )) ||
                    (adjacency.incoming.get(selectedNodeId) || []).includes(id);
                  const dimmed = selectedNodeId && !selected && !connected;
                  return (
                    <g
                      key={id}
                      transform={`translate(${position.x} ${position.y})`}
                      onClick={(event) => {
                        event.stopPropagation();
                        selectNode(id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          selectNode(id);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={getNodeTitle(node)}
                      className="cursor-pointer outline-none"
                      opacity={dimmed ? 0.35 : 1}
                    >
                      <rect
                        width={NODE_WIDTH}
                        height={NODE_HEIGHT}
                        rx="14"
                        fill={selected ? "#eef2ff" : "#ffffff"}
                        stroke={
                          selected
                            ? "#4f46e5"
                            : connected
                              ? "#818cf8"
                              : "#cbd5e1"
                        }
                        strokeWidth={selected ? 3 : 1.5}
                        filter="url(#action-item-node-shadow)"
                      />
                      <circle
                        cx="20"
                        cy="22"
                        r="6"
                        fill={selected ? "#4f46e5" : "#64748b"}
                      />
                      <text
                        x="34"
                        y="27"
                        fontSize="12"
                        fontWeight="700"
                        fill={selected ? "#3730a3" : "#0f172a"}
                      >
                        {getNodeLabel(node)}
                      </text>
                      <text x="16" y="48" fontSize="10" fill="#64748b">
                        {getMeetingLabel(node.meeting).slice(0, 24)}
                      </text>
                      <text x="16" y="63" fontSize="9" fill="#94a3b8">
                        Action item
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>

          <div className="grid gap-5 p-5 lg:grid-cols-[1fr_320px]">
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <CircleDot
                  className="h-4 w-4 text-indigo-600"
                  aria-hidden="true"
                />
                Dependency legend
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-400">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-8 rounded-full bg-slate-300" />{" "}
                  Active edge
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-0.5 w-8 border-t-2 border-dashed border-slate-400" />{" "}
                  Resolved edge
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-indigo-600" />{" "}
                  Selected node
                </span>
              </div>
              <div className="mt-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-950">
                <div className="flex items-start gap-3">
                  <Info
                    className="mt-0.5 h-4 w-4 shrink-0 text-slate-500"
                    aria-hidden="true"
                  />
                  <p className="text-xs leading-5 text-slate-600 dark:text-slate-400">
                    Nodes and edges are rendered directly from the backend
                    topology response. The graph does not introduce mock
                    dependency data into the production path.
                  </p>
                </div>
              </div>
            </div>

            <aside
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950"
              aria-live="polite"
            >
              {!selectedNode ? (
                <div className="text-center">
                  <Target
                    className="mx-auto mb-3 h-7 w-7 text-slate-400"
                    aria-hidden="true"
                  />
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Select a node
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Choose an action item to inspect its blockers and downstream
                    dependents.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">
                        Selected action item
                      </p>
                      <h3 className="mt-1 break-all text-sm font-bold text-slate-900 dark:text-white">
                        {selectedNode.id}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedNodeId("")}
                      aria-label="Clear selected action item"
                      className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-700 dark:hover:bg-slate-900"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <dl className="mt-4 space-y-2 text-xs">
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Meeting</dt>
                      <dd className="max-w-[190px] truncate text-right font-medium text-slate-700 dark:text-slate-200">
                        {getMeetingLabel(selectedNode.meeting)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Blockers</dt>
                      <dd className="font-semibold text-slate-800 dark:text-white">
                        {blockers.length}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt className="text-slate-500">Dependents</dt>
                      <dd className="font-semibold text-slate-800 dark:text-white">
                        {dependents.length}
                      </dd>
                    </div>
                  </dl>

                  {selectedTask && onSelectTask && (
                    <button
                      type="button"
                      onClick={() => onSelectTask(selectedTask)}
                      className="mt-4 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      Open action item details
                    </button>
                  )}

                  {!selectedTask && (
                    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                      This node is not on the currently loaded Tasks page. Its
                      topology is still live; use the action item ID above to
                      locate it in the full action-item list.
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleResolve}
                    disabled={!blockers.length || resolving}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    {resolving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Crosshair className="h-4 w-4" />
                    )}
                    Resolve blockers
                  </button>
                  {resolveMessage && (
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                      {resolveMessage}
                    </p>
                  )}
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </section>
  );
};

export default ActionItemDependencyGraph;
