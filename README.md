A custom class to interface with discord's gateway written in nodejs

Override handle event to setup custom commands

Quick start
const Discord = require("./discord");
const config = require("./config.json");
var asdf = new Discord(config.bot_token, config.clientID);
asdf.gatewayConnect();

Extend the Discord class and overide handleEvent method to create custom bot behavior
