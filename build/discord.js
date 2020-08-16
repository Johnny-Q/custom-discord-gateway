const ws = require("ws");
const axios = require("axios");
var api_base = "https://discord.com/api";
//need to implement resuming sessions
class Discord {
    constructor(token, id) {
        this.io = null;
        this.token = token;
        this.id = id;
        //gateway specific
        this.hb_int = 0;
        this.last_s = null;
        this.sess_id = "";
    }
    async gatewayConnect() {
        var url;
        try {
            url = await this.getGatewayURL();
        }
        catch (err) {
            console.log(err);
            url = "wss://gateway.discord.gg/?v=6&encoding=json";
        }
        this.io = new ws(url);
        this.io.on("open", function () {
            console.log("connection established");
        });
        this.io.on("close", (code, reason) => {
            console.log(code, reason);
            if (this.hb_func) {
                clearInterval(this.hb_func);
                this.hb_func = null;
            }
            if (code == 4004) {
                console.log("invalid token provided");
                this.active = false;
            }
            else if (code != 1000 && this.active) {
                if (Date.now() - prevConnect >= 5000) { //can only connect once every 5 seconds
                    connect();
                }
                else {
                    setTimeout(connect, 5000);
                }
            }
        });
        this.io.on("error", (error) => {
            var { code } = error;
            if (code == "ENOTFOUND") {
            }
            this.terminate(); //will close and then call onclose to reconnect
        });
        this.io.on("message", msg => {
            msg = JSON.parse(msg);
            console.log(msg);
            var data = msg.d || null;

            if (msg.s != null) {
                this.last_s = msg.s;
            }

            switch (msg.op) {
                case 11: //acknowledge heartbeat
                    console.log("heartbeated");
                    break;
                case 10: //HELLO event
                    //store heartbeat interval
                    this.hb_int = data.heartbeat_interval;

                    //start heartbeating
                    this.hb_func = setInterval(_ => {
                        this.hb(this.last_s, this.io);
                    }, this.hb_int);

                    //send the authentication
                    this.auth();
                    break;
                case 9: //invalid session
                    //could wait for thing, or completely disconnect and reconnect
                    this.io.close(1012); //going for the completely disconnect and reconnect approach
                    break;
                case 0: //other events
                    this.handleEvent(msg);
                    break;
            }
        });
    }
    hb(last_s, io) {
        io.send(JSON.stringify({
            "op": 1,
            "d": last_s
        }));
    }
    auth() {
        console.log("authenticating");
        this.io.send(JSON.stringify({
            "op": 2,
            "d": {
                "token": this.token,
                "properties": {},
                "compress": false
            }
        }));
    }
    async handleEvent(msg) {
        switch (msg.t) {
            case "MESSAGE_CREATE":
                var {channel_id} = msg.d;
                var {id} = msg.d.author;
                var {content} = msg.d;
                if(content[0] == '!'){
                    if(id != this.id && await this.isChannelDM(channel_id)){
                        console.log("is DM");
                        this.sendMesssage("no", channel_id);
                    }else{
                        console.log("is not dm");
                        this.sendMesssage("Cannot be used in server channel", channel_id);
                    }
                }
                break;
        }
    }
    async isChannelDM(channel_id) {
        try {
            var res = await axios({
                "method": "get",
                "url": `${api_base}/channels/${channel_id}`,
                "headers":{
                    "authorization":"Bot " + this.token
                }
            });
            return res.data.type == 1;
        }catch(err){
            return false;
        }
    }
    async getGatewayURL() {
        try {
            var res = await axios({
                "url": `${api_base}/gateway/bot`,
                "method": "get",
                "headers": {
                    "authorization": `Bot ${config.bot_token}`
                }
            });
            return res.data.url;
        }
        catch (err) {
            throw "couldn't get gateway";
        }
    }
    
    sendMesssage(content, channel, token = this.token) {
        return axios({
            "method": "POST",
            "url": `${api_base}/channels/${channel}/messages`,
            "headers": {
                "Authorization": "Bot " + token,
                "content-type": "application/json"
            },
            "data": JSON.stringify({ "content": `${content}` })
        });
    }
}

module.exports = Discord;