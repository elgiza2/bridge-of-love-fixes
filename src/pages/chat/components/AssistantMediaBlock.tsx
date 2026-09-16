import { Suspense, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { runMediaPlan, regenerateScene } from "@/lib/mediaGeneration";
import { updateMessageMetadata } from "../services/conversationApi";
import { CREDITS_CHANGED_EVENT } from "@/hooks/useCredits";
import { MediaResultCard } from "../lazyComponents";
import type { Message } from "../chatConstants";

// React can remount transcript items during mobile layout changes. A ref only
// protects one mount, so keep an app-wide lock keyed by the persisted message.
const activeMediaGenerations = new Set<string>();

interface Props {
  msg: Message;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setInput: (v: string) => void;
  setIsLoading: (v: boolean) => void;
  setIsThinking: (v: boolean) => void;
}

export default function AssistantMediaBlock({ msg, setMessages, setInput, setIsLoading, setIsThinking }: Props) {
  const targetKey = msg.id ?? msg.clientId;
  const matches = useCallback(
    (mm: Message) =>
      targetKey ? mm.id === targetKey || mm.clientId === targetKey : mm === msg,
    [targetKey, msg],
  );

  const autoStartRef = useRef(false);
  const retryingRef = useRef<Set<number>>(new Set());

  const generationKey =
    msg.mediaPlan?.generationKey ||
    `${msg.mediaPlan?.mode}:${msg.mediaPlan?.summary}:${msg.mediaPlan?.scenes.map((scene) => scene.prompt).join("|")}`;

  const startGeneration = useCallback(async () => {
    if (activeMediaGenerations.has(generationKey)) return;
    activeMediaGenerations.add(generationKey);
    setIsLoading(true);
    setIsThinking(false);
    if (msg.id) {
      void updateMessageMetadata(msg.id, { mediaStatus: "running" });
    }
    setMessages((prev) =>
      prev.map((mm) =>
        matches(mm) ? { ...mm, mediaStatus: "running", mediaCurrentScene: 1 } : mm,
      ),
    );
    const liveResults = [...(msg.mediaResults ?? [])];
    try {
      await runMediaPlan({
        plan: msg.mediaPlan!,
        onSceneStart: (idx) => {
          setMessages((prev) =>
            prev.map((mm) =>
              matches(mm)
                ? {
                    ...mm,
                    mediaCurrentScene: idx,
                    mediaResults: (mm.mediaResults ?? []).map((r) =>
                      r.index === idx ? { ...r, status: "running" as const } : r,
                    ),
                  }
                : mm,
            ),
          );
        },
        onScenePartial: (idx, previewUrl, progress) => {
          setMessages((prev) =>
            prev.map((mm) =>
              matches(mm)
                ? {
                    ...mm,
                    mediaResults: (mm.mediaResults ?? []).map((r) =>
                      r.index === idx ? { ...r, previewUrl, progress } : r,
                    ),
                  }
                : mm,
            ),
          );
        },
        onSceneCountdown: (idx, endsAt) => {
          setMessages((prev) =>
            prev.map((mm) =>
              matches(mm)
                ? {
                    ...mm,
                    mediaResults: (mm.mediaResults ?? []).map((r) =>
                      r.index === idx ? { ...r, taskEndsAt: endsAt } : r,
                    ),
                  }
                : mm,
            ),
          );
        },
        onSceneDone: (res) => {
          const i = liveResults.findIndex((r) => r.index === res.index);
          if (i >= 0) liveResults[i] = res;
          else liveResults.push(res);
          setMessages((prev) =>
            prev.map((mm) =>
              matches(mm)
                ? {
                    ...mm,
                    mediaResults: (mm.mediaResults ?? []).map((r) =>
                      r.index === res.index ? res : r,
                    ),
                  }
                : mm,
            ),
          );
          if (msg.id) {
            void updateMessageMetadata(msg.id, { mediaResults: liveResults });
          }
        },
      });
      setMessages((prev) =>
        prev.map((mm) => (matches(mm) ? { ...mm, mediaStatus: "done" } : mm)),
      );
      if (msg.id) {
        void updateMessageMetadata(msg.id, {
          mediaStatus: "done",
          mediaResults: liveResults,
        });
      }
    } finally {
      activeMediaGenerations.delete(generationKey);
      setIsLoading(false);
      setIsThinking(false);
      // Generation spends credits server-side — refresh the header balance.
      window.dispatchEvent(new Event(CREDITS_CHANGED_EVENT));
    }
  }, [generationKey, msg.id, msg.mediaPlan, msg.mediaResults, matches, setMessages, setIsLoading, setIsThinking, targetKey]);

  // Auto-start generation immediately without any confirmation/plan step.
  useEffect(() => {
    if (autoStartRef.current) return;
    if (!msg.mediaPlan) return;
    const status = msg.mediaStatus ?? "awaiting";
    if (status !== "awaiting") return;
    autoStartRef.current = true;
    void startGeneration();
  }, [msg.mediaPlan, msg.mediaStatus, startGeneration]);

  /**
   * A video render is stored as `running` in the database. If the tab was
   * closed / reloaded mid-render nothing is polling it any more, so without
   * this the card spins forever and the composer stays stuck in "generating"
   * — the freeze that used to need a manual page reload. Surface it as a
   * stopped scene with the normal per-scene retry instead.
   */
  useEffect(() => {
    if (!msg.mediaPlan) return;
    if (msg.mediaStatus !== "running") return;
    if (activeMediaGenerations.has(generationKey)) return;
    setIsLoading(false);
    setIsThinking(false);
    const stalled = (msg.mediaResults ?? []).map((r) =>
      r.status === "running" || r.status === "pending"
        ? {
            ...r,
            status: "error" as const,
            progress: undefined,
            taskEndsAt: null,
            error: "Generation stopped when the page closed. Tap retry to run it again.",
          }
        : r,
    );
    setMessages((prev) =>
      prev.map((mm) =>
        matches(mm) ? { ...mm, mediaStatus: "cancelled", mediaResults: stalled } : mm,
      ),
    );
    if (msg.id) {
      void updateMessageMetadata(msg.id, { mediaStatus: "cancelled", mediaResults: stalled });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generationKey, msg.id, msg.mediaStatus]);

  // Leaving the page must not leave the composer locked in "generating".
  // The in-flight lock itself is kept so a remount never double-charges a
  // render that is still polling.
  useEffect(
    () => () => {
      setIsLoading(false);
      setIsThinking(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  if (!msg.mediaPlan) return null;

  return (
    <div className="px-3 md:px-12 space-y-2">
      <Suspense fallback={null}>
        {msg.mediaResults && msg.mediaResults.length > 0 && (
          <MediaResultCard
            hideDownload={!!(typeof msg.content === "string" && msg.content.trim())}
            results={msg.mediaResults}
            finalVideoUrl={msg.mediaFinalVideoUrl}
            mergeStatus={msg.mediaMergeStatus}
            mergeError={msg.mediaMergeError}
            onMergeVideos={async () => {
              const urls = (msg.mediaResults ?? [])
                .filter((r) => r.type === "video" && r.status === "done" && r.url)
                .map((r) => r.url!) as string[];
              if (urls.length < 2) {
                toast.error("Need at least 2 finished clips to merge");
                return;
              }
              setMessages((prev) =>
                prev.map((mm) =>
                  matches(mm)
                    ? { ...mm, mediaMergeStatus: "merging", mediaMergeError: undefined }
                    : mm,
                ),
              );
              try {
                const { mergeVideosInBrowser } = await import("@/lib/mergeVideosClient");
                const blob = await mergeVideosInBrowser(urls, () => {});
                const objectUrl = URL.createObjectURL(blob);
                setMessages((prev) =>
                  prev.map((mm) =>
                    matches(mm)
                      ? {
                          ...mm,
                          mediaMergeStatus: "done",
                          mediaFinalVideoUrl: objectUrl,
                        }
                      : mm,
                  ),
                );
                toast.success("Final video ready");
              } catch (e) {
                const m = e instanceof Error ? e.message : "Merge failed";
                setMessages((prev) =>
                  prev.map((mm) =>
                    matches(mm) ? { ...mm, mediaMergeStatus: "error", mediaMergeError: m } : mm,
                  ),
                );
                toast.error(m);
              }
            }}
            onRetry={async (idx) => {
              // Guard against double-click / rapid re-taps: only one retry per
              // scene may run at a time. Otherwise we submit duplicate paid
              // generations and race each other's setMessages updates.
              if (retryingRef.current.has(idx)) {
                toast.info("Already retrying this scene…");
                return;
              }
              retryingRef.current.add(idx);
              setMessages((prev) =>
                prev.map((mm) =>
                  matches(mm)
                    ? {
                        ...mm,
                        mediaResults: (mm.mediaResults ?? []).map((r) =>
                          r.index === idx
                            ? { ...r, status: "running" as const, error: undefined }
                            : r,
                        ),
                      }
                    : mm,
                ),
              );
              try {
              const res = await regenerateScene(
                msg.mediaPlan!,
                idx,
                (i, previewUrl, progress) => {
                  setMessages((prev) =>
                    prev.map((mm) =>
                      matches(mm)
                        ? {
                            ...mm,
                            mediaResults: (mm.mediaResults ?? []).map((r) =>
                              r.index === i ? { ...r, previewUrl, progress } : r,
                            ),
                          }
                        : mm,
                    ),
                  );
                },
                (i, endsAt) => {
                  setMessages((prev) =>
                    prev.map((mm) =>
                      matches(mm)
                        ? {
                            ...mm,
                            mediaResults: (mm.mediaResults ?? []).map((r) =>
                              r.index === i ? { ...r, taskEndsAt: endsAt } : r,
                            ),
                          }
                        : mm,
                    ),
                  );
                },
              );

              const merged = (msg.mediaResults ?? []).map((r) => (r.index === idx ? res : r));
              setMessages((prev) =>
                prev.map((mm) =>
                  matches(mm)
                    ? { ...mm, mediaResults: merged }
                    : mm,
                ),
              );
              if (msg.id) {
                void updateMessageMetadata(msg.id, { mediaResults: merged });
              }
              } finally {
                retryingRef.current.delete(idx);
              }
            }}
          />
        )}
      </Suspense>
      {/* Unused in direct mode, but referenced to keep setInput import used */}
      <span className="hidden" data-set-input={setInput ? "1" : "0"} />
    </div>
  );
}
