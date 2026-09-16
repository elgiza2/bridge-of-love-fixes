import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getCachedUser } from "@/lib/cachedUser";
import { getActiveWorkspaceId } from "@/lib/activeWorkspace";
import { getUserLang } from "@/lib/authI18n";
import type { Location, NavigateFunction } from "react-router-dom";
import { MEGSY_MODEL } from "../chatConstants";
import type { Message } from "../chatConstants";

/**
 * Handles the three "entry-point" side effects fired once when ChatPage mounts:
 *   1. Sidebar navigation handoff (`location.state.loadConversationId`).
 *   2. Deep links (`?conv=…` and `?invite=…`).
 *   3. Seeding the welcome-demo conversation for brand-new users.
 *
 * Encapsulating this keeps the giant ChatPage focused on rendering & state and
 * makes the boot sequence easy to read.
 */
export function useChatEntryEffects(params: {
  conversationId: string | null;
  location: Location;
  navigate: NavigateFunction;
  loadConversation: (id: string) => void;
  setConversationId: (id: string) => void;
  setConversationTitle: (title: string) => void;
  setMessages: (messages: Message[]) => void;
}) {
  const {
    conversationId,
    location,
    navigate,
    loadConversation,
    setConversationId,
    setConversationTitle,
    setMessages,
  } = params;

  useEffect(() => {
    const stateCid = (location.state as any)?.loadConversationId as string | undefined;
    if (stateCid && stateCid !== conversationId) {
      loadConversation(stateCid);
      navigate(location.pathname, { replace: true, state: {} });
      return;
    }
    const params = new URLSearchParams(window.location.search);

    const convParam = params.get("conv");
    if (convParam && !conversationId) {
      // Keep `?conv=` in the URL so a reload restores the same conversation
      // and Back/Forward can move between them (see useChatUrlState).
      loadConversation(convParam);
      return;
    }

    const inviteToken = params.get("invite");
    if (inviteToken) {
      (async () => {
        const user = await getCachedUser();
        if (!user) {
          toast.error("Please sign in to accept invite");
          return;
        }
        const { data: invite } = await supabase
          .from("conversation_invites")
          .select("*")
          .eq("invite_token", inviteToken)
          .eq("status", "pending")
          .single();
        if (!invite) {
          toast.error("Invalid or expired invite");
          return;
        }
        await supabase.from("conversation_members").insert({
          conversation_id: (invite as any).conversation_id,
          user_id: user.id,
          role: "member",
        } as any);
        await supabase
          .from("conversation_invites")
          .update({ status: "accepted", accepted_by: user.id } as any)
          .eq("id", (invite as any).id);
        loadConversation((invite as any).conversation_id);
        window.history.replaceState({}, "", `/chat?conv=${(invite as any).conversation_id}`);
        toast.success("You joined the conversation!");
      })();
      return;
    }

    // Demo conversation on first visit — DB is source of truth (no localStorage)
    (async () => {
      const user = await getCachedUser();
      if (!user) return;
      const { count } = await supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (count && count > 0) return;

      // The very first thing a new user reads. Kept short, scannable and in the
      // user's own language, and it lists what Megsy actually ships today.
      const ar = getUserLang() === "ar-eg";
      const demoUserMsg = ar ? "أهلاً Megsy — تعرف تعمل إيه بالظبط؟" : "Hey Megsy — what can you actually do?";
      const demoAssistantMsg = ar
        ? `أهلاً بيك 👋 اعتبرني مساحة شغل كاملة، مش مجرد شات.

**بكتب وبفكر معاك** — أسئلة، تحليل، تلخيص، ترجمة، وشغل بالعربي المصري والإنجليزي وأكتر من ١٠٠ لغة.
**بحث عميق** — أدور على الموضوع فعليًا وأرجّعلك تقرير بمصادر حقيقية.
**صور وفيديو** — أعمل صور جديدة، أعدّل صورة عندك، وأطلع فيديوهات قصيرة.
**مستندات وعروض** — دوكيومنت أو بريزنتيشن جاهز من أول السطر.
**كود ومواقع** — أبني تطبيق أو موقع كامل وأشغّله.
**كمبيوتر Megsy** — متصفح حقيقي في السحابة بيدوس ويكتب ويملّي الفورمات بدالك.
**مهام في الخلفية** — تسيب المهمة الطويلة شغّالة وترجع تلاقي النتيجة.
**ملفاتك** — ارفع PDF أو Excel أو صورة واسألني عليها.
**ربط أدواتك** — Slack، Notion، Telegram، Shopify، Drive وغيرهم، أتحرّك جواهم مش بس أتكلم عنهم.

مش محتاج أي إعداد. قوللي بتشتغل على إيه ونبدأ.`
        : `Hey 👋 think of me as a workspace, not a chatbot.

**Writing & thinking** — questions, analysis, summaries, translation, in English, Egyptian Arabic and 100+ more languages.
**Deep research** — I actually go and read the web, then hand you a report with real sources.
**Images & video** — generate new images, edit ones you upload, and make short videos.
**Docs & slides** — a finished document or presentation from a single prompt.
**Code & websites** — build a real app or site and run it.
**Megsy Computer** — a real cloud browser that clicks, types and fills forms for you.
**Background tasks** — leave a long job running and come back to the result.
**Your files** — drop a PDF, spreadsheet or image and ask me about it.
**Your tools** — Slack, Notion, Telegram, Shopify, Drive and more: I act inside them, not just talk about them.

Nothing to set up. Tell me what you're working on and we'll go from there.`;

      const workspaceId = getActiveWorkspaceId();
      const welcomeTitle = ar ? "أهلاً بيك في Megsy AI" : "Welcome to Megsy AI";
      const { data: conv } = await supabase
        .from("conversations")
        .insert({
          title: welcomeTitle,
          mode: "chat",
          model: MEGSY_MODEL,
          user_id: user.id,
          ...(workspaceId ? { workspace_id: workspaceId } : {}),
        } as any)
        .select("id")
        .single();
      if (!conv) return;
      await supabase.from("messages").insert([
        { conversation_id: conv.id, role: "user", content: demoUserMsg },
        { conversation_id: conv.id, role: "assistant", content: demoAssistantMsg },
      ]);
      setConversationId(conv.id);
      setConversationTitle(welcomeTitle);
      setMessages([
        { role: "user", content: demoUserMsg },
        { role: "assistant", content: demoAssistantMsg },
      ]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
