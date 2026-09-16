import { useState } from "react";
import { useOperatorRun, stopOperatorRun } from "@/hooks/useOperatorRun";
import AgentStar, { AGENT_COLORS, type AgentKey } from "./AgentStar";
import { OperatorWorkspace } from "./OperatorWorkspace";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Message, MessageContent } from "@/components/prompt-kit/message";
import ChatMessage from "@/components/chat/ChatMessage";
import { ExternalLink, FileText, Image as ImageIcon, Square } from "lucide-react";

/**
 * Inline assistant-style card rendered INSIDE the chat message stream.
 * Looks like a normal assistant message — shows the active agent's star
 * + thinking status, plus "magical" inline buttons (preview / screenshots
 * / files) that open the full Operator workspace in a bottom sheet on tap.
 */
export function OperatorInlineBubble({
  runId,
  onDismiss,
}: {
  runId: string;
  onDismiss: () => void;
}) {
  const { run, artifacts, messages } = useOperatorRun(runId);
  const [open, setOpen] = useState(false);
  const [stepsOpen, setStepsOpen] = useState(false);

  if (!run) return null;
  const isRunning = run.status === "running" || run.status === "pending";
  const assistantReply = messages.find((m) => m.agent === "assistant")?.content;
  // Treat as a plain chat reply when the backend marked it chat OR a chat
  // response exists OR the only message is the assistant reply. This avoids the
  // duplicate "Megsy" header that appeared before run.mode synced to "chat".
  const isChat =
    run.mode === "chat" ||
    !!run.chat_response ||
    (!!assistantReply && run.current_phase !== "executing");

  // Chat mode → render assistant reply exactly as a normal assistant message.
  if (isChat) {
    const reply = run.chat_response || assistantReply || "";
    if (!reply) {
      return (
        <Message className="mb-6 relative">
          <MessageContent>
            <div className="prose-chat text-muted-foreground">…</div>
          </MessageContent>
        </Message>
      );
    }
    return (
      <Message className="mb-6 relative">
        <MessageContent>
          <ChatMessage role="assistant" content={reply} />
        </MessageContent>
      </Message>
    );
  }

  const phase = run.current_phase ?? "";
  const agentKey: AgentKey =
    phase === "ceo" || phase === "coo" || phase === "cto" || phase === "executor"
      ? (phase as AgentKey)
      : phase === "executing"
        ? "executor"
        : "assistant";
  const c = AGENT_COLORS[agentKey];

  const screenshots = artifacts.filter((a) => a.kind === "image" && a.url);
  const files = artifacts.filter((a) => a.kind !== "image");
  const hasPreview = !!run.published_url || !!run.project_id;
  const visibleMessages = messages.filter((m) => m.agent !== "system" && m.content?.trim());
  const latest = visibleMessages[visibleMessages.length - 1];
  const finalMessage = isRunning ? null : latest;
  const steps = isRunning ? visibleMessages : visibleMessages.slice(0, -1);
  const waitingExternal = run.current_phase === "waiting_external";

  return (
    <>
      <Message className="mb-6 relative">
        <MessageContent>
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground mb-2">
            <AgentStar agent={agentKey} size={16} active={isRunning} />
            <span className="font-semibold" style={{ color: c.color }}>
              {c.label}
            </span>
            {!isRunning && run.status === "done" && (
              <span className="opacity-70 text-emerald-600">Done</span>
            )}
            {run.status === "failed" && <span className="opacity-70 text-red-500">Failed</span>}
            {isRunning ? (
              <button
                onClick={() => stopOperatorRun(runId)}
                className="ms-auto p-1.5 rounded-lg text-muted-foreground hover:text-foreground liquid-glass-hover transition-all"
                aria-label="Stop"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>

          {/* Execution events are NOT conversation. While the run is live only
              the current status shows; earlier steps stay in a collapsed list.
              The final report is the only thing rendered as a real reply. */}
          {visibleMessages.length > 0 ? (
            <div className="space-y-2">
              {isRunning ? (
                <div className="text-[13px] text-muted-foreground line-clamp-2">
                  {waitingExternal
                    ? "Waiting for the computer to finish…"
                    : latest?.content || "Working…"}
                </div>
              ) : (
                finalMessage && <ChatMessage role="assistant" content={finalMessage.content} />
              )}

              {steps.length > 0 && (
                <div>
                  <button
                    onClick={() => setStepsOpen((v) => !v)}
                    className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {stepsOpen ? "Hide steps" : `Steps (${steps.length})`}
                  </button>
                  {stepsOpen && (
                    <div className="mt-2 space-y-2 border-s border-border/60 ps-3">
                      {steps.map((m) => {
                        const key =
                          (m.agent as AgentKey) in AGENT_COLORS
                            ? (m.agent as AgentKey)
                            : "assistant";
                        const ac = AGENT_COLORS[key];
                        return (
                          <div key={m.id} className="text-[12px] text-muted-foreground">
                            <span className="font-semibold" style={{ color: ac.color }}>
                              {ac.label}
                            </span>
                            <span className="mx-1">·</span>
                            <span className="whitespace-pre-wrap">{m.content}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="prose-chat text-foreground whitespace-pre-wrap">{run.goal}</div>
          )}

          {(hasPreview || screenshots.length > 0 || files.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {hasPreview && (
                <button
                  onClick={() => setOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-600 hover:bg-sky-500/20 text-[11px] transition-colors"
                >
                  <ExternalLink className="w-3 h-3" /> Preview
                </button>
              )}
              {screenshots.length > 0 && (
                <button
                  onClick={() => setOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 text-[11px] transition-colors"
                >
                  <ImageIcon className="w-3 h-3" /> {screenshots.length} Images
                </button>
              )}
              {files.length > 0 && (
                <button
                  onClick={() => setOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 text-[11px] transition-colors"
                >
                  <FileText className="w-3 h-3" /> {files.length} Files
                </button>
              )}
              <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/60 hover:bg-muted text-[11px] text-muted-foreground transition-colors"
              >
                Log
              </button>
            </div>
          )}
        </MessageContent>
      </Message>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="h-[88vh] p-0 overflow-hidden">
          <div className="h-full overflow-auto">
            <OperatorWorkspace runId={runId} onClose={() => setOpen(false)} inline />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
