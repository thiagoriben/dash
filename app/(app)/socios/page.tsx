import { redirect } from "next/navigation"
import {
  getCurrentProfile,
  getFriends,
  getMyJoinRequests,
  getIncomingProjectInvitations,
} from "@/lib/data"
import { AmigosClient } from "@/components/amigos-client"

export const metadata = { title: "Amigos | Dash" }

export default async function SociosPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")

  const [{ friends, incoming, outgoing }, joinRequests, projectInvites] = await Promise.all([
    getFriends(profile.id),
    getMyJoinRequests(profile.id),
    getIncomingProjectInvitations(profile.id),
  ])

  return (
    <AmigosClient
      friends={friends}
      incoming={incoming}
      outgoing={outgoing}
      joinRequests={joinRequests}
      projectInvites={projectInvites}
    />
  )
}
