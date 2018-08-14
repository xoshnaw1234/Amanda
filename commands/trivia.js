const games = {};
const letters = ["a", "b", "c", "d"];
const https = require("https");
const entities = require("entities");

function newGame() {
	return {
		running: true,
		answers: {},
		correctID: null,
		answer: null
	}
}

module.exports = function(passthrough) {
	const { Discord, client, utils, reloadEvent } = passthrough;

	function doQuestion(msg, authorName) {
		let id = msg.channel.id;
		if (!authorName) authorName = msg.author.username;
		if (games[id]) return msg.channel.send(`${authorName}, there's a game already in progress for this channel`);
		let game = newGame();
		games[id] = game;
		require("request")("https://opentdb.com/api.php?amount=1", function(err, res, body) {
			let data;
			try {
				data = JSON.parse(body);
			} catch (error) {
				const embed = new Discord.RichEmbed()
					.setDescription(`There was an error parsing the data returned by the api\n${error}`)
					.setColor(14164000)
				msg.channel.send({embed});
				return delete games[id];
			}
			if (data.response_code != 0) {
				msg.channel.send(`There was an error from the api`);
				return delete games[id];
			}
			let answer = data.results[0].correct_answer;
			game.answer = answer;
			let choices = data.results[0].incorrect_answers;
			choices.push(answer);
			let shuffled = choices.shuffle();
			let iOfA = shuffled.indexOf(answer);
			game.correctID = String.fromCharCode(iOfA+97);
			if (!game.correctID) {
				msg.channel.send(`Fuckery happened\n\nIndex of the answer: ${iOfA}\nShuffled Answer Array: ${shuffled}`);
				return delete games[id];
			}
			let [a1, a2, a3, a4] = shuffled;
			let color = 3447003;
			let reward = 10;
			let difficulty = undefined;
				switch(data.results[0].difficulty) {
					case "easy":
						color = 4249664;
						reward = 100;
						difficulty = "easy";
						break;
					case "medium":
						color = 12632064;
						reward = 250;
						difficulty = "medium";
						break;
					case "hard":
						color = 14164000;
						reward = 500;
						difficulty = "hard";
						break;
				}
				let str = `A: *${a1}*\nB: *${a2}*`;
				if (a3 && a4) str += `\nC: *${a3}*\nD: *${a4}*`;
				let guessembed = new Discord.RichEmbed()
					.setDescription(entities.decodeHTML(`**${data.results[0].category}** (${difficulty})\n${data.results[0].question}\n${str}`))
					.setColor(color)
				msg.channel.send(guessembed).then(msg => {
				let clocks = ["🕖", "🕗", "🕘", "🕙", "🕛"];
				clocks.forEach((c,i) => {
					setTimeout(() => {
						let correctUsersStr = "";
						msg.react(c);
						if (i == clocks.length-1) {
							if (game == undefined || game.running == false) return;
							correctUsersStr = `**Correct Answers:**\n`;
							let correct = Object.keys(game.answers).filter(k => game.correctID == game.answers[k]);
							if (correct.length == 0) {
								correctUsersStr = "Nobody got the answer right.";
							} else {
								if (correct.length > 6) {
									correct.forEach(async function(item, index, array) {
										correctUsersStr += `${client.users.get(item) ? client.users.get(item).username : item}, `;
										let row = await utils.sql.get(`SELECT * FROM money WHERE userID =?`, item);
										if (!row) {
											await utils.sql.all(`INSERT INTO money (userID, coins) VALUES (?, ?)`, [item, 5000]);
											row = await utils.sql.get(`SELECT * FROM money WHERE userID =?`, item);
										}
										await utils.sql.all(`UPDATE money SET coins =? WHERE userID =?`, [row.coins + reward, item]);
										let user = await client.users.get(item)
										user.send(`You recieved ${reward} coins for guessing correctly on trivia`).catch(() => msg.channel.send(`**${user.tag}**, please enable DMs so I can tell you your earnings`));
									})
								} else {
									correct.forEach(async function(item, index, array) {
										correctUsersStr += `${client.users.get(item) ? client.users.get(item).username : item}\n`;
										let row = await utils.sql.get(`SELECT * FROM money WHERE userID =?`, item);
										if (!row) {
											await utils.sql.all(`INSERT INTO money (userID, coins) VALUES (?, ?)`, [item, 5000]);
											row = await utils.sql.get(`SELECT * FROM money WHERE userID =?`, item);
										}
										await utils.sql.get(`UPDATE money SET coins =? WHERE userID =?`, [row.coins + reward, item]);
										let user = await client.users.get(item)
										user.send(`You recieved ${reward} coins for guessing correctly on trivia`).catch(() => msg.channel.send(`**${user.tag}**, please enable DMs so I can tell you your earnings`));
									})
								}
							}
							let resultembed = new Discord.RichEmbed()
								.setDescription(entities.decodeHTML(`**${game.correctID.toUpperCase()}:** ${game.answer}\n\n${correctUsersStr}`))
								.setColor(color)
								.setFooter(`Click the reaction for another round.`)
							msg.channel.send(resultembed).then(msg => {
								msg.reactionMenu([{ emoji: client.emojis.get("362741439211503616"), ignore: "total", actionType: "js", actionData: (msg, emoji, user) => { doQuestion(msg, user.username); }}]);
							});
							return delete games[id];
						}
					}, i*4000);
				});
			});
		});
	}

	client.on("message", messageHandler);
	function messageHandler(msg) {
		if (msg.author.bot) return;
		let id = msg.channel.id;
		let game = games[id];
		if (!game) return;
		if (letters.includes(msg.content.toLowerCase())) {
			game.answers[msg.author.id] = msg.content.toLowerCase();
		}
	}
	reloadEvent.once(__filename, () => {
		client.removeListener("message", messageHandler);
	});
	return {
		"trivia": {
			usage: "<play / categories>",
			description: "A game of trivia using OpenTDB or Open Trivia Data Base",
			aliases: ["trivia", "t"],
			category: "fun",
			process: function(msg, suffix) {
				if (suffix.toLowerCase() == "play" || suffix.toLowerCase() == "p") {
					doQuestion(msg);
				} else if (suffix.toLowerCase() == "categories") {
					https.get("https://opentdb.com/api_category.php", (res) => {
						res.on('data', function(data) {
							let json;
							try {
							json = JSON.parse(data.toString());
							} catch (error) {
								msg.channel.send(`An error occurred while attempting to query the trivia category list\n${error}`);
							}
							let categories = "**Categories:** ";
							let i = 0;
							for(i in json.trivia_categories) categories = categories + "\n" + json.trivia_categories[i].name;
							let str = "A list has been sent to you via DM.";
							if(msg.channel.type == 'dm') str = "";
							msg.author.send(categories).catch(function(err) {
								str = "Unable to send you the list because you cannot receive DMs.";
								if(err != "DiscordAPIError: Cannot send messages to this user") console.log(err);
							}).then(function() {
								i++;
								msg.channel.send("There are " + i + " categories. " + str);
							});
						});
					}).on('error', function(err) {
				msg.channel.send("Failed to query category list.");
					});
				} else {
					msg.channel.send(`${msg.author.username}, that's not a valid action to do`);
				}
			}
		}
	}
}