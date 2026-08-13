import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApprovalDecision } from "@agent-console/contracts";
import { Check, Loader2, ShieldAlert, X } from "lucide-react";
import { api } from "../../lib/api";
import { ErrorBanner, toErrorMessage } from "../../components/ui/ErrorBanner";

interface ApprovalPanelProps {
  taskId: string;
}

export function ApprovalPanel({ taskId }: ApprovalPanelProps) {
  const queryClient = useQueryClient();
  const approvalsQuery = useQuery({
    queryKey: ["approvals", taskId],
    queryFn: () => api.getPendingApprovals(taskId),
    refetchInterval: 2_000,
    enabled: Boolean(taskId),
  });
  const resolveMutation = useMutation({
    mutationFn: ({
      approvalId,
      decision,
    }: {
      approvalId: string;
      decision: ApprovalDecision;
    }) => api.resolveApproval(taskId, approvalId, decision),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals", taskId] });
      queryClient.invalidateQueries({ queryKey: ["events", taskId] });
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    },
  });

  const approvals = approvalsQuery.data?.approvals ?? [];
  if (approvals.length === 0) {
    return null;
  }

  return (
    <section className="reveal reveal-delay-1 overflow-hidden rounded-md border border-amber-500/30 bg-amber-500/[0.05]">
      <div className="flex items-center gap-2.5 border-b border-amber-500/20 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-400">
          <ShieldAlert className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-ink-100">等待人工审批</h2>
          <p className="eyebrow mt-0.5">工具调用需要确认后执行</p>
        </div>
        <span className="ml-auto rounded border border-amber-500/30 px-2 py-1 font-mono text-xs text-amber-300">
          {approvals.length} 项待处理
        </span>
      </div>

      {resolveMutation.error ? (
        <ErrorBanner
          className="m-4"
          message={`审批操作失败：${toErrorMessage(resolveMutation.error)}`}
        />
      ) : null}

      <ul className="divide-y divide-ink-700/25">
        {approvals.map((approval) => (
          <li key={approval.id} className="space-y-3 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-sm font-semibold text-ink-100">
                  {approval.toolName}
                </p>
                <p className="mt-1 text-sm leading-6 text-ink-400">
                  {approval.reason}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  disabled={resolveMutation.isPending}
                  onClick={() =>
                    resolveMutation.mutate({ approvalId: approval.id, decision: "approve" })
                  }
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-mint-500/35 bg-mint-500/10 px-3 text-sm font-medium text-mint-300 transition hover:bg-mint-500/20 disabled:opacity-45"
                >
                  {resolveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  允许执行
                </button>
                <button
                  type="button"
                  disabled={resolveMutation.isPending}
                  onClick={() =>
                    resolveMutation.mutate({ approvalId: approval.id, decision: "reject" })
                  }
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 text-sm font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-45"
                >
                  <X className="h-4 w-4" />
                  拒绝
                </button>
              </div>
            </div>
            <pre className="max-w-full overflow-x-auto whitespace-pre-wrap rounded-md border border-ink-700/30 bg-ink-950/70 p-3 font-mono text-sm leading-6 text-ink-200">
              {JSON.stringify(approval.input, null, 2)}
            </pre>
          </li>
        ))}
      </ul>
    </section>
  );
}
