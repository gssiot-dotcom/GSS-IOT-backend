const mongoose = require('mongoose')

// 필요하면 enum 유지해도 되지만, 저장 실패 줄이려면 우선 enum 제거 권장
// const WEATHER_TYPES = ['Clear','Cloudy','Rain','Snow','Drizzle','Thunderstorm','Mist','Haze']

const WIND_DIR = [
  'N','NNE','NE','ENE','E','ESE','SE','SSE',
  'S','SSW','SW','WSW','W','WNW','NW','NNW'
]

// +9h 보정 함수 (입력이 없으면 지금 시각)
function add9h(dateLike) {
  const t = dateLike ? new Date(dateLike) : new Date()
  if (isNaN(t.getTime())) return new Date() // 안전장치
  return new Date(t.getTime() + 9 * 60 * 60 * 1000)
}

const weatherSchema = new mongoose.Schema(
  {
    building: { type: mongoose.Schema.Types.ObjectId, ref: 'Building', required: true, index: true },
    weather:  { type: String, required: true }, // ← enum 제거(실패 원인 차단)
    wind_direction: { type: String, enum: WIND_DIR },
    temperature: { type: Number },
    humidity:    { type: Number, min: 0, max: 100 },
    wind_speed:  { type: Number, min: 0 },

    // ✅ setter로 저장 직전 +9h 단 한 번만 보정
    timestamp: {
      type: Date,
      default: Date.now,
      set: (v) => add9h(v),
      index: true,
    },
  },
  { versionKey: false, timestamps: false }
)

weatherSchema.index({ building: 1, timestamp: -1 })

module.exports = mongoose.model('Weather', weatherSchema)
