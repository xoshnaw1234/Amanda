var exports = module.exports = {};

/**
 * Converts seconds or miliseconds to a time string
 * @param {Int} input Any number
 * @param {String} format What format the input is; sec or ms
 * @returns {String} A humanized string of time
 */
exports.humanize = function(input, format) {
  if (!input) return "RangeError: Not enough input";
  if (!format) return "RangeError: No format was provided to describe the input";
  if (format.toLowerCase() == "ms") var msec = parseInt(Math.floor(input * 1000));
  else if (format.toLowerCase() == "sec") var msec = parseInt(Math.floor(input * 1000));
  else return "TypeError: Invalid format provided";
  if (isNaN(msec)) return "TypeError: Input provided is NaN";
  var days = Math.floor(msec / 1000 / 60 / 60 / 24);
  msec -= days * 1000 * 60 * 60 * 24;
  var hours = Math.floor(msec / 1000 / 60 / 60);
  msec -= hours * 1000 * 60 * 60;
  var mins = Math.floor(msec / 1000 / 60);
  msec -= mins * 1000 * 60;
  var secs = Math.floor(msec / 1000);
  var timestr = "";
  if (days > 0) timestr += days + " days ";
  if (hours > 0) timestr += hours + " hours ";
  if (mins > 0) timestr += mins + " minutes ";
  if (secs > 0) timestr += secs + " seconds";
  return timestr;
}

/**
 * Finds a member in a guild
 * @param {*} msg MessageResolvable
 * @param {String} usertxt Text that contains user's display data to search them by
 * @param {Boolean} self If the function should return <MessageResolvable>.member if no usertxt is provided
 * @returns {*} A member object or null if it couldn't find a member
 */
exports.findMember = function(msg, usertxt, self = false) {
  usertxt = usertxt.toLowerCase();
  let userIDMatch = usertxt.match(/<@!?(\d+)>/);
  let usertxtWithoutAt = usertxt.replace(/^@/, "");
  let matchFunctions = [];
  if (userIDMatch) matchFunctions.push(user => user.id == userIDMatch[1]);
  matchFunctions = matchFunctions.concat([
    user => user.tag.toLowerCase() == usertxtWithoutAt,
    user => user.username.toLowerCase() == usertxtWithoutAt,
    user => user.username.toLowerCase().includes(usertxtWithoutAt)
  ]);
  if (!usertxt) {
    if (self) return msg.member;
    else return null;
  } else {
    return matchFunctions.map(f => {
        return msg.guild.members.find(m => f(m.user));
    }).find(m => m) || null;
  }
}

/**
 * Finds a user in cache
 * @param {*} msg MessageResolvable
 * @param {*} client Discord client
 * @param {String} usertxt Text that contains user's display data to search them by
 * @param {Boolean} self If the function should return <MessageResolvable>.author if no usertxt is provided
 * @returns {*} A user object or null if it couldn't find a user
 */
exports.findUser = function(msg, client, usertxt, self = false) {
  usertxt = usertxt.toLowerCase();
  let userIDMatch = usertxt.match(/<@!?(\d+)>/);
  let usertxtWithoutAt = usertxt.replace(/^@/, "");
  let matchFunctions = [];
  if (userIDMatch) matchFunctions.push(user => user.id == userIDMatch[1]);
  matchFunctions = matchFunctions.concat([
    user => user.tag.toLowerCase() == usertxtWithoutAt,
    user => user.username.toLowerCase() == usertxtWithoutAt,
    user => user.username.toLowerCase().includes(usertxtWithoutAt)
  ]);
  if (!usertxt) {
    if (self) return msg.author;
    else return null;
  } else {
    return matchFunctions.map(f => {
        return client.users.find(u => f(u));
    }).find(u => u) || null;
  }
}

/**
 * Shuffles an array psuedorandomly
 * @returns {Array} An array which has been psuedorandomly shuffled
 */
Array.prototype.shuffle = function() {
  let old = [...this];
  let output = [];
  while (old.length) {
      let random = old.splice(Math.floor(Math.random()*old.length), 1)[0];
      output.push(random);
  }
  return output;
}

/**
 * Changes a presence string into an emoji
 * @param {String} presence The user's presence string
 * @returns {String} The emoji that matches that presence
 */
exports.getPresenceEmoji = function(presence) {
  const presences = {
    online: "<:online:453823508200554508>",
    idle: "<:idle:453823508028456971>",
    dnd: "<:dnd:453823507864748044>",
    offline: "<:invisible:453827513995755520>"
  };
  return presences[presence];
}

/**
 * Changes a presence type integer to a prefix string
 * @param {Number} type The user's presence integer
 * @returns {String} The prefix that matches the presence type
 */
exports.getPresencePrefix = function(type) {
  const prefixes = ["Playing", "Streaming", "Listening to", "Watching"];
  return prefixes[type];
}