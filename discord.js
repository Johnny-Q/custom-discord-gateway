const ws = require("ws");
const axios = require("axios");
const { threadId } = require("worker_threads");
var api_base = "https://discord.com/api";
//need to implement resuming sessions
class Discord {
    constructor(token, id, max_disconnections = 20) {
        this.io = null;
        this.token = token;
        this.id = id;
        this.prevConnect = 0;

        //gateway specific
        this.hb_int = 0;
        this.last_s = null;
        this.sess_id = "";

        this.max_disconnections = max_disconnections;
        this.disconnections = 0;
    }
    async gatewayConnect() {
        console.log("@@@@@", this.token != undefined);
        var url;
        this.active = true;
        try {
            url = await this.getGatewayURL();
        }
        catch (err) {
            console.log(timestamp(), err);
            url = "wss://gateway.discord.gg/?v=6&encoding=json";
        }
        this.io = new ws(url);
        this.io.on("open", function () {
            console.log(timestamp(), "connection established");
        });
        this.io.on("close", (code, reason) => {
            this.disconnections++;
            console.log(timestamp(), "CLOSED", code, reason);
            if (this.hb_func) {
                clearInterval(this.hb_func);
                this.hb_func = null;
            }
            if (code == 4004) {
                console.log("invalid token provided");
                this.active = false;
            }
            else if (code != 1000 && this.active) {
                if (this.disconnections <= this.max_disconnections || this.max_disconnections == 0) {
                    if (Date.now() - this.prevConnect >= 5000) { //can only connect once every 5 seconds
                        this.gatewayConnect();
                        this.prevConnect = Date.now();
                    }
                    else {
                        console.log(timestamp(), "throttling retry");
                        setTimeout(() => { this.gatewayConnect() }, 5000);
                        this.prevConnect = Date.now() + 5000;
                    }
                } else {
                    console.log(timestamp(), "max disconnections reached, closing");
                    this.io.active = false;
                    this.io.terminate();
                    this.io.removeAllListeners();
                }
            }
        });
        this.io.on("error", (error) => {
            var { code } = error;
            console.log(timestamp(), "ERROR");
            if (code == "ENOTFOUND") {
            }
            this.terminate(); //will close and then call onclose to reconnect
        });
        this.io.on("message", msg => {
            msg = JSON.parse(msg);
            // console.log(msg);
            var data = msg.d || null;

            if (msg.s != null) {
                this.last_s = msg.s;
            }

            switch (msg.op) {
                case 11: //acknowledge heartbeat
                    // console.log("heartbeated");
                    break;
                case 10: //HELLO event
                    console.log(timestamp(), "received HELLO");
                    //store heartbeat interval
                    this.hb_int = data.heartbeat_interval;

                    //start heartbeating
                    this.hb_func = setInterval(_ => {
                        this.hb(this.last_s, this.io);
                    }, this.hb_int);

                    if (this.sess_id) {
                        this.resume();
                    } else {
                        //send the authentication
                        this.auth();
                    }
                    break;
                case 9: //invalid session
                    //could wait for thing, or completely disconnect and reconnect
                    console.log(timestamp(), "INVALID SESSION");
                    this.sess_id = "";
                    this.io.close(1012); //going for the completely disconnect and reconnect approach
                    break;
                case 0: //other events
                    if (msg.t == "READY") {
                        this.sess_id = data.session_id;
                        console.log(timestamp(), "logged in id", this.sess_id);
                    } else if (msg.t == "RESUMED") {
                        console.log(timestamp(), "resumed", this.sess_id);
                    }
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
        console.log(timestamp(), "authenticating");
        this.io.send(JSON.stringify({
            "op": 2,
            "d": {
                "token": this.token,
                "properties": {},
                "compress": false
            }
        }));
    }
    resume() {
        console.log(timestamp(), "resuming", this.sess_id);
        this.io.send(JSON.stringify({
            "op": 6,
            "d": {
                "token": this.token,
                "session_id": this.sess_id,
                "seq": this.last_s
            }
        }));
    }
    async handleEvent(msg) {
        console.log(timestamp(), "received event", msg.t);
        switch (msg.t) {
            case "MESSAGE_CREATE":
                var { channel_id } = msg.d;
                var { id } = msg.d.author;
                var { content } = msg.d;
                console.log(timestamp(), "received", content);
                if (content[0] == '!') {
                    console.log(timestamp(), "RECEIVED COMMAND");
                    try {
                        if (id != this.id && await this.isChannelDM(channel_id)) {
                            // console.log("is DM");
                            this.sendMesssage({"content":"no"}, channel_id);

                        } else {
                            // console.log("is not dm");
                            this.sendMesssage({"content":"Cannot be used in a server channel. DM."}, channel_id);
                        }
                    } catch (err) {
                        console.log(err);
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
                "headers": {
                    "authorization": "Bot " + this.token
                }
            });
            return res.data.type == 1;
        } catch (err) {
            console.log(err);
            return false;
        }
    }
    async getGatewayURL() {
        try {
            var res = await axios({
                "url": `${api_base}/gateway/bot`,
                "method": "get",
                "headers": {
                    "authorization": `Bot ${this.token}`
                }
            });
            return res.data.url;
        }
        catch (err) {
            throw "couldn't get gateway";
        }
    }

    sendMesssage(msgObj, channel, token = this.token) {
        return axios({
            "method": "POST",
            "url": `${api_base}/channels/${channel}/messages`,
            "headers": {
                "Authorization": "Bot " + token,
                "content-type": "application/json"
            },
            "data": JSON.stringify(msgObj)
        });
    }
}
function timestamp() {
    return new Date().toLocaleString();
}
module.exports = Discord;