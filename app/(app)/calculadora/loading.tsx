import { Card, CardContent, Skeleton } from "@/components/ui"
import { HeaderSkeleton } from "@/components/skeletons"

export default function CalculadoraLoading() {
  return (
    <div className="flex flex-col gap-6">
      <HeaderSkeleton />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="flex flex-col gap-4 p-5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex flex-col gap-4 p-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-6 w-32" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
