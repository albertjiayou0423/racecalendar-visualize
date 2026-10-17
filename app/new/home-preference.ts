export const HOME_PREFERENCE_KEY = "racecalendar-home-version"
export const HOME_INTRO_KEY = "racecalendar-new-home-intro"

export function readHomePreference(): "new" | "classic" | null {
  try {
    const value = localStorage.getItem(HOME_PREFERENCE_KEY)
    return value === "new" || value === "classic" ? value : null
  } catch { return null }
}

export function saveHomePreference(value: "new" | "classic") {
  try { localStorage.setItem(HOME_PREFERENCE_KEY, value) } catch { /* Navigation still works without storage. */ }
}
