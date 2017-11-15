import mongoose from 'mongoose';
import util from 'util';
import cron from 'cron';

// config should be imported before importing any other file
import config from './config/config';
import app from './config/express';

import updateRanks from './server/cron/updateRanks';
import updatePlayers from './server/cron/updatePlayers';

const debug = require('debug')('express-mongoose-es6-rest-api:index');

// make bluebird default Promise
Promise = require('bluebird'); // eslint-disable-line no-global-assign

// plugin bluebird promise in mongoose
mongoose.Promise = Promise;

// updateRanks();
// updatePlayers();

// const playerCron = new cron.CronJob({
//   // cronTime: '00 30 2 * * *',
//   cronTime: '00 30 1 * * 2',
//   onTick: updatePlayers(),
//   start: true,
//   timeZone: 'America/Los_Angeles',
// });

// connect to mongo db
const mongoUri = config.mongo.host;
mongoose.connect(mongoUri, { server: { socketOptions: { keepAlive: 1 } } });
mongoose.connection.on('error', () => {
  throw new Error(`unable to connect to database: ${mongoUri}`);
});

// print mongoose logs in dev env
if (config.MONGOOSE_DEBUG) {
  mongoose.set('debug', (collectionName, method, query, doc) => {
    debug(`${collectionName}.${method}`, util.inspect(query, false, 20), doc);
  });
}

// module.parent check is required to support mocha watch
// src: https://github.com/mochajs/mocha/issues/1912
if (!module.parent) {
  // listen on port config.port
  app.listen(config.port, () => {
    console.info(`server started on port ${config.port} (${config.env})`); // eslint-disable-line no-console
  });
}

export default app;
