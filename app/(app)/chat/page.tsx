import { redirect } from "next/navigation"
import { getCurrentProfile, getPartners, getDirectMessages } from "@/lib/data"
import { ChatClient } from "@/components/chat-client"

export const metadata = { title: "Chat | Dash" }

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string }>
}) {
  const me = await getCurrentProfile()
  if (!me) redirect("/login")

  const { u } = await searchParams
  const partners = await getPartners(me.id)

  // Sócio ativo: query param ou o primeiro da lista.
  const active = partners.find((p) => p.id === u) ?? partners[0] ?? null
  const initialMessages = active ? await getDirectMessages(me.id, active.id) : []

  return (
    <ChatClient
      meId={me.id}
      partners={partners}
      activeId={active?.id ?? null}
      initialMessages={initialMessages}
    />
  )
}
