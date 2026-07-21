const FAVORITES_KEY = "race_calendar_favorites"

export function getFavoriteEventIds(): string[] {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function isEventFavorite(eventId: string): boolean {
  return getFavoriteEventIds().includes(eventId)
}

export function toggleFavorite(eventId: string): boolean {
  const favorites = getFavoriteEventIds()
  const index = favorites.indexOf(eventId)
  if (index > -1) {
    favorites.splice(index, 1)
  } else {
    favorites.push(eventId)
  }
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
  return index === -1
}

export function getFavoriteEvents<T extends { id: string }>(events: T[]): T[] {
  const favorites = getFavoriteEventIds()
  return events.filter((e) => favorites.includes(e.id))
}