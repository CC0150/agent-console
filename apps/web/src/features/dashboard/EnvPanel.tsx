import { useQuery } from "@tanstack/react-query";
import { Database, Radio, ServerCog, Sparkles } from "lucide-react";
import { api } from "../../lib/api";

const baseRows = [
  {
    label: "数据存储",
    code: "存储",
    value: "PostgreSQL (Neon)",
    icon: Database,
    iconClass: "text-cyan-400",
  },
  {
    label: "实时通道",
    code: "实时通道",
    value: "SSE + Last-Event-ID",
    icon: Radio,
    iconClass: "text-mint-400",
  },
  {
    label: "执行引擎",
    code: "执行引擎",
    value: "事件溯源执行器",
    icon: ServerCog,
    iconClass: "text-ink-300",
  },
];

export function EnvPanel() {
  const runtimeQuery = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: 10_000,
  });
  const llm = runtimeQuery.data?.llm;
  const rows = [
    {
      label: "模型服务",
      code: "模型",
      value: llm?.provider === "openai" ? `OpenAI 兼容 · ${llm.model}` : "本地 Mock",
      icon: Sparkles,
      iconClass: "text-signal-400",
    },
    ...baseRows,
  ];

  return (
    <section className="panel overflow-hidden">
      <div className="panel-header">
        <div>
          <h2 className="text-sm font-semibold text-ink-100">运行环境</h2>
          <p className="eyebrow mt-0.5">运行时</p>
        </div>
      </div>
      <ul className="divide-y divide-ink-700/25">
        {rows.map((row) => (
          <li key={row.code} className="flex items-center gap-3 px-4 py-3.5">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-ink-700/25 bg-ink-700/10 ${row.iconClass}`}>
              <row.icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="eyebrow">{row.code}</p>
              <p className="mt-0.5 truncate text-sm font-medium text-ink-200">
                {row.value}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
