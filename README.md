A custom class to interface with discord's gateway written in nodejs  
Basically implements all the connection/authentication stuff for you

Quick start
```
const Discord = require("./discord");
const config = require("./config.json");
var bot = new Discord(config.bot_token, config.clientID);
bot.gatewayConnect();
```

example config.json  
```
{
    "clientID": "CLIENT_ID",
    "client_secret":"CLIENT_SECRET",
    "bot_token":"BOT_TOKEN"
}
```

Extend the Discord class and overide handleEvent method to create custom bot behavior  

Requires ws and axios