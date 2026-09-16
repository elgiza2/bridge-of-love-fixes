/**
 * @doc Full-page preview for files an agent produced.
 *
 * Tapping a file chip opens it on its own full-screen surface instead of a
 * small dialog: images, video, PDF and HTML render directly; Office documents
 * render through an embedded viewer. A download link stays available for
 * everything, and Escape / the back arrow returns to the conversation.
 */
import { useEffect } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { useUserLang } from "@/lib/authI18n";

export interface PreviewFile {
  url: string;
  name: string;
  type?: string | null;
}

const ext = (name: string, url: string) =>
  ((name.split("?")[0].split(".").pop() || url.split("?")[0].split(".").pop() || "") as string).toLowerCase();

export default function FilePreviewDialog({
  file,
  onClose,
}: {
  file: PreviewFile | null;
  onClose: () => void;
}) {
  const lang = useUserLang();
  const ar = lang === "ar-eg";

  // Escape closes the viewer, and the page behind it must not scroll while the
  // full-screen surface is open.
  useEffect(() => {
    if (!file) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [file, onClose]);

  if (!file) return null;
  const e = ext(file.name, file.url);
  const isImage = /^(png|jpe?g|webp|gif|avif|svg)$/.test(e) || !!file.type?.startsWith("image/");
  const isVideo = /^(mp4|webm|mov|m4v)$/.test(e) || !!file.type?.startsWith("video/");
  const isAudio = /^(mp3|wav|ogg|m4a)$/.test(e) || !!file.type?.startsWith("audio/");
  const isDirect = /^(pdf|html?|txt|md|csv|json)$/.test(e);
  const isOffice = /^(docx?|xlsx?|pptx?)$/.test(e);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background"
      dir={ar ? "rtl" : "ltr"}
      role="dialog"
      aria-modal="true"
      aria-label={file.name}
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-border/50 bg-secondary/30 px-3 py-2">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <ArrowLeft className={`h-4 w-4 ${ar ? "rotate-180" : ""}`} />
          {ar ? "رجوع" : "Back"}
        </button>
        <span className="min-w-0 flex-1 truncate text-center text-[13.5px] font-medium text-foreground">
          {file.name}
        </span>
        <a
          href={file.url}
          target="_blank"
          rel="noreferrer"
          download={file.name}
          className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">{ar ? "تحميل" : "Download"}</span>
        </a>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-muted/20">
        {isImage ? (
          <div className="flex h-full w-full items-center justify-center p-3">
            <img src={file.url} alt={file.name} className="max-h-full max-w-full object-contain" />
          </div>
        ) : isVideo ? (
          <div className="flex h-full w-full items-center justify-center p-3">
            <video src={file.url} controls className="max-h-full max-w-full" />
          </div>
        ) : isAudio ? (
          <div className="flex h-full items-center justify-center p-6">
            <audio src={file.url} controls className="w-full max-w-lg" />
          </div>
        ) : isDirect ? (
          <iframe
            src={file.url}
            title={file.name}
            className="h-full w-full border-0 bg-background"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        ) : isOffice ? (
          <iframe
            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file.url)}`}
            title={file.name}
            className="h-full w-full border-0 bg-background"
          />
        ) : (
          <div className="p-6 text-[13px] text-muted-foreground">
            {ar
              ? "مش قادر أعرض النوع ده جوه الموقع، حمّله من الزر فوق."
              : "This file type can't be previewed here — download it from the button above."}
          </div>
        )}
      </div>
    </div>
  );
}
