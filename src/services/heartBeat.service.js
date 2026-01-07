// services/Heartbeat.service.js
const GatewaySchema = require('../schema/Gateway.model')
const AngleNodeSchema = require('../schema/Angle.node.model')

function startHeartbeatJob({
	intervalMs = 5 * 60 * 1000,
	windowMs = 60 * 60 * 1000,
} = {}) {
	// intervalMs: necha daqiqada tekshiramiz (default 5 minut)
	// windowMs: "tirik" deb hisoblash oynasi (default 1 soat)

	const run = async () => {
		const cutoff = new Date(Date.now() - windowMs)

		// Gateway: 1 soat ichida kamida bitta node dan data bo‘lsa lastSeen gatewayga qo‘yilgan bo‘ladi → true bo‘lib qoladi.
		// endi lastSeen < cutoff bo‘lgan gateway larni false qilamiz, >= bo‘lsa true (ikkinchi query ixtiyoriy)
		await GatewaySchema.updateMany(
			{
				$or: [{ lastSeen: { $exists: false } }, { lastSeen: { $lt: cutoff } }],
			},
			{ $set: { gateway_alive: false } }
		)
		await GatewaySchema.updateMany(
			{ lastSeen: { $gte: cutoff } },
			{ $set: { gateway_alive: true } }
		)

		// Node lar uchun ham xuddi shu
		await AngleNodeSchema.updateMany(
			{
				$or: [{ lastSeen: { $exists: false } }, { lastSeen: { $lt: cutoff } }],
			},
			{ $set: { node_alive: false } }
		)
		await AngleNodeSchema.updateMany(
			{ lastSeen: { $gte: cutoff } },
			{ $set: { node_alive: true } }
		)

		// Agar xohlasangiz shu yerda “o‘zgarganlar”ni socket orqali admin dashboardga emit qilishingiz ham mumkin
	}

	// darhol bir marta yuritib oling, keyin intervalla
	run().catch(console.error)
	const timer = setInterval(() => run().catch(console.error), intervalMs)

	// Graceful shutdown
	const stop = () => clearInterval(timer)
	return { stop }
}

module.exports = { startHeartbeatJob }
