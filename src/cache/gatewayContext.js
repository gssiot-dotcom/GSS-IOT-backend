const { TTLCache } = require('../utils/TTLCache')
const GatewaySchema = require('../modules/gateways/gateway.model')

async function findGatewayByLast4(last4) {
	if (!last4) return null
	return GatewaySchema.findOne({
		serial_number: { $regex: `${last4}$` },
	}).lean()
}

const gatewayCache = new TTLCache({ ttlMs: 120_000, max: 20000 }) // 2 minut cache

async function getGatewayContextByLast4(last4) {
	const cached = gatewayCache.get(last4)
	if (cached) return cached

	const gatewayDoc = await findGatewayByLast4(last4) // seniki
	if (!gatewayDoc) return null

	const ctx = {
		gateway_id: gatewayDoc._id,
		buildingId: gatewayDoc.building_id || null,
		gateway_type: gatewayDoc.gateway_type,
		gw_position: gatewayDoc.zone_name ? String(gatewayDoc.zone_name) : '',
	}

	gatewayCache.set(last4, ctx)
	return ctx
}

module.exports = { getGatewayContextByLast4 }
