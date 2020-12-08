import { AxiosResponse } from "axios";
import WebSocket from "ws";

const ws = require("ws");
const axios = require("axios");
let api_base = "https://discord.com/api";
//@ts-expect-error
process.env.debug = true;

//need to implement resuming sessions
class Discord {
    debug = false;
    default_gateway_url = "wss://gateway.discord.gg/";
    gateway_version = 8;

    io: WebSocket = null;

    token: string;

    terminating_codes = [1000, 4007];

    last_connect_time = 0;

    hb_int = 0;
    hb_func: NodeJS.Timeout;
    last_hb_time = 0;
    ping = 999;

    last_s = null;
    session_id;

    constructor(token, debug = false) {
        this.token = token;
        this.debug = debug;
    }

    async connect(): Promise<void> {
        this.last_connect_time = Date.now();
        //get the url to connect at (for different versions)
        let url;
        try {
            url = await this.getGatewayURL();
        } catch (err) {
            this.debugLog(err);
            url = "wss://gateway.discord.gg";
        } finally {
            let temp_socket = new ws(url + `/?v=${this.gateway_version.toString()}&encoding=json`);
            temp_socket.on("open", () => {
                temp_socket.on("message", raw => {
                    let payload: GatewayPayload = JSON.parse(raw);
                    let { op, s, t, d } = payload || null;

                    //overwrite last_s if we've been provided with one
                    this.last_s = s || this.last_s;
                    switch (op) {
                        case 10: //HELLO
                            d = d as GatewayHELLO;
                            //set up heart beating
                            this.hb_int = d.heartbeat_interval;
                            this.hb_func = setInterval(() => {
                                this.send_hb();
                            }, this.hb_int);

                            //choose whether or not to log in or resume session
                            if (this.session_id) {//resume an old session
                                this.send_resume();
                            } else {//start a new session
                                this.send_auth();
                            }
                            break;
                        case 9: //invalid session
                            this.session_id = "";//clear the session id 
                            
                            //wait for another message

                            // this.io.close(1001);
                            break;
                        case 11: //acknowledge heartbeat
                            this.ping = Date.now() - this.last_hb_time;
                            this.debugLog(this.ping);
                            break;
                        case 0:
                            switch (t) {
                                case "READY":
                                    this.session_id = d.session_id;
                                    break;
                                case "RESUMED":
                                    //don't know what to do here
                                    break;
                                /*
                                case "MESSAGE_CREATE":
                                    break;
                                case "GUILD_MEMBER_ADD":
                                    break;
                                */
                                default:
                                    this.debugLog(["uncaptured event", t]);
                                    this.handleEvent(payload);
                                    break;
                            }
                            break;
                    }
                });
                this.io = temp_socket;
            });
            temp_socket.on("error", (error) => {
                this.io.terminate(); //goes to close to handle
            });
            //will attempt to reconnect if necessary
            temp_socket.on("close", (code, reason) => {
                //clear the heartbeat function
                if (this.terminating_codes.indexOf(code) != -1) {
                    //can't do anything
                    return;
                } else {
                    //try to reconnect
                    //limit ourselves to 1 reconnection every 5 seconds
                    let wait = (5 * 1000) - (Date.now() - this.last_connect_time);
                    wait = wait < 1 ? 1 : wait; //make sure it's not lower than 1
                    wait = wait >= 5000 ? 5000 : wait;
                    setTimeout(() => {
                        this.connect();
                    }, wait);
                    this.debugLog(["trying again in ", wait]);
                }
            });
        }
    }

    disconnect() {
        this.io.close(1000);
    }

    send_auth() {
        if (!this.io) return;
        this.io.send(JSON.stringify({
            "op": 2,
            "d": {
                "token": this.token,
                "properties": {},
                "compress": false
            }
        }));
    }

    send_resume() {
        if (!this.io) return;
        this.io.send(JSON.stringify({
            "op": 6,
            "d": {
                "token": this.token,
                "session_id": this.session_id,
                "seq": this.last_s
            }
        }));
    }

    send_hb() {
        if (!this.io) return;
        //store time sent
        this.last_hb_time = Date.now();
        this.io.send(JSON.stringify({
            "op": 1,
            "d": this.last_s
        }));
    }

    async getGatewayURL(): Promise<string> {
        try {
            let res: AxiosResponse = await axios({
                "url": `${api_base}/gateway`,
                "medthod": "get"
            });
            return res.data.url;
        } catch (err) {
            throw "couldn't get gateway url";
        }
    }

    async getGatewayURLBot() {
        try {
            let res: AxiosResponse = await axios({
                "url": `${api_base}/gateway/bot`,
                "medthod": "get",
                "headers": {
                    "authorization": `Bot ${this.token}`
                }
            });
            return res.data.url;
        } catch (err) {
            throw "couldn't get gateway url";
        }
    }

    //will be overwritten;
    async handleEvent(payload) {

    }
    debugLog(params) {
        if (this.debug) {
            console.log(new Date().toISOString(), params);
        }
    }
}
module.exports = Discord;
interface GatewayHELLO {
    heartbeat_interval: number
}

interface GatewayPayload {
    op: number,
    s?: number,
    t?: string
    d?: any
}
interface DiscordMessage {
    id: string;
    channel_id: string;
    content: string;
    embeds: DiscordMessageEmbed[];
    url: string;
}

interface DiscordMessageEmbed {
    url: string;
    fields: DiscordEmbedField[];
}

interface DiscordEmbedField {
    name: string;
    value: string;
}