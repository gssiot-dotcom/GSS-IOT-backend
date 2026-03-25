class TTLCache {
	constructor({ ttlMs = 60_000, max = 5000 } = {}) {
		this.ttlMs = ttlMs
		this.max = max
		this.map = new Map()
	}

	get(key) {
		const v = this.map.get(key)
		if (!v) return null
		if (v.exp < Date.now()) {
			this.map.delete(key)
			return null
		}
		return v.val
	}

	set(key, val, ttlOverrideMs) {
		if (this.map.size >= this.max) {
			// oddiy eviction: birinchi key
			const firstKey = this.map.keys().next().value
			if (firstKey) this.map.delete(firstKey)
		}
		const exp = Date.now() + (ttlOverrideMs ?? this.ttlMs)
		this.map.set(key, { val, exp })
	}
}

module.exports = { TTLCache }
