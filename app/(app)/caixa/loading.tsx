import { HeaderSkeleton, KpiRowSkeleton, TableSkeleton } from "@/components/skeletons"

export default function CaixaLoading() {
  return (
    <div className="flex flex-col gap-6">
      <HeaderSkeleton />
      <KpiRowSkeleton count={3} />
      <TableSkeleton rows={8} />
    </div>
  )
}
