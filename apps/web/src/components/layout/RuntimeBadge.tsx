/**
 * 运行时状态徽标：定时轮询服务健康状态并展示在线 / 离线。
 */
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";

interface RuntimeBadgeProps {
  compact?: boolean;
}

export function RuntimeBadge({ compact = false }: RuntimeBadgeProps) {
  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
    // 每 10 秒轮询一次健康接口，避免状态长期失真
    refetchInterval: 10_000,
  });
  const online = healthQuery.isSuccess && healthQuery.data?.ok === true;

  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "w-full"}`}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          online ? "bg-mint-400 animate-pulse-dot" : "bg-rose-400"
        }`}
      />
      <span className="font-mono text-xs uppercase tracking-[0.08em] text-ink-400">
        {online ? "服务在线" : "服务离线"}
      </span>
    </div>
  );
}
