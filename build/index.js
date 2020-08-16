const ws = require("ws");
const Discord = require("./discord");
const config = require("../config.json");
const axios = require("axios");
const api_base = "https://discord.com/api";
var asdf = new Discord(config.bot_token, config.clientID);
asdf.gatewayConnect();
