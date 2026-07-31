import { redirect } from "next/navigation"
import { getCurrentProfile, getFeedback } from "@/lib/data"
import { Card, CardContent } from "@/components/ui"
import { FeedbackAdminList } from "@/components/feedback-admin-list"

export default async function AdminFeedbackPage() {
  const profile = await getCurrentProfile()
  if (!profile || profile.role !== "admin") redirect("/")

  const feedback = await getFeedback()

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Feedback</h1>
        <p className="text-sm text-muted">Bugs e sugestões enviados pelos usuários.</p>
      </header>

      {feedback.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted">Nenhum feedback ainda.</CardContent>
        </Card>
      ) : (
        <FeedbackAdminList items={feedback} />
      )}
    </div>
  )
}
