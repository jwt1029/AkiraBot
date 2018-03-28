const Discord = require("discord.js");
const client = new Discord.Client();
//
const ytdl = require("ytdl-core");
const request = require("request");
const getYoutubeID = require("get-youtube-id");
const fetchVideoInfo = require("youtube-info");
const ffmpeg = require('fluent-ffmpeg');
const WitSpeech = require('node-witai-speech');
const fs = require('fs');
const path = require('path');
const opus = require('node-opus');


// variable
var queue = [];
var isPlaying = false;
var dispatcher = null;
var voiceChannel = null;
var textChannel = null;
var listenConnection = null;
var listenReceiver = null;
var listenStreams = new Map();
var skipReq = 0;
var skippers = [];
var listening = false;

const recordingsPath = makeDir('./recordings');


client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
    if (msg.content === 'ping') {
        msg.reply('Pong!');
    }
    if(msg.content === 'join') {
        textChannel = msg.channel;
        console.log('okay, i join');
        commandListen(msg);
    }
    if(msg.content === 'leave') {
        commandLeave();
    }
});

function commandListen(message) {
    member = message.member;
    if (!member) {
        return;
    }
    if (!member.voiceChannel) {
        message.reply(" you need to be in a voice channel first.")
        return;
    }
    if (listening) {
        message.reply(" a voice channel is already being listened to!");
        return;
    }

    listening = true;
    voiceChannel = member.voiceChannel;
    textChannel.send('Listening in to **' + member.voiceChannel.name + '**!');

    var recordingsPath = path.join('.', 'recordings');
    makeDir(recordingsPath);

    voiceChannel.join().then((connection) => {
        //listenConnection.set(member.voiceChannelId, connection);
        listenConnection = connection;

        let receiver = connection.createReceiver();
        receiver.on('opus', function(user, data) {
            let hexString = data.toString('hex');
            let stream = listenStreams.get(user.id);
            if (!stream) {
                if (hexString === 'f8fffe') {
                    return;
                }
                let outputPath = path.join(recordingsPath, `${user.id}-${Date.now()}.opus_string`);
                stream = fs.createWriteStream(outputPath);
                listenStreams.set(user.id, stream);
            }
            stream.write(`,${hexString}`);
        });
        //listenReceiver.set(member.voiceChannelId, receiver);
        listenReceiver = receiver;
    }).catch(console.error);
}

client.on('guildMemberSpeaking', (member, speaking) => {
    // Close the writeStream when a member stops speaking
    if (!speaking && member.voiceChannel) {
        let stream = listenStreams.get(member.id);
        if (stream) {
            listenStreams.delete(member.id);
            stream.end(err => {
                if (err) {
                    console.error(err);
                }

                let basename = path.basename(stream.path, '.opus_string');
                let text = "default";

                // decode file into pcm
                decode.convertOpusStringToRawPCM(stream.path,
                    basename,
                    (function() {
                        processRawToWav(
                            path.join('./recordings', basename + '.raw_pcm'),
                            path.join('./recordings', basename + '.wav'),
                            (function(data) {
                                if (data != null) {
                                    handleSpeech(member, data._text);
                                }
                            }).bind(this))
                    }).bind(this));
            });
        }
    }
});
function handleSpeech(member, speech) {
    var command = speech.toLowerCase().split(' ');
    console.log(command);
}


function commandLeave() {
    listening = false;
    queue = []
    if (dispatcher) {
        dispatcher.end();
    }
    dispatcher = null;
    commandStop();
    if (listenReceiver) {
        listenReceiver.destroy();
        listenReceiver = null;
    }
    if (listenConnection) {
        listenConnection.disconnect();
        listenConnection = null;
    }
    if (voiceChannel) {
        voiceChannel.leave();
        voiceChannel = null;
    }
}

client.login('NDI4MzgwOTE4NjkyOTcwNTA3.DZyRZA.u5LCbn9IaVc6JkCtbg4GEEs_cxU');