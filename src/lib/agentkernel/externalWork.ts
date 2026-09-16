/**
 * @doc External execution registry.
 *
 * Anything the agent hands to a real environment outside this tab (the cloud
 * computer / browser session) is registered here against its run. The kernel
 * refuses to mark a run complete while any registered external task is still
 * non-terminal, so "Megsy says done" can never disagree with "the computer is
 * still working".
 */
import { pollComputerTask, type ComputerTask } from "@/lib/computer/client";

const byRun = new Map<string, Set<string>>();

export function registerExternalTask(runId: string | null | undefined, taskId: string) {
  if (!runId || !taskId) return;
  const set = byRun.get(runId) ?? new Set<string>();
  set.add(taskId);
  byRun.set(runId, set);
}

export function forgetExternalTasks(runId: string) {
  byRun.delete(runId);
}

const isTerminal = (status: string | undefined) =>
  status === "done" || status === "failed" || status === "canceled" || status === "stopped";

/**
 * Returns the still-running external tasks for a run. Terminal ones are dropped
 * from the registry so a finished run stops polling them.
 */
export async function pendingExternalWork(
  runId: string,
): Promise<{ taskId: string; progress: string | null }[]> {
  const set = byRun.get(runId);
  if (!set?.size) return [];
  const pending: { taskId: string; progress: string | null }[] = [];
  for (const taskId of [...set]) {
    let task: ComputerTask | null = null;
    try {
      task = (await pollComputerTask(taskId)).task;
    } catch {
      // A transient poll failure is not proof of completion: keep it pending.
      pending.push({ taskId, progress: null });
      continue;
    }
    if (isTerminal(task?.status)) set.delete(taskId);
    else pending.push({ taskId, progress: task?.progress ?? null });
  }
  if (!set.size) byRun.delete(runId);
  return pending;
}

/** Blocks until the given external task reaches a terminal state (or the cap). */
export async function awaitExternalTask(
  taskId: string,
  opts: { timeoutMs?: number; intervalMs?: number; onProgress?: (p: string | null) => void } = {},
): Promise<ComputerTask | null> {
  const timeoutMs = opts.timeoutMs ?? 10 * 60_000;
  const intervalMs = opts.intervalMs ?? 3_000;
  const until = Date.now() + timeoutMs;
  let last: ComputerTask | null = null;
  let failures = 0;
  while (Date.now() < until) {
    try {
      last = (await pollComputerTask(taskId)).task;
      failures = 0;
      opts.onProgress?.(last?.progress ?? null);
      if (isTerminal(last?.status)) return last;
    } catch {
      if (++failures >= 5) return last;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return last;
}
