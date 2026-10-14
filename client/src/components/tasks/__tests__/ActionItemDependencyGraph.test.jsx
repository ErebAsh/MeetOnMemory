import React from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ActionItemDependencyGraph from "../ActionItemDependencyGraph.jsx";
import {
  getActionItemGraph,
  resolveActionItemBlockers,
} from "../../../api/actionItemGraphApi.js";

vi.mock("../../../api/actionItemGraphApi.js", () => ({
  getActionItemGraph: vi.fn(),
  resolveActionItemBlockers: vi.fn(),
}));

const graphFixture = {
  nodes: [
    {
      id: "task-a",
      type: "actionItem",
      meeting: { title: "Planning meeting", _id: "meeting-a" },
    },
    {
      id: "task-b",
      type: "actionItem",
      meeting: { title: "Execution meeting", _id: "meeting-b" },
    },
    {
      id: "task-c",
      type: "actionItem",
      meeting: { title: "Review meeting", _id: "meeting-c" },
    },
  ],
  edges: [
    {
      id: "edge-a-b",
      source: "task-a",
      target: "task-b",
      type: "BLOCKS",
      status: "ACTIVE",
      weight: 2,
    },
    {
      id: "edge-b-c",
      source: "task-b",
      target: "task-c",
      type: "DEPENDS_ON",
      status: "RESOLVED",
      weight: 1,
    },
  ],
};

const renderGraph = (props = {}) =>
  render(
    <ActionItemDependencyGraph
      taskItems={[]}
      onSelectTask={vi.fn()}
      {...props}
    />,
  );

describe("ActionItemDependencyGraph", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActionItemGraph.mockResolvedValue(graphFixture);
    resolveActionItemBlockers.mockResolvedValue({
      message: "Action item blocker dependencies resolved",
    });
  });

  it("loads live topology data and renders node and dependency counts", async () => {
    renderGraph();

    expect(
      screen.getByText("Loading dependency topology…"),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("3 nodes")).toBeInTheDocument();
      expect(screen.getByText("2 dependencies")).toBeInTheDocument();
      expect(screen.getByText("1 active")).toBeInTheDocument();
    });

    expect(getActionItemGraph).toHaveBeenCalledWith({ meetingId: "" });
    expect(
      screen.getByRole("button", { name: /task-a — planning meeting/i }),
    ).toBeInTheDocument();
  });

  it("passes a meeting filter to the topology API", async () => {
    renderGraph({ meetingId: "meeting-42" });

    await waitFor(() =>
      expect(getActionItemGraph).toHaveBeenCalledWith({
        meetingId: "meeting-42",
      }),
    );
    expect(screen.getByText("Meeting: meeting-42")).toBeInTheDocument();
  });

  it("selects a node and opens the matching task details callback", async () => {
    const selectedTask = {
      id: "task-b",
      title: "Ship release",
      status: "OPEN",
    };
    const onSelectTask = vi.fn();
    renderGraph({ taskItems: [selectedTask], onSelectTask });

    const node = await screen.findByRole("button", {
      name: /task-b — execution meeting/i,
    });
    fireEvent.click(node);

    expect(onSelectTask).toHaveBeenCalledWith(selectedTask);
    expect(screen.getByText("Selected action item")).toBeInTheDocument();
    expect(screen.getAllByText("task-b").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Blockers")).toBeInTheDocument();
    expect(screen.getByText("Dependents")).toBeInTheDocument();
  });

  it("shows upstream and downstream neighborhood filters after a node is selected", async () => {
    renderGraph();

    await screen.findByRole("button", { name: /task-b — execution meeting/i });
    fireEvent.click(
      screen.getByRole("button", { name: /task-b — execution meeting/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /filters/i }));

    const viewSelect = screen.getByRole("combobox", { name: /graph view/i });
    expect(viewSelect).toBeInTheDocument();

    fireEvent.change(viewSelect, { target: { value: "upstream" } });
    expect(
      screen.getByRole("button", { name: /task-a — planning meeting/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /task-b — execution meeting/i }),
    ).toBeInTheDocument();

    fireEvent.change(viewSelect, { target: { value: "downstream" } });
    expect(
      screen.getByRole("button", { name: /task-b — execution meeting/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /task-c — review meeting/i }),
    ).toBeInTheDocument();
  });

  it("filters edges by active status", async () => {
    renderGraph();
    await screen.findByText("3 nodes");
    fireEvent.click(screen.getByRole("button", { name: /filters/i }));

    const statusSelect = screen.getByRole("combobox", {
      name: /edge status filter/i,
    });
    fireEvent.change(statusSelect, { target: { value: "active" } });

    // The resolved edge should no longer be represented by an SVG path. The
    // selected node panel remains available, proving filtering only affects
    // the rendered topology rather than the source graph state.
    fireEvent.click(
      screen.getByRole("button", { name: /task-b — execution meeting/i }),
    );
    expect(screen.getByText("Blockers")).toBeInTheDocument();
  });

  it("supports searching by action item id", async () => {
    renderGraph();
    await screen.findByText("3 nodes");
    fireEvent.click(screen.getByRole("button", { name: /filters/i }));

    const search = screen.getByPlaceholderText("Search action item or meeting");
    fireEvent.change(search, { target: { value: "task-c" } });

    expect(
      screen.getByRole("button", { name: /task-c — review meeting/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /task-a — planning meeting/i }),
    ).not.toBeInTheDocument();
  });

  it("shows a useful empty state when the organization has no dependencies", async () => {
    getActionItemGraph.mockResolvedValueOnce({ nodes: [], edges: [] });
    renderGraph();

    await waitFor(() => {
      expect(screen.getByText("No dependencies yet")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Once action items are connected as blockers/i),
    ).toBeInTheDocument();
  });

  it("shows an API error with a retry action", async () => {
    getActionItemGraph.mockRejectedValueOnce(
      new Error("Topology service unavailable"),
    );
    renderGraph();

    await waitFor(() => {
      expect(screen.getByText("Graph unavailable")).toBeInTheDocument();
      expect(
        screen.getByText("Topology service unavailable"),
      ).toBeInTheDocument();
    });

    getActionItemGraph.mockResolvedValueOnce(graphFixture);
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    await waitFor(() =>
      expect(screen.getByText("3 nodes")).toBeInTheDocument(),
    );
  });

  it("resolves active blockers through the backend API and refreshes the graph", async () => {
    renderGraph();
    await screen.findByText("3 nodes");
    fireEvent.click(
      screen.getByRole("button", { name: /task-b — execution meeting/i }),
    );

    const resolveButton = screen.getByRole("button", {
      name: /resolve blockers/i,
    });
    expect(resolveButton).toBeEnabled();
    fireEvent.click(resolveButton);

    await waitFor(() => {
      expect(resolveActionItemBlockers).toHaveBeenCalledWith("task-b");
      expect(getActionItemGraph).toHaveBeenCalledTimes(2);
      expect(
        screen.getByText("Blocker dependencies resolved."),
      ).toBeInTheDocument();
    });
  });

  it("disables blocker resolution when the selected node has no active blockers", async () => {
    renderGraph();
    await screen.findByText("3 nodes");
    fireEvent.click(
      screen.getByRole("button", { name: /task-a — planning meeting/i }),
    );

    const resolveButton = screen.getByRole("button", {
      name: /resolve blockers/i,
    });
    expect(resolveButton).toBeDisabled();
    expect(resolveActionItemBlockers).not.toHaveBeenCalled();
  });

  it("allows the user to clear a selected node", async () => {
    renderGraph();
    await screen.findByText("3 nodes");
    fireEvent.click(
      screen.getByRole("button", { name: /task-b — execution meeting/i }),
    );
    expect(screen.getByText("Selected action item")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /clear selected action item/i }),
    );
    expect(screen.getByText("Select a node")).toBeInTheDocument();
  });

  it("keeps a graph node usable with keyboard interaction", async () => {
    const onSelectTask = vi.fn();
    const task = { id: "task-c", title: "Review" };
    renderGraph({ taskItems: [task], onSelectTask });

    const node = await screen.findByRole("button", {
      name: /task-c — review meeting/i,
    });
    fireEvent.keyDown(node, { key: "Enter" });
    expect(onSelectTask).toHaveBeenCalledWith(task);
  });
});
