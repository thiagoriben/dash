import { HeaderSkeleton, KpiRowSkeleton, ChartSkeleton, TableSkeleton } from "@/components/skeletons"

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <HeaderSkeleton />
      <KpiRowSkeleton count={4} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartSkeleton className="lg:col-span-2" />
        <ChartSkeleton />
      </div>
      <TableSkeleton rows={5} />
    </div>
  )
}
