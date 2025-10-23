const serverRuntime = require('./createServer');

if (process.env.NODE_ENV !== 'test') {
  serverRuntime.startServer();
}

const app = serverRuntime.app;

module.exports = app;
module.exports.app = app;
module.exports.createServer = serverRuntime.createServer;
module.exports.startServer = serverRuntime.startServer;
module.exports.wss = serverRuntime.wss;
module.exports.store = serverRuntime.store;
module.exports.historyStore = serverRuntime.historyStore;
module.exports.connectOBS = serverRuntime.connectOBS;
module.exports.getHttpServer = serverRuntime.getHttpServer;
module.exports.runtime = serverRuntime;
