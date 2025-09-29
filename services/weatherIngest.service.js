// services/weatherIngest.service.js
// 빌딩 주소 -> 지오코딩 -> 날씨 호출 -> Weather 저장
// 저장/실패/스킵 모두 콘솔 로그 출력

const axios = require('axios')
const Building = require('../schema/Building.model')
const Weather = require('../schema/Weather.model')
const { geocodeAddress } = require('./geocode.service')   // services/geocode.service.js
const { degToCompass } = require('../utils/wind')         // utils/wind.js

const OWM_KEY = process.env.OWM_API_KEY
const VERBOSE = (process.env.LOG_VERBOSE || 'false').toLowerCase() === 'true'

// ───────────────────────────────────────────────────────────────
// 내부: OpenWeatherMap 현재 날씨 조회(lat, lon)
// ───────────────────────────────────────────────────────────────
async function fetchWeatherByCoords(lat, lon) {
  const url = 'https://api.openweathermap.org/data/2.5/weather'
  const params = { lat, lon, appid: OWM_KEY, units: 'metric' } // ℃

  const { data } = await axios.get(url, { params })

  if (VERBOSE) {
    console.log('[weather][owm][raw]', {
      lat, lon,
      main: data.weather?.[0]?.main,
      temp: data.main?.temp,
      hum: data.main?.humidity,
      ws: data.wind?.speed,
      deg: data.wind?.deg,
    })
  }

  const weatherMain = data.weather?.[0]?.main || 'Clear'
  const windDeg = typeof data.wind?.deg === 'number' ? data.wind.deg : undefined

  return {
    weather: weatherMain,                 // Clear, Rain, ...
    wind_direction: degToCompass(windDeg),// N, NE, ...
    temperature: data.main?.temp,         // ℃
    humidity: data.main?.humidity,        // %
    wind_speed: data.wind?.speed,         // m/s
    timestamp: new Date(),                // 수집 시각(서버)
  }
}

// ───────────────────────────────────────────────────────────────
// 공개: 전체 빌딩 순회 수집
// ───────────────────────────────────────────────────────────────
exports.ingestAllBuildingsWeather = async () => {
  if (!OWM_KEY) {
    console.error('[weather][start] OWM_API_KEY(.env) 누락')
    throw new Error('OWM_API_KEY is required')
  }

  const startedAt = new Date()
  console.log('[weather][start]', { at: startedAt.toISOString() })

  // 주소가 있는 빌딩만
  const cursor = Building.find(
    { building_addr: { $ne: null, $exists: true, $type: 'string' } },
    { _id: 1, building_addr: 1, building_name: 1 }
  ).cursor()

  let ok = 0, fail = 0, skip = 0, total = 0

  for await (const b of cursor) {
    total++
    const bid = String(b._id)
    const addr = b.building_addr
    const name = b.building_name || ''

    // 1) 지오코딩
    let coord = null
    try {
      coord = await geocodeAddress(addr)
      if (!coord) {
        skip++
        console.warn('[weather][skip][geocode-null]', { building: bid, name, addr })
        continue
      }
      if (VERBOSE) {
        console.log('[weather][geocode]', { building: bid, name, lat: coord.lat, lon: coord.lon })
      }
    } catch (e) {
      fail++
      console.error('[weather][fail][geocode]', { building: bid, name, addr, msg: e.message })
      continue
    }

    // 2) 날씨 호출
    let w = null
    try {
      w = await fetchWeatherByCoords(coord.lat, coord.lon)
      if (VERBOSE) {
        console.log('[weather][mapped]', { building: bid, name, ...w })
      }
    } catch (e) {
      fail++
      console.error('[weather][fail][owm]', { building: bid, name, msg: e.message })
      continue
    }

    // 3) 저장
    try {
      const saved = await Weather.create({
        building: b._id,
        weather: w.weather,
        wind_direction: w.wind_direction,
        temperature: w.temperature,
        humidity: w.humidity,
        wind_speed: w.wind_speed,
        timestamp: w.timestamp,
      })

      ok++
      console.log('[weather][saved]', {
        building: bid,
        name,
        _id: String(saved._id),
        weather: saved.weather,
        temp: saved.temperature,
        hum: saved.humidity,
        ws: saved.wind_speed,
        ts: saved.timestamp?.toISOString?.() || saved.timestamp,
      })
    } catch (e) {
      fail++
      // 스키마 enum 불일치나 ValidationError 가능
      console.error('[weather][fail][save]', {
        building: bid,
        name,
        msg: e.message,
      })
      continue
    }

    // 무료/유료 API 쿼터 보호 (필요 시 조정/삭제)
    await sleep(VERBOSE ? 200 : 500)
  }

  const endedAt = new Date()
  const ms = endedAt - startedAt
  console.log('[weather][done]', {
    total, ok, fail, skip,
    took_ms: ms,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
  })

  return { total, ok, fail, skip, took_ms: ms }
}

// ───────────────────────────────────────────────────────────────
// 헬퍼
// ───────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
