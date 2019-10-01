//@ts-check

const mysql = require("mysql2/promise")
const crypto = require("crypto")
const util = require("util")

const passthrough = require("../passthrough")
const {db} = passthrough

let utils = {
	sql: {
		/**
		 * @param {string} string
		 * @param {string|number|symbol|Array<(string|number|symbol)>} [prepared]
		 * @param {mysql.PromisePool|mysql.PromisePoolConnection} [connection]
		 * @param {number} [attempts=2]
		 * @returns {Promise<Array<any>>}
		 */
		"all": function(string, prepared = undefined, connection = undefined, attempts = 2) {
			if (!connection) connection = db
			if (prepared !== undefined && typeof(prepared) != "object") prepared = [prepared]
			return new Promise((resolve, reject) => {
				if (Array.isArray(prepared) && prepared.includes(undefined)) return reject(new Error(`Prepared statement includes undefined\n	Query: ${string}\n	Prepared: ${util.inspect(prepared)}`))
				connection.execute(string, prepared).then(result => {
					let rows = result[0]
					resolve(rows)
				}).catch(err => {
					console.error(err)
					attempts--
					if (attempts) utils.sql.all(string, prepared, connection, attempts).then(resolve).catch(reject)
					else reject(err)
				})
			})
		},
		/**
		 * @param {string} string
		 * @param {string|number|symbol|Array<(string|number|symbol)>} [prepared]
		 * @param {mysql.PromisePool|mysql.PromisePoolConnection} [connection]
		 */
		"get": async function(string, prepared = undefined, connection = undefined) {
			return (await utils.sql.all(string, prepared, connection))[0]
		}
	},

	/**
	 * @returns {mysql.PromisePoolConnection}
	 */
	getConnection: function() {
		return db.getConnection()
	},

		/**
	 * Convert a browser cookie string into a map.
	 * @param {Object} req req, from HTTP.Server
	 * @returns {Map}
	 */
	getCookies: function(req) {
		let result = new Map()
		if (req.headers.cookie) {
			req.headers.cookie.split(/; */).forEach(pair => {
				let eqIndex = pair.indexOf("=")
				if (eqIndex > 0) {
					let key = pair.slice(0, eqIndex)
					let value = pair.slice(eqIndex+1)
					result.set(key, value)
				}
			})
		}
		return result
	},

	getSession: function(token) {
		if (token instanceof Map) token = token.get("token")
		if (token) return utils.sql.get("SELECT * FROM WebTokens WHERE token = ?", token).then(row => {
			if (row) return row
			else return null
		})
		else return Promise.resolve(null)
	},

	getURLEncoded: function(body) {
		try {
			return new URLSearchParams(body)
		} catch (e) {
			throw [400, {message: "Malformed URL encoded body"}]
		}
	},

	generateCSRF: function(loginToken = null) {
		let token = crypto.randomBytes(32).toString("hex")
		let expires = Date.now()+6*60*60*1000; // 6 hours
		utils.sql.all("INSERT INTO CSRFTokens (token, loginToken, expires) VALUES (?, ?, ?)", [token, loginToken, expires])
		return token
	},

	checkCSRF: async function(token, loginToken, consume) {
		let result = true
		let row = await utils.sql.get("SELECT * FROM CSRFTokens WHERE token = ?", token)
		// Token doesn't exist? Fail.
		if (!row) result = false
		// Expired? Fail.
		else if (row.expires < Date.now()) result = false
		// Checking against a loginToken, but row loginToken differs? Fail.
		else if (loginToken && row.loginToken != loginToken) result = false
		// Looking good.
		if (consume) await utils.sql.all("DELETE FROM CSRFTokens WHERE token = ?", token)
		return result
	}
}
module.exports = utils
