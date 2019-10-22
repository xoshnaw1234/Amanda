// @ts-check

const Discord = require("discord.js")
const path = require("path")

const passthrough = require("../passthrough")

const bots = [
	["405208699313848330", "&"],
	["160105994217586689", ">"]
]

const { client, reloader, commands } = passthrough

const utils = require("../modules/utilities.js")
reloader.useSync("./modules/utilities.js", utils)

const cadence = new utils.DMUser("176580265294954507")
const prompts = []

utils.addTemporaryListener(client, "message", path.basename(__filename), gifDetector)

/**
 * @param {Discord.Message} msg
 */
async function gifDetector(msg) {
	if (!msg.author.bot) { // command
		let botInfo
		for (const b of bots) if (msg.content.startsWith(b[1])) botInfo = b
		if (!botInfo) return
		const command = (msg.content.match(/\w+/) || [])[0]
		if (!["boop", "cuddle", "hug", "kiss", "nom", "pat", "poke", "slap"].includes(command)) return
		prompts.push({ msg, botInfo, command })
	} else { // response
		if (!prompts.length) return
		let i = 0, ok = false
		while (i < prompts.length && !ok) {
			if (prompts[i].botInfo[0] == msg.author.id) ok = true
			if (!ok) i++
		}
		if (!ok) return
		const { botInfo, command } = prompts.splice(i, 1)[0]
		if (!botInfo) return

		if (msg.author.id == botInfo[0] && msg.embeds && msg.embeds[0] && msg.embeds[0].type == "rich" && msg.embeds[0].image && msg.embeds[0].image.url) {
			const url = msg.embeds[0].image.url

			const existing = await utils.sql.get("SELECT * FROM GenderGifsV2 WHERE url = ?", url)
			if (existing) return // skip if already exists

			const blacklist = await utils.sql.get("SELECT url FROM GenderGifBlacklist WHERE url = ?", url)
			if (blacklist) return // skip if in blacklist

			const backlog = await utils.sql.all("SELECT url FROM GenderGifBacklog")
			if (backlog.some(r => r.url == url)) return // skip if already in backlog

			if (!backlog.length) cadence.send("New " + command + " GIF from " + msg.author.username + ":\n" + url)

			utils.sql.all("INSERT INTO GenderGifBacklog VALUES (NULL, ?, ?, ?)", [url, command, msg.author.username])
		}
	}
}

commands.assign({
	"storegif": {
		usage: "<`gif url`> <type> <gender> [gender] [...]",
		description: "Store a GIF in the database",
		aliases: ["storegif"],
		category: "admin",
		process: async function(msg, suffix) {
			const allowed = await utils.hasPermission(msg.author, "eval")
			if (!allowed) return msg.channel.send("not you")
			if (suffix == "") {
				const row = await utils.sql.get("SELECT * FROM GenderGifBacklog")
				if (row) return msg.channel.send(`First GIF in backlog: ${row.type} from ${row.author}:\n${row.url}`)
				else return msg.channel.send("Backlog empty!")
			}
			const url = suffix.split("`")[1]
			const words = suffix.split("`")[2].split(" ")
			const type = words[1]
			const characters = words.slice(2)
			const existing = await utils.sql.all("SELECT * FROM GenderGifsV2 INNER JOIN GenderGifCharacters ON GenderGifsV2.gifid = GenderGifCharacters.gifid WHERE url = ?", url)
			// eslint-disable-next-line no-async-promise-executor
			new Promise(async resolve => {
				if (existing.length) {
					// @ts-ignore
					const dmsg = await msg.channel.send("That GIF already exists with " + existing.sort((a, b) => (a - b)).map(e => "`" + e.gender + "`").join(", ") + ".")
					const menu = utils.reactionMenu(dmsg, [{ emoji: "🗑", ignore: "total", allowedUsers: [msg.author.id], actionType: "js", actionData: async () => {
						await utils.sql.all("DELETE FROM GenderGifsV2 WHERE gifid = ?", existing[0].gifid)
						await msg.channel.send("Deleted. Replacing...")
						resolve()
					} }])
					setTimeout(() => menu.destroy(true), 5 * 60 * 1000)
				} else if (type && type.length == 1) return msg.channel.send("Pretty sure you don't want to do that.")
				else resolve()
			}).then(async () => {
				if (characters.length) {
					await Promise.all([
						utils.sql.all("DELETE FROM GenderGifBacklog WHERE url = ?", url),
						// eslint-disable-next-line no-async-promise-executor
						new Promise(async resolve => {
							const connection = await utils.getConnection()
							await utils.sql.all("INSERT INTO GenderGifsV2 VALUES (NULL, ?, ?)", [url, type], connection)
							const gifid = (await utils.sql.get("SELECT last_insert_id() AS id", [], connection)).id
							await Promise.all(characters.map((c, i) => utils.sql.all("INSERT INTO GenderGifCharacters VALUES (NULL, ?, ?, ?)", [gifid, c, i])))
							connection.release()
							resolve()
						})
					])
				} else {
					await msg.channel.send("Note: deleting from backlog, not adding to storage.")
					await Promise.all([
						utils.sql.all("DELETE FROM GenderGifBacklog WHERE url = ?", url),
						utils.sql.all("INSERT INTO GenderGifBlacklist VALUES (NULL, ?)", url)
					])
				}
				const backlog = await utils.sql.all("SELECT * FROM GenderGifBacklog")
				if (!backlog.length) { // entire backlog dealt with
					await msg.channel.send("Done! Backlog empty.")
				} else { // more images in backlog, send the next
					await msg.channel.send(`Done! ${backlog.length} image${backlog.length == 1 ? "" : "s"} left.`)
					cadence.send(`New ${backlog[0].type} GIF from ${backlog[0].author}:\n${backlog[0].url}`)
				}
			})
		}
	}
})
