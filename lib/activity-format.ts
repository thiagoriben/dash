/** Helpers puros (sem dependência de servidor), seguros para Client Components. */

/** "há 3 min", "há 2 h", "há 5 dias" — relativo ao agora. */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return "agora mesmo"
  const min = Math.floor(sec / 60)
  if (min < 60) return `há ${min} min`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `há ${hour} h`
  const day = Math.floor(hour / 24)
  if (day < 30) return `há ${day} ${day === 1 ? "dia" : "dias"}`
  const month = Math.floor(day / 30)
  if (month < 12) return `há ${month} ${month === 1 ? "mês" : "meses"}`
  const year = Math.floor(month / 12)
  return `há ${year} ${year === 1 ? "ano" : "anos"}`
}

/** Rótulo curto em português para a ação registrada. */
export function actionLabel(action: string): string {
  switch (action) {
    case "create":
      return "criou"
    case "update":
      return "editou"
    case "delete":
      return "excluiu"
    default:
      return action
  }
}
