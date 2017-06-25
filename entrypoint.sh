#!/bin/bash

node > config.json <<EOF

var data = require('./config.example.json');

data.bot.isbot = '${BOT_ISBOT}';
data.bot.token = '${BOT_TOKEN}';
data.bot.email = '${BOT_EMAIL}';
data.bot.password = '${BOT_PASSWORD}';
data.bot.oauth = '${BOT_OAUTH}';

data.database.host = '${DATABASE_HOST}';
data.database.port = '${DATABASE_PORT}';
data.database.password = '${DATABASE_PASSWORD}';
data.database.user = '${DATABASE_USER}';

data.settings.prefix = '${SETTINGS_PREFIX}';
data.settings.autodeletemsg = '${SETTINGS_AUTODELETEMSG}';
data.settings.deleteTimeout = '${SETTINGS_DELETE_TIMEOUT}';
data.settings.deleteTimeoutLong = '${SETTINGS_DELETE_TIMEOUT_LONG}';
data.settings.maxvcslots = '${SETTINGS_MAXVCSLOTS}';

data.permissions.master = '${PERMISSIONS_MASTER}'.split(",");
data.permissions.level1 = '${PERMISSIONS_LEVEL1}'.split(",");
data.permissions.level2 = '${PERMISSIONS_LEVEL2}'.split(",");
data.permissions.level3 = '${PERMISSIONS_LEVEL3}'.split(",");

data.bezerk.use = '${BEZERK_USE}';
data.bezerk.uri = '${BEZERK_URI}';

data.elasticsearch.use = '${ELASTICSEARCH_USE}';
data.elasticsearch.client = '${ELASTICSEARCH_CLIENT}';

data.api_keys.imgflip.username = '${API_KEYS_IMGFLIP_USERNAME}';
data.api_keys.imgflip.password = '${API_KEYS_IMGFLIP_PASSWORD}';
data.api_keys.google = '${API_KEYS_GOOGLE}';
data.api_keys.twitchId = '${API_KEYS_TWITCH_ID}';
data.api_keys.bugsnag = '${API_KEYS_BUGSNAG}';
data.api_keys.cleverbot_user = '${API_KEYS_CLEVERBOT_USER}';
data.api_keys.cleverbot_key = '${API_KEYS_CLEVERBOT_KEY}'; 
data.api_keys.imgur = '${API_KEYS_IMGUR}';

console.log(JSON.stringify(data));

EOF

exec node ./DougBot.js
