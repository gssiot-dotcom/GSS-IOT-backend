const ClientSchema = require('./company.model')
const BuildingSchema = require('../building/building.model')

class CompanyService {
	constructor() {
		this.clientSchema = ClientSchema
		this.buildingSchema = BuildingSchema
	}

	async createClientData(data) {
		try {
			// Transactionni boshlash
			const session = await this.clientSchema.startSession()
			session.startTransaction()

			try {
				// Step 1: Client saving
				const client = new this.clientSchema(data)
				const result = await client.save({ session })

				// Step 2: Update `building_status` va `client_id`
				const updateResult = await this.buildingSchema.updateMany(
					{ _id: { $in: data.client_buildings } }, // 🛠 TO'G'RI FIELD NOMI!
					{ $set: { building_status: false, client_id: client._id } },
					{ session }
				)

				// Transactionni yakunlash
				await session.commitTransaction()
				session.endSession()

				return result
			} catch (innerError) {
				// Xatolik bo‘lsa, transactionni bekor qilish
				await session.abortTransaction()
				session.endSession()
				throw new Error(`Error on updating buildings: ${innerError.message}`)
			}
		} catch (error) {
			throw new Error(`Error on creating company: ${error.message}`)
		}
	}

	async getCompanies() {
		try {
			const result = await this.clientSchema.find()

			return result
		} catch (error) {
			throw new Error('Error on fetching companies')
		}
	}

	async getCompanyData(clientId) {
		try {
			const client = await this.clientSchema.findOne({ _id: clientId })
			const buildings = await this.buildingSchema
				.find({ client_id: clientId })
				.sort({ building_num: 1 })
			return { client, buildings }
		} catch (error) {
			throw new Error('Error on fetching company by id')
		}
	}

	async deleteCompanyData(clientId) {
		try {
			// 1. Clientni topish va uning ichidagi client_buildings array'ni olish
			const client = await this.clientSchema.findById(clientId)
			if (!client) {
				throw new Error('Client not found')
			}

			// 2. client_buildings ichidagi barcha buildingId larni olish
			const buildingIds = client.client_buildings

			// 3. Barcha buildinglarning statusini true ga o'zgartirish
			await this.buildingSchema.updateMany(
				{ _id: { $in: buildingIds } }, // buildingId lar bo‘yicha qidirish
				{ $set: { building_status: true } } // building_status ni true qilish
			)

			// 4. Clientni o‘chirish
			await this.clientSchema.findByIdAndDelete(clientId)

			return { message: 'Client o‘chirildi uning binolari yangilandi.' }
		} catch (error) {
			console.error(error)
			throw new Error('Error on deleting company by id')
		}
	}

	async uploadBuildingImageData(building_id, imageUrl) {
		const IMAGES_DIR = path.join(process.cwd(), 'static', 'images')
		try {
			// / 1) Avval mavjud hujjatni o‘qib, eski rasm nomini oling
			const existing = await this.buildingSchema
				.findById(building_id)
				.select('building_plan_img') // xohlasangiz "-_id" ham qo‘shishingiz mumkin
				.lean()

			if (!existing) throw new Error('There is no any building with this _id')

			const oldImage = existing.building_plan_img
			logger(`existing: ${oldImage}`)

			if (oldImage && oldImage !== imageUrl) {
				// Faqat fayl nomini ajratib olamiz (URL/yo‘l bo‘lsa ham)
				const oldBasename = path.basename(oldImage)
				const oldFilePath = path.join(IMAGES_DIR, oldBasename) // ✅ to‘g‘ri
				// Debug uchun foydali:
				logger(`cwd: ${process.cwd()}`)
				logger(`IMAGES_DIR: ${IMAGES_DIR}`)
				logger(`oldFilePath: ${oldFilePath}`)
				try {
					await fs.access(oldFilePath)
					await fs.unlink(oldFilePath)
					logger(`Old building plan image is deleted: ${oldFilePath}`)
				} catch (error) {
					// Fayl topilmasa (ENOENT) — e’tiborsiz, boshqa xatolarni log qilamiz
					if (error.code !== 'ENOENT') {
						logError(
							`Failed to delete old image ${oldFilePath}: ${error.message}`
						)
						// agar majburiy o‘chirish bo‘lsa, shu yerda throw qilsangiz ham bo‘ladi
					} else {
						logError(
							`Failed to delete old image ${oldFilePath}: ${error.message}`
						)
					}
				}
			}
			const building = await this.buildingSchema.findByIdAndUpdate(
				building_id,
				{ $set: { building_plan_img: imageUrl } },
				{ new: true } // yangilangan hujjat qaytadi
			)
			if (!building) throw new Error('There is no any building with this _id')
			return building
		} catch (error) {
			logError(`Error on uploading building image: ${error}`)
			throw error // `throw new Error(error)` emas, to‘g‘ridan
		}
	}

	// ====================================================================================
	//                          CLIENT-Boss type user related functons                   //
	// ====================================================================================

	async getBossClientsData(clientId) {
		try {
			const clients = await this.clientSchema.find({ boss_users: clientId })
			return clients
		} catch (error) {
			throw new Error('Error on fetching company by id')
		}
	}

	async getBossBuildingsData(clientId) {
		try {
			const client = await this.clientSchema.findOne({ boss_users: clientId })

			const buildings = await this.buildingSchema
				.find({
					client_id: clientId,
				})
				.sort({ building_num: 1 })
			return { client, buildings }
		} catch (error) {
			throw new Error('Error on fetching company by id')
		}
	}
}

module.exports = CompanyService
