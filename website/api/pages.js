//@ts-check

const ipctypes = require("../../modules/ipctypes")

const passthrough = require("../passthrough")
const {pugCache, snow, config, ipc} = passthrough

let utils = require("../modules/utilities.js");
//reloader.useSync("./modules/utilities.js", utils);

let validators = require("../modules/validator.js")()
//reloader.useSync("./modules/validator.js", validators)

module.exports = [
	{
		route: "/about", methods: ["GET"], code: async () => {
			await Promise.all(["320067006521147393", "176580265294954507", "405208699313848330"].map(userID =>
				snow.user.cache.fetch(userID, key => snow.user.getUser(key))
			))
			let page = pugCache.get("pug/about.pug")({users: snow.user.cache})
			return {
				statusCode: 200,
				contentType: "text/html",
				content: page
			}
		}
	},
	{
		route: "/dash", methods: ["GET"], code: async ({req}) => {
			let cookies = utils.getCookies(req)
			let session = await utils.getSession(cookies)

			if (session) {
				let user = await snow.user.cache.fetchUser(session.userID)
				let {guilds, npguilds} = await ipc.router.requestDashGuilds(session.userID, true)
				let displayNoSharedServers = guilds.length === 0 && npguilds.length === 0
				let csrfToken = utils.generateCSRF()
				let page = pugCache.get("pug/selectserver.pug")({user, npguilds, displayNoSharedServers, guilds, csrfToken})
				return {
					statusCode: 200,
					contentType: "text/html",
					content: page
				}
			} else {
				let csrfToken = utils.generateCSRF()
				let page = pugCache.get("pug/login.pug")({csrfToken})
				return {
					statusCode: 200,
					contentType: "text/html",
					content: page
				}
			}
		}
	},
	{
		route: "/dash", methods: ["POST"], code: ({req, body}) => {
			return new validators.FormValidator()
			.trust({req, body, config})
			.ensureParams(["token", "csrftoken"])
			.useCSRF(utils)
			.do({
				code: (_) => utils.sql.get("SELECT * FROM WebTokens WHERE token = ?", _.params.get("token"))
				,assign: "row"
				,expected: v => v !== undefined
				,errorValue: [400, "Invalid token"]
			})
			.go()
			.then(state => {
				let token = state.params.get("token")
				let expires = new Date(Date.now() + 1000*60*60*24*365).toUTCString()
				return {
					statusCode: 303,
					contentType: "text/html",
					content: "Logging in...",
					headers: {
						"Location": "/dash",
						"Set-Cookie": `token=${token}; path=/; expires=${expires}`
					}
				}
			})
			.catch(errorValue => {
				let csrfToken = utils.generateCSRF()
				let page = pugCache.get("pug/login.pug")({message: errorValue[1], csrfToken})
				return {
					statusCode: errorValue[0],
					contentType: "text/html",
					content: page
				}
			})
		}
	},
	{
		route: "/logout", methods: ["GET"], code: () => {
			return {
				statusCode: 303,
				contentType: "text/html",
				content: "Redirecting...",
				headers: {
					"Location": "/dash"
				}
			}
		}
	},
	{
		route: "/logout", methods: ["POST"], code: ({req, body}) => {
			return new validators.FormValidator()
			.trust({req, body, config})
			.ensureParams(["csrftoken"])
			.useCSRF(utils)
			.go()
			.then(() => {
				return {
					statusCode: 303,
					contentType: "text/html",
					content: "Logging out...",
					headers: {
						"Location": "/dash",
						"Set-Cookie": `token=; path=/; expires=${new Date(0).toUTCString()}`
					}
				}
			})
			.catch(errorValue => {
				return {
					statusCode: errorValue[0],
					contentType: "text/plain",
					content: errorValue[1]
				}
			})
		}
	},
	{
		route: "/server/(\\d+)", methods: ["GET"], code: async ({req, fill}) => {
			const cookies = utils.getCookies(req)
			const session = await utils.getSession(cookies)

			const guildID = fill[0]

			return new validators.Validator()
			.do({
				code: () => session == null
				,expected: false
			}).do({
				code: (_) => ipc.router.requestGuildForUser(session.userID, guildID)
				,assign: "guild"
				,expected: v => v != null
			})
			.go()
			.then(async state => {
				if (config.music_dash_enabled) {
					/** @type {ipctypes.FilteredGuild} */
					const guild = state.guild

					const page = pugCache.get("pug/server.pug")({guild, timestamp: Date.now()})
					return {
						statusCode: 200,
						contentType: "text/html",
						content: page
					}
				} else {
					const page = pugCache.get("pug/dash_disabled.pug")()
					return {
						statusCode: 200,
						contentType: "text/html",
						content: page
					}
				}
			})
			.catch(() => {
				const page = pugCache.get("pug/accessdenied.pug")({session})
				return {
					statusCode: 403,
					contentType: "text/html",
					content: page
				}
			})
		}
	}
]