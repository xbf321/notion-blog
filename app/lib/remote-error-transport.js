const util = require('util');
const Transport = require('egg-logger').Transport;

class RemoteErrorTransport extends Transport {
  constructor(options) {
    super(options);
    this._buf = [];
    // 5s 上报一次
    this.interval = 1000 * 5;
    this._timer = this._createInterval();
  }

  _createInterval() {
    return setInterval(() => this.report(), this.interval);
  }

  report() {
    if (this._buf.length > 0) {
      this._sendRemoteServer(this._buf.shift());
    }
  }

  _sendRemoteServer(message) {
    const { logCenterServer } = this.app.cache.siteInfo;
    if (!logCenterServer) {
      return;
    }
    this.options.app.curl(logCenterServer, {
      method: 'POST',
      contentType: 'json',
      data: {
        content: JSON.stringify(message),
      },
    }).catch(console.error);
  }

  // 定义 log 方法。在此方法中，将日志上报给远端服务。
  log(level, args) {
    let log;
    if (args[0] instanceof Error) {
      const err = args[0];
      log = util.format(
        '%s: %s\n%s\npid: %s\n',
        err.name,
        err.message,
        err.stack,
        process.pid
      );
    } else {
      log = util.format(...args);
    }
    // 开发环境不上报
    if (this.options.app.config.env === 'prod') {
      this._buf.push(log);
    }
  }
}
module.exports = RemoteErrorTransport;
