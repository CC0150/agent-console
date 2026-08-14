import type { TaskArtifact } from "@agent-console/contracts";
import { Download, Eye, FileText, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ErrorBanner, toErrorMessage } from "../../components/ui/ErrorBanner";
import { Modal } from "../../components/ui/Modal";
import { api } from "../../lib/api";

interface ArtifactsPanelProps {
  taskId: string;
  artifacts: TaskArtifact[];
  isLoading: boolean;
}

export function ArtifactsPanel({
  taskId,
  artifacts,
  isLoading,
}: ArtifactsPanelProps) {
  const [preview, setPreview] = useState<TaskArtifact | null>(null);
  const [previewContent, setPreviewContent] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!preview) {
      setPreviewContent("");
      setPreviewError(null);
      return;
    }

    let cancelled = false;
    setPreviewLoading(true);
    setPreviewContent("");
    setPreviewError(null);
    api
      .getArtifactContent(taskId, preview.id)
      .then((content) => {
        if (!cancelled) {
          setPreviewContent(content);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPreviewError(toErrorMessage(error));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPreviewLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [taskId, preview]);

  return (
    <section className="panel min-w-0 overflow-hidden">
      <div className="panel-header">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-violet-500/25 bg-violet-500/10 text-violet-400">
            <FileText className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink-100">产出物</h2>
            <p className="eyebrow mt-0.5">文件 / 报告</p>
          </div>
        </div>
        <span className="rounded border border-ink-700/30 px-2 py-1 font-mono text-xs text-ink-300">
          {artifacts.length} 个
        </span>
      </div>

      {isLoading && artifacts.length === 0 ? (
        <div className="flex items-center justify-center gap-2 border-t border-dashed border-ink-700/30 px-4 py-8 text-sm text-ink-400">
          <Loader2 className="h-4 w-4 animate-spin text-signal-400" />
          加载中
        </div>
      ) : artifacts.length === 0 ? (
        <p className="border-t border-dashed border-ink-700/30 px-4 py-8 text-center text-sm text-ink-400">
          暂无产出物
        </p>
      ) : (
        <div className="divide-y divide-ink-700/25">
          {artifacts.map((artifact) => (
            <div
              key={artifact.id}
              data-artifact-item="true"
              className="flex items-center gap-3 px-4 py-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-ink-700/25 bg-ink-700/10 text-ink-300">
                <FileText className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink-100">
                  {artifact.name}
                </p>
                <p className="mt-0.5 font-mono text-xs text-ink-400">
                  {formatBytes(artifact.sizeBytes)} ·{" "}
                  {new Date(artifact.createdAt).toLocaleString("zh-CN")}
                </p>
              </div>
              {canPreview(artifact) ? (
                <button
                  type="button"
                  onClick={() => setPreview(artifact)}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-ink-700/30 bg-ink-700/10 px-2.5 text-xs font-medium text-ink-300 transition hover:border-violet-500/30 hover:text-violet-300"
                >
                  <Eye className="h-3.5 w-3.5" />
                  预览
                </button>
              ) : null}
              <a
                href={api.artifactDownloadUrl(taskId, artifact.id)}
                download
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-signal-500/25 bg-signal-500/10 px-2.5 text-xs font-medium text-signal-300 transition hover:bg-signal-500/20"
              >
                <Download className="h-3.5 w-3.5" />
                下载
              </a>
            </div>
          ))}
        </div>
      )}

      {preview ? (
        <Modal
          open
          onClose={() => setPreview(null)}
          title={preview.name}
          description={`${formatBytes(preview.sizeBytes)} · ${preview.mimeType}`}
          icon={
            <span className="flex h-4 w-4 items-center justify-center">
              <FileText className="h-4 w-4 text-violet-400" />
            </span>
          }
          footer={
            <a
              href={api.artifactDownloadUrl(taskId, preview.id)}
              download
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-signal-500/35 bg-signal-500/10 px-4 text-sm font-medium text-signal-300 transition hover:bg-signal-500/20"
            >
              <Download className="h-4 w-4" />
              下载
            </a>
          }
        >
          {previewLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-ink-400">
              <Loader2 className="h-4 w-4 animate-spin text-signal-400" />
              加载中
            </div>
          ) : previewError ? (
            <ErrorBanner message={previewError} />
          ) : (
            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-md border border-ink-700/25 bg-ink-950/70 p-4 font-mono text-sm leading-6 text-ink-200">
              {previewContent}
            </pre>
          )}
        </Modal>
      ) : null}
    </section>
  );
}

function canPreview(artifact: TaskArtifact): boolean {
  return (
    artifact.mimeType.startsWith("text/") ||
    artifact.mimeType.includes("json") ||
    artifact.mimeType.includes("markdown") ||
    artifact.mimeType.includes("yaml")
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
