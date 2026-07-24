import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ToolInvocation } from "ai";
import { ToolInvocationBadge } from "../ToolInvocationBadge";

afterEach(() => {
  cleanup();
});

function makeInvocation(overrides: Partial<ToolInvocation> & { toolName: string; args: any }): ToolInvocation {
  return {
    toolCallId: "call_1",
    state: "call",
    ...overrides,
  } as ToolInvocation;
}

test("shows 'Creating' with a spinner while a file is being created", () => {
  const invocation = makeInvocation({
    toolName: "str_replace_editor",
    args: { command: "create", path: "/App.jsx" },
    state: "call",
  });

  const { container } = render(
    <ToolInvocationBadge toolInvocation={invocation} />
  );

  expect(screen.getByText("Creating App.jsx")).toBeDefined();
  expect(container.querySelector(".animate-spin")).not.toBeNull();
  expect(container.querySelector(".bg-emerald-500")).toBeNull();
});

test("shows 'Created' with a done indicator once the file is created", () => {
  const invocation = makeInvocation({
    toolName: "str_replace_editor",
    args: { command: "create", path: "/App.jsx" },
    state: "result",
    result: "File created: /App.jsx",
  } as any);

  const { container } = render(
    <ToolInvocationBadge toolInvocation={invocation} />
  );

  expect(screen.getByText("Created App.jsx")).toBeDefined();
  expect(container.querySelector(".bg-emerald-500")).not.toBeNull();
  expect(container.querySelector(".animate-spin")).toBeNull();
});

test("shows 'Editing'/'Edited' for str_replace commands", () => {
  const running = makeInvocation({
    toolName: "str_replace_editor",
    args: { command: "str_replace", path: "/components/Card.jsx" },
    state: "call",
  });
  const { rerender } = render(
    <ToolInvocationBadge toolInvocation={running} />
  );
  expect(screen.getByText("Editing Card.jsx")).toBeDefined();

  const done = makeInvocation({
    toolName: "str_replace_editor",
    args: { command: "str_replace", path: "/components/Card.jsx" },
    state: "result",
    result: "Replaced 1 occurrence(s)",
  } as any);
  rerender(<ToolInvocationBadge toolInvocation={done} />);
  expect(screen.getByText("Edited Card.jsx")).toBeDefined();
});

test("shows 'Editing'/'Edited' for insert commands", () => {
  const invocation = makeInvocation({
    toolName: "str_replace_editor",
    args: { command: "insert", path: "/components/Card.jsx" },
    state: "call",
  });

  render(<ToolInvocationBadge toolInvocation={invocation} />);

  expect(screen.getByText("Editing Card.jsx")).toBeDefined();
});

test("shows 'Viewing'/'Viewed' for view commands", () => {
  const running = makeInvocation({
    toolName: "str_replace_editor",
    args: { command: "view", path: "/App.jsx" },
    state: "call",
  });
  const { rerender } = render(
    <ToolInvocationBadge toolInvocation={running} />
  );
  expect(screen.getByText("Viewing App.jsx")).toBeDefined();

  const done = makeInvocation({
    toolName: "str_replace_editor",
    args: { command: "view", path: "/App.jsx" },
    state: "result",
    result: "1\tcontent",
  } as any);
  rerender(<ToolInvocationBadge toolInvocation={done} />);
  expect(screen.getByText("Viewed App.jsx")).toBeDefined();
});

test("shows 'Reverting'/'Reverted' for undo_edit commands", () => {
  const running = makeInvocation({
    toolName: "str_replace_editor",
    args: { command: "undo_edit", path: "/App.jsx" },
    state: "call",
  });
  const { rerender } = render(
    <ToolInvocationBadge toolInvocation={running} />
  );
  expect(screen.getByText("Reverting App.jsx")).toBeDefined();

  const done = makeInvocation({
    toolName: "str_replace_editor",
    args: { command: "undo_edit", path: "/App.jsx" },
    state: "result",
    result: "reverted",
  } as any);
  rerender(<ToolInvocationBadge toolInvocation={done} />);
  expect(screen.getByText("Reverted App.jsx")).toBeDefined();
});

test("shows 'Renaming'/'Renamed' for file_manager rename commands", () => {
  const running = makeInvocation({
    toolName: "file_manager",
    args: {
      command: "rename",
      path: "/components/Old.jsx",
      new_path: "/components/New.jsx",
    },
    state: "call",
  });
  const { rerender } = render(
    <ToolInvocationBadge toolInvocation={running} />
  );
  expect(screen.getByText("Renaming Old.jsx to New.jsx")).toBeDefined();

  const done = makeInvocation({
    toolName: "file_manager",
    args: {
      command: "rename",
      path: "/components/Old.jsx",
      new_path: "/components/New.jsx",
    },
    state: "result",
    result: { success: true },
  } as any);
  rerender(<ToolInvocationBadge toolInvocation={done} />);
  expect(screen.getByText("Renamed Old.jsx to New.jsx")).toBeDefined();
});

test("shows 'Deleting'/'Deleted' for file_manager delete commands", () => {
  const running = makeInvocation({
    toolName: "file_manager",
    args: { command: "delete", path: "/components/Old.jsx" },
    state: "call",
  });
  const { rerender } = render(
    <ToolInvocationBadge toolInvocation={running} />
  );
  expect(screen.getByText("Deleting Old.jsx")).toBeDefined();

  const done = makeInvocation({
    toolName: "file_manager",
    args: { command: "delete", path: "/components/Old.jsx" },
    state: "result",
    result: { success: true },
  } as any);
  rerender(<ToolInvocationBadge toolInvocation={done} />);
  expect(screen.getByText("Deleted Old.jsx")).toBeDefined();
});

test("shows only the file's basename, not the full path", () => {
  const invocation = makeInvocation({
    toolName: "str_replace_editor",
    args: { command: "create", path: "/components/ui/Card.jsx" },
    state: "call",
  });

  render(<ToolInvocationBadge toolInvocation={invocation} />);

  expect(screen.getByText("Creating Card.jsx")).toBeDefined();
  expect(screen.queryByText(/components\/ui/)).toBeNull();
});

test("falls back gracefully when args are missing", () => {
  const invocation = makeInvocation({
    toolName: "str_replace_editor",
    args: {},
    state: "result",
    result: "Success",
  } as any);

  render(<ToolInvocationBadge toolInvocation={invocation} />);

  expect(screen.getByText("Updated a file")).toBeDefined();
  expect(screen.queryByText("str_replace_editor")).toBeNull();
});

test("falls back to the raw tool name for an unrecognized tool", () => {
  const invocation = makeInvocation({
    toolName: "some_future_tool",
    args: { command: "do_something", path: "/App.jsx" },
    state: "call",
  });

  render(<ToolInvocationBadge toolInvocation={invocation} />);

  expect(screen.getByText("some_future_tool")).toBeDefined();
});
