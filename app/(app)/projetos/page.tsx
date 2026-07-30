import { redirect } from "next/navigation"
import { getCurrentProfile, getVisibleProjects } from "@/lib/data"
import { ProjectsClient } from "@/components/projects-client"

export default async function ProjetosPage() {
  const profile = await getCurrentProfile()
  if (!profile) redirect("/login")
  const projects = await getVisibleProjects(profile)

  return <ProjectsClient projects={projects} prefs={profile.prefs} />
}
