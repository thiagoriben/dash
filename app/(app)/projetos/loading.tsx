import { HeaderSkeleton, CardGridSkeleton } from "@/components/skeletons"

export default function ProjetosLoading() {
  return (
    <div className="flex flex-col gap-6">
      <HeaderSkeleton />
      <CardGridSkeleton count={6} />
    </div>
  )
}
