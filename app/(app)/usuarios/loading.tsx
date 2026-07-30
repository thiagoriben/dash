import { HeaderSkeleton, TableSkeleton } from "@/components/skeletons"

export default function UsuariosLoading() {
  return (
    <div className="flex flex-col gap-6">
      <HeaderSkeleton />
      <TableSkeleton rows={6} />
    </div>
  )
}
