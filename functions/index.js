'use strict';

console.log('Loading function...');
console.log('Loading dependencies...');
const axios = require('axios');
const _ = require('lodash');
const serviceAccount = require('./info.json');
const functions = require('firebase-functions');

const admin = require('firebase-admin');
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: functions.config().mndp.database_url
});

const DEFAULT_ANNOUNCEMENT = 'A new show is starting!';

exports.showStart = functions.database.ref('shows/current/mondaynightdanceparty/meta')
    .onWrite(event => {
        let showSnpashot = event.data;
        let statusSnapshot = showSnpashot.child('status');

        if(!statusSnapshot.changed() && statusSnapshot.val() !== 'live'){
            console.log('Show is not live, exiting...');
            return 0;
        }

        return broadcastShowStart(showSnpashot.val(), 600).then(() => {
            console.log('Success! Exiting...');

            return 0;
        });
    });

function broadcastShowStart(show, channelId){
    let text = generateMessage(show);

    console.log('Broadcasting show announcement...');
    axios.defaults.baseURL = 'https://api.pnut.io';

    let message = { text: text };
    let config = {
        params: {
            update_marker: 1
        },
        headers: {'Authorization': 'Bearer ' + functions.config().mndp_botcast.botcast_key }
    };

    if(show.playAnnouncement)
        return axios.post('/v0/channels/' + channelId + '/messages', message, config)
            .then(() => { return axios.post('/v0/posts', message, config); });

    return axios.post('/v0/channels/' + channelId + '/messages', message, config);
}

function generateMessage(show){
    console.log('Generating message...');
    let message = !_.trim(show.announcement) ? DEFAULT_ANNOUNCEMENT : show.announcement;
    let showTag = '#' + show.showTag;
    let showLink = ' #ShowStart\nmndp.tv';
    let realLength = _.includes(message, showTag) ? message.length : message.length + showTag.length + 1;
    realLength += showLink.length;

    if(_.isArray(show.tags)){
        _.forEach(show.tags, x => {
            if(realLength === 256 || realLength + x.length + 2 > 252)
                return false;

            realLength += (x.length + 2);
            message += ' #' + x;
        });
    }

    if(!_.includes(message, showTag))
        message += ' ' + showTag;

    message += showLink;

    return message;
}