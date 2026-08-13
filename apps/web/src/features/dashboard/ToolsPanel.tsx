import { useQuery } from "@tanstack/react-query";
import { Boxes, Wrench } from "lucide-react";
import { api } from "../../lib/api";

export function ToolsPanel() {
  const toolsQuery = useQuery({
    queryKey: ["tools"],
    queryFn: api.listTools,
  });
  const tools = toolsQuery.data?.tools ?? [];

  return (
    <section className="panel overflow-hidden">
      <div className="panel-header">
        <div className="flex items-center gap-2.5">
          <Boxes className="h-4 w-4 text-signal-400" />
          <h2 className="text-sm font-semibold text-ink-100">已接入工具</h2>
        </div>
        <span className="rounded border border-mint-500/20 bg-mint-500/10 px-2 py-1 font-mono text-xs text-mint-300">
          {toolsQuery.isLoading ? "…" : `${tools.length} 个在线`}
        </span>
      </div>

      {toolsQuery.isLoading ? (
        <div className="space-y-3 p-5">
          {[0, 1].map((index) => (
            <div key={index} className="skeleton h-12 rounded-md" />
          ))}
        </div>
      ) : (
        <ul className="divide-y divide-ink-700/25">
          {tools.map((tool) => (
            <li key={tool.name} className="flex items-start gap-3 px-4 py-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-ink-700/25 bg-ink-700/10 text-ink-300">
                <Wrench className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-mono text-xs font-semibold text-ink-100">
                    {tool.name}
                  </p>
                  <span className="rounded-full border border-mint-500/20 bg-mint-500/10 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.06em] text-mint-300">
                    就绪
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-ink-400">{tool.description}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
