import { Card, CardContent, Skeleton } from "@/components/ui"
import { HeaderSkeleton } from "@/components/skeletons"

export default function ConfigLoading() {
  return (
    <div className="flex flex-col gap-6">
      <HeaderSkeleton />
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-40" />
        </CardContent>
      </Card>
    </div>
  )
}
