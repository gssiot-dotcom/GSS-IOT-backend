// utils/ConcurrencyQueue.js
class ConcurrencyQueue {
	constructor({ concurrency = 20, maxQueue = 5000, onDrop } = {}) {
		this.concurrency = concurrency
		this.maxQueue = maxQueue
		this.onDrop = onDrop || (() => {})
		this.running = 0
		this.queue = []
	}

	add(taskFn, meta) {
		if (this.queue.length >= this.maxQueue) {
			this.onDrop(meta)
			return false
		}
		this.queue.push({ taskFn, meta })
		this._drain()
		return true
	}

	_drain() {
		while (this.running < this.concurrency && this.queue.length) {
			const { taskFn, meta } = this.queue.shift()
			this.running++
			Promise.resolve()
				.then(taskFn)
				.catch(() => {}) // error'ni ichkarida log qilamiz
				.finally(() => {
					this.running--
					this._drain()
				})
		}
	}

	size() {
		return this.queue.length
	}
}

const rtQueue = new ConcurrencyQueue({
	concurrency: 80, // realtime emit tez bo‘lsin
	maxQueue: 20000,
	onDrop: meta => console.error('[rtQueue] DROP', meta),
})

const persistQueue = new ConcurrencyQueue({
	concurrency: 10, // DB / history / alert og‘ir ishlar
	maxQueue: 20000,
	onDrop: meta => console.error('[persistQueue] DROP', meta),
})

module.exports = { ConcurrencyQueue, rtQueue, persistQueue }
