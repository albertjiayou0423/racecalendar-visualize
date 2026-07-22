import { NextRequest, NextResponse } from "next/server"

const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast"

export interface HourlyForecast {
  time: string
  temperature: number
  precipitation: number
  precipitationProbability: number
  weatherCode: number
  windSpeed: number
  humidity: number
  visibility: number
}

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

export interface WeatherAlert {
  level: "info" | "warning" | "severe"
  type: "rain" | "storm" | "snow" | "wind" | "extreme_temp" | "fog"
  title: string
  description: string
  hour?: string
}

export interface WeatherResponse {
  location: string
  latitude: number
  longitude: number
  timezone: string
  hourly: HourlyForecast[]
  daily: DailyForecast[]
  current?: {
    temperature: number
    weatherCode: number
    windSpeed: number
    humidity: number
  }
  alerts: WeatherAlert[]
  source: string
}

const WEATHER_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: "晴朗", icon: "☀️" },
  1: { label: "晴", icon: "🌤️" },
  2: { label: "多云", icon: "⛅" },
  3: { label: "阴", icon: "☁️" },
  45: { label: "雾", icon: "🌫️" },
  48: { label: "雾凇", icon: "❄️" },
  51: { label: "毛毛雨", icon: "🌧️" },
  53: { label: "小雨", icon: "🌧️" },
  55: { label: "中雨", icon: "🌧️" },
  61: { label: "阵雨", icon: "🌧️" },
  63: { label: "中阵雨", icon: "🌧️" },
  65: { label: "大阵雨", icon: "⛈️" },
  71: { label: "小雪", icon: "❄️" },
  73: { label: "中雪", icon: "❄️" },
  75: { label: "大雪", icon: "❄️" },
  77: { label: "雪粒", icon: "❄️" },
  80: { label: "阵雨", icon: "🌦️" },
  81: { label: "强阵雨", icon: "🌧️" },
  82: { label: "猛烈阵雨", icon: "⛈️" },
  85: { label: "阵雪", icon: "🌨️" },
  86: { label: "强阵雪", icon: "❄️" },
  95: { label: "雷暴", icon: "⛈️" },
  96: { label: "雷暴伴冰雹", icon: "⛈️" },
  99: { label: "强雷暴伴冰雹", icon: "⛈️" },
}

export function getWeatherInfo(code: number): { label: string; icon: string } {
  return WEATHER_CODES[code] || { label: "未知", icon: "❓" }
}

async function fetchGeocode(city: string, country: string): Promise<{ lat: number; lon: number; name: string } | null> {
  try {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=zh&format=json`
    const res = await fetch(url, { next: { revalidate: 86400 } })
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

function generateAlerts(hourly: HourlyForecast[]): WeatherAlert[] {
  const alerts: WeatherAlert[] = []

  for (const hour of hourly) {
    // 暴雨预警
    if (hour.precipitationProbability >= 70 && hour.precipitation >= 2) {
      alerts.push({
        level: hour.precipitation >= 5 ? "severe" : "warning",
        type: "rain",
        title: hour.precipitation >= 5 ? "暴雨预警" : "降雨预警",
        description: `预计 ${hour.time.slice(11, 16)} 降水量 ${hour.precipitation}mm，降水概率 ${hour.precipitationProbability}%`,
        hour: hour.time,
      })
    }

    // 雷暴预警
    if (hour.weatherCode >= 95) {
      alerts.push({
        level: hour.weatherCode >= 99 ? "severe" : "warning",
        type: "storm",
        title: "雷暴预警",
        description: `预计 ${hour.time.slice(11, 16)} 有雷暴天气，可能影响比赛`,
        hour: hour.time,
      })
    }

    // 强风预警
    if (hour.windSpeed >= 30) {
      alerts.push({
        level: hour.windSpeed >= 50 ? "severe" : "warning",
        type: "wind",
        title: "强风预警",
        description: `预计 ${hour.time.slice(11, 16)} 风速 ${hour.windSpeed}km/h`,
        hour: hour.time,
      })
    }

    // 极端温度
    if (hour.temperature >= 35 || hour.temperature <= 0) {
      alerts.push({
        level: hour.temperature >= 40 || hour.temperature <= -10 ? "severe" : "warning",
        type: "extreme_temp",
        title: hour.temperature >= 35 ? "高温预警" : "低温预警",
        description: `预计 ${hour.time.slice(11, 16)} 温度 ${hour.temperature}°C`,
        hour: hour.time,
      })
    }

    // 降雪
    if (hour.weatherCode >= 71 && hour.weatherCode <= 77) {
      alerts.push({
        level: hour.weatherCode >= 75 ? "severe" : "warning",
        type: "snow",
        title: "降雪预警",
        description: `预计 ${hour.time.slice(11, 16)} 有降雪天气`,
        hour: hour.time,
      })
    }

    // 大雾
    if (hour.weatherCode === 45 || hour.weatherCode === 48) {
      alerts.push({
        level: "warning",
        type: "fog",
        title: "大雾预警",
        description: `预计 ${hour.time.slice(11, 16)} 有大雾，能见度较低`,
        hour: hour.time,
      })
    }
  }

  // 合并同一类型相邻时段的预警，避免过多重复
  const merged: WeatherAlert[] = []
  for (const alert of alerts) {
    const last = merged[merged.length - 1]
    if (last && last.type === alert.type && last.level === alert.level) {
      const lastHour = last.hour ? parseInt(last.hour.slice(11, 13)) : -1
      const thisHour = alert.hour ? parseInt(alert.hour.slice(11, 13)) : -1
      if (thisHour === lastHour + 1) {
        continue
      }
    }
    merged.push(alert)
  }

  return merged.slice(0, 5)
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

async function fetchWeather(lat: number, lon: number, date: string): Promise<WeatherResponse | null> {
  try {
    const startDate = addDays(date, -3)
    const endDate = addDays(date, 3)

    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lon.toString(),
      hourly: "temperature_2m,precipitation_probability,precipitation,weathercode,wind_speed_10m,relative_humidity_2m,visibility",
      daily: "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,weathercode",
      current_weather: "true",
      timezone: "auto",
      start_date: startDate,
      end_date: endDate,
    })

    const res = await fetch(`${OPEN_METEO_BASE}?${params.toString()}`, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const data = await res.json()

    const hourly: HourlyForecast[] = []
    if (data.hourly) {
      for (let i = 0; i < data.hourly.time.length; i++) {
        hourly.push({
          time: data.hourly.time[i],
          temperature: data.hourly.temperature_2m[i],
          precipitation: data.hourly.precipitation[i],
          precipitationProbability: data.hourly.precipitation_probability[i],
          weatherCode: data.hourly.weathercode[i],
          windSpeed: data.hourly.wind_speed_10m[i],
          humidity: data.hourly.relative_humidity_2m[i],
          visibility: data.hourly.visibility[i] ?? 0,
        })
      }
    }

    const daily: DailyForecast[] = []
    if (data.daily) {
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
    }

    const alerts = generateAlerts(hourly)

    return {
      location: data.timezone || "Unknown",
      latitude: data.latitude,
      longitude: data.longitude,
      timezone: data.timezone,
      hourly,
      daily,
      current: data.current_weather
        ? {
            temperature: data.current_weather.temperature,
            weatherCode: data.current_weather.weathercode,
            windSpeed: data.current_weather.windspeed,
            humidity: 0,
          }
        : undefined,
      alerts,
      source: "Open-Meteo",
    }
  } catch (err) {
    console.error("Weather fetch error:", err)
    return null
  }
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

  try {
    let coordinates: { lat: number; lon: number; name: string } | null = null

    if (lat && lon) {
      coordinates = { lat: parseFloat(lat), lon: parseFloat(lon), name: "" }
    } else if (city) {
      coordinates = await fetchGeocode(city, country || "")
    }

    if (!coordinates) {
      return NextResponse.json({ error: "Could not find location" }, { status: 404 })
    }

    const weather = await fetchWeather(coordinates.lat, coordinates.lon, date)

    if (!weather) {
      return NextResponse.json({ error: "Failed to fetch weather" }, { status: 500 })
    }

    return NextResponse.json(weather)
  } catch (err) {
    console.error("Weather API error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
