import { NextRequest, NextResponse } from "next/server"

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast"

export interface DailyForecast {
  date: string
  tempMax: number
  tempMin: number
  precipitationSum: number
  precipitationProbability: number
  weatherCode: number
  sunrise: string
  sunset: string
}

export interface WeatherResponse {
  location: string
  latitude: number
  longitude: number
  timezone: string
  daily: DailyForecast[]
  source: string
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function isValidDate(dateStr: string): boolean {
  const d = new Date(dateStr)
  return !isNaN(d.getTime())
}

function isDateInRange(dateStr: string): { valid: boolean; message?: string } {
  const d = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000)
  
  if (diffDays < -7) {
    return { valid: false, message: "日期不能早于7天前" }
  }
  if (diffDays > 14) {
    return { valid: false, message: "天气预测只支持未来14天" }
  }
  return { valid: true }
}

async function fetchWithRetry(url: string, options: RequestInit = {}, retries: number = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) {
        if (res.status >= 500 && i < retries) {
          console.log(`Weather API ${url} returned ${res.status}, retrying...`)
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)))
          continue
        }
      }
      return res
    } catch (e) {
      if (i < retries) {
        console.log(`Weather API error for ${url}, retrying...`, e)
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)))
        continue
      }
      throw e
    }
  }
  throw new Error("Max retries exceeded")
}

async function fetchGeocode(city: string, country: string): Promise<{ lat: number; lon: number; name: string } | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=zh&format=json`
    const res = await fetchWithRetry(url, { next: { revalidate: 86400 } })
    if (!res.ok) return null
    const data = await res.json()
    if (!data.results || data.results.length === 0) return null
    const result = data.results[0]
    return {
      lat: result.latitude,
      lon: result.longitude,
      name: result.name,
    }
  } catch (err) {
    console.error("Geocode error:", err)
    return null
  }
}

const FALLBACK_COORDINATES: Record<string, { lat: number; lon: number }> = {
  london: { lat: 51.5074, lon: -0.1278 },
  paris: { lat: 48.8566, lon: 2.3522 },
  monaco: { lat: 43.7325, lon: 7.4213 },
  barcelona: { lat: 41.3874, lon: 2.1686 },
  silverstone: { lat: 52.0786, lon: -1.0169 },
  spa: { lat: 50.4372, lon: 5.9714 },
  hungaroring: { lat: 47.5789, lon: 19.2486 },
  zandvoort: { lat: 52.4688, lon: 4.5412 },
  monza: { lat: 45.6167, lon: 9.2833 },
  marina: { lat: 25.3176, lon: 55.5167 },
  baku: { lat: 40.3772, lon: 49.8510 },
  interlagos: { lat: -23.7036, lon: -46.6997 },
  melbourne: { lat: -37.8136, lon: 144.9631 },
  suzuka: { lat: 34.8317, lon: 136.5464 },
  bahrain: { lat: 26.0325, lon: 50.5106 },
  jeddah: { lat: 21.6319, lon: 39.1042 },
  miami: { lat: 25.9581, lon: -80.2389 },
  imola: { lat: 44.3439, lon: 11.7167 },
  portimao: { lat: 37.2303, lon: -8.6658 },
  canada: { lat: 45.5017, lon: -73.5673 },
  austin: { lat: 30.1328, lon: -97.6411 },
  mexico: { lat: 19.4326, lon: -99.1332 },
  brazil: { lat: -23.7036, lon: -46.6997 },
  lasvegas: { lat: 36.1147, lon: -115.1728 },
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const city = searchParams.get("city")
  const country = searchParams.get("country")
  const date = searchParams.get("date")
  const lat = searchParams.get("lat")
  const lon = searchParams.get("lon")

  if (!date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 })
  }

  if (!isValidDate(date)) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 })
  }

  const rangeCheck = isDateInRange(date)
  if (!rangeCheck.valid) {
    return NextResponse.json({ error: rangeCheck.message }, { status: 400 })
  }

  try {
    let coordinates: { lat: number; lon: number; name: string } | null = null

    if (lat && lon) {
      coordinates = { lat: parseFloat(lat), lon: parseFloat(lon), name: "" }
    } else if (city) {
      coordinates = await fetchGeocode(city, country || "")
      
      if (!coordinates) {
        const fallback = FALLBACK_COORDINATES[city.toLowerCase()]
        if (fallback) {
          coordinates = { ...fallback, name: city }
        }
      }
    }

    if (!coordinates) {
      return NextResponse.json({ error: "Could not find location" }, { status: 404 })
    }

    const startDate = addDays(date, -3)
    const endDate = addDays(date, 3)

    const params = new URLSearchParams({
      latitude: coordinates.lat.toString(),
      longitude: coordinates.lon.toString(),
      daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,weathercode",
      timezone: "auto",
      start_date: startDate,
      end_date: endDate,
    })

    const res = await fetchWithRetry(`${OPEN_METEO_BASE}?${params.toString()}`, { next: { revalidate: 3600 } })
    
    if (!res.ok) {
      console.error(`Open-Meteo API error: ${res.status}`)
      return NextResponse.json({ error: "Weather service unavailable" }, { status: 503 })
    }

    const data = await res.json()

    if (!data.daily || !data.daily.time || data.daily.time.length === 0) {
      return NextResponse.json({ error: "No weather data available" }, { status: 404 })
    }

    const daily: DailyForecast[] = []
    for (let i = 0; i < data.daily.time.length; i++) {
      daily.push({
        date: data.daily.time[i],
        tempMax: data.daily.temperature_2m_max[i],
        tempMin: data.daily.temperature_2m_min[i],
        precipitationSum: data.daily.precipitation_sum[i],
        precipitationProbability: data.daily.precipitation_probability_max[i],
        weatherCode: data.daily.weathercode[i] ?? 0,
        sunrise: data.daily.sunrise[i],
        sunset: data.daily.sunset[i],
      })
    }

    return NextResponse.json({
      location: coordinates.name || data.timezone || "Unknown",
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: data.timezone,
      daily,
      source: "Open-Meteo",
    })
  } catch (err) {
    console.error("Weather API error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}