/**
 * 骨架屏单元：配合全局 .skeleton 动效，用于数据加载占位。
 */
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div aria-hidden="true" className={`skeleton ${className}`.trim()} />;
}
