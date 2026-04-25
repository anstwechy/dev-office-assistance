import type { TriageStatus } from "@prisma/client";
import type { Client } from "@microsoft/microsoft-graph-client";

export type GraphTask = {
  id?: string;
  title?: string;
  status?: string;
  /** Microsoft To Do: low | normal | high */
  importance?: string;
  dueDateTime?: { dateTime?: string; timeZone?: string } | null;
  body?: { content?: string; contentType?: string } | null;
  webUrl?: string;
  createdDateTime?: string | null;
  lastModifiedDateTime?: string | null;
};

/** Map Microsoft To Do task status into triage workflow. */
export function graphTaskStatusToTriageStatus(graphStatus: string | undefined): TriageStatus {
  switch (graphStatus) {
    case "completed":
      return "done";
    case "inProgress":
      return "in_progress";
    case "deferred":
      return "snoozed";
    case "notStarted":
    case "waitingOnOthers":
      return "inbox";
    default:
      return "inbox";
  }
}

type GraphApiTaskStatus =
  | "notStarted"
  | "inProgress"
  | "completed"
  | "waitingOnOthers"
  | "deferred";

function graphStatusString(s: TriageStatus): GraphApiTaskStatus {
  switch (s) {
    case "done":
    case "dropped":
      return "completed";
    case "in_progress":
      return "inProgress";
    case "snoozed":
      return "deferred";
    case "inbox":
      return "notStarted";
    default: {
      const _e: never = s;
      return _e;
    }
  }
}

export function stripTaskBody(
  body: { content?: string; contentType?: string } | null | undefined,
  max: number,
): string | null {
  const raw = body?.content;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const plain = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plain) return null;
  return plain.slice(0, max);
}

export function buildTodoSourcePreview(t: GraphTask) {
  const title = (t.title && t.title.trim()) || "(untitled)";
  return title.slice(0, 500);
}

/** Update the linked To Do task so it matches triage status (requires Tasks.ReadWrite). */
export async function patchGraphTodoToMatchTriage(
  client: Client,
  listId: string,
  taskId: string,
  triageStatus: TriageStatus,
): Promise<void> {
  const status = graphStatusString(triageStatus);
  await client.api(`/me/todo/lists/${listId}/tasks/${taskId}`).patch({ status });
}

const TASK_SELECT = [
  "id",
  "title",
  "status",
  "dueDateTime",
  "body",
  "webUrl",
  "lastModifiedDateTime",
].join(",");

/** Load tasks from one list (single page, up to `top`). */
export async function fetchTasksForList(
  client: Client,
  listId: string,
  top: number,
): Promise<GraphTask[]> {
  const res = (await client
    .api(`/me/todo/lists/${listId}/tasks`)
    .top(top)
    .select(TASK_SELECT)
    .get()) as { value?: GraphTask[] };
  return (res.value ?? []).filter((t) => t.id);
}
