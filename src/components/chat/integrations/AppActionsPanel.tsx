/** @doc Actions of one connected app, shown inside the connector detail view
 *  using the shared clean tools list. Tapping an action drops a ready prompt
 *  into the composer.
 */
import { useEffect, useState } from "react";
import { Loader2, Mail, Search, Send, FileText } from "lucide-react";
import { toast } from "sonner";
import { listAppTools, type AppTool } from "@/lib/pipedream/client";
import ToolsList from "./ToolsList";

export default function AppActionsPanel({
  slug,
  appName,
  onUse,
}: {
  slug: string;
  appName: string;
  onUse?: () => void;
}) {
  const [tools, setTools] = useState<AppTool[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(null);
    listAppTools(slug)
      .then((res) => {
        if (alive) setTools(res.tools ?? []);
      })
      .catch((e: unknown) => {
        if (alive) setTools([]);
        const message = e instanceof Error ? e.message : "Actions could not be loaded";
        if (alive) setLoadError(message);
        toast.error(message);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-foreground/65">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (!tools || tools.length === 0) {
    if (slug !== "gmail" && appName.toLowerCase() !== "gmail") return null;
    const gmailQuickActions = [
      { key: "gmail_read", name: "Read recent emails", icon: Mail },
      { key: "gmail_search", name: "Search emails", icon: Search },
      { key: "gmail_send", name: "Send an email", icon: Send },
      { key: "gmail_draft", name: "Create a draft", icon: FileText },
    ];
    return (
      <section className="mt-6 rounded-[18px] border border-foreground/[0.07] bg-foreground/[0.025] p-3">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <div>
            <h4 className="text-[13px] font-semibold text-foreground">Gmail actions</h4>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-foreground/60">
              {loadError
                ? "The provider is still syncing. Try an action from chat."
                : "Choose an action to start it in chat."}
            </p>
          </div>
          {loadError ? (
            <span className="h-2 w-2 rounded-full bg-amber-500" title="Sync pending" />
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {gmailQuickActions.map(({ key, name, icon: Icon }) => (
            <button
              key={key}
              type="button"
              className="flex min-h-11 items-center gap-2 rounded-[12px] border border-foreground/[0.07] bg-background/60 px-2.5 text-start text-[12px] font-medium text-foreground transition-colors hover:bg-foreground/[0.06] active:scale-[0.98]"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("megsy:composer-insert", {
                    detail: { text: `Use Gmail → ${name}: ` },
                  }),
                );
                onUse?.();
              }}
            >
              <Icon className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.8} />
              <span>{name}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <ToolsList
      title="Tools"
      tools={tools.map((t) => ({ key: t.key, name: t.name, description: t.description }))}
      onPick={(tool) => {
        window.dispatchEvent(
          new CustomEvent("megsy:composer-insert", {
            detail: { text: `Use ${appName} → ${tool.name}: ` },
          }),
        );
        onUse?.();
      }}
    />
  );
}
