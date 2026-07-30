import { Skeleton } from "@/components/ui"
import { HeaderSkeleton, KpiRowSkeleton, ChartSkeleton } from "@/components/skeletons"

export default function ProjectDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <HeaderSkeleton />
      <KpiRowSkeleton count={4} />
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartSkeleton className="lg:col-span-2" />
        <ChartSkeleton />
      </div>
    </div>
  )
}
