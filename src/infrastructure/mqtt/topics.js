const BASE = 'GSSIOT/01030369081'

const topics = {
	all: [`${BASE}/GATE_PUB/+`, `${BASE}/GATE_RES/+`, `${BASE}/GATE_ANG/+`],
	nodePrefix: `${BASE}/GATE_PUB/`,
	anglePrefix: `${BASE}/GATE_ANG/`,
	gwResPrefix: `${BASE}/GATE_RES/`,
}

module.exports = { topics }
