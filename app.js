const RemoteErrorTransport = require('./app/lib/remote-error-transport');

class AppBootHook {
  constructor(app) {
    this.app = app;
  }

  async configWillLoad() {
    const { app } = this;
    const ctx = await app.createAnonymousContext();

    

    if (app.env !== 'prod') {
      return;
    }
    // 生产环境检测，避免开发环境重复调用
    // 1. 检查 blog 表是否存在
    ctx.service.blog.initTableIfNotExists();
    // 2. 加载 siteInfo 数据到 DB
    const data = await ctx.service.schedule.fetchNotionSiteInfoToDatabase();
    // 3. 更新 siteInfo 缓存
    app.cache.siteInfo = data;
  }

  async willReady() {
    const { app } = this;
    // 在开发环境下调用
    if (app.env === 'local') {
      const ctx = await app.createAnonymousContext();
      app.cache.siteInfo = await ctx.service.blog.getSiteInfo();
    }
    // 在 app.js 中给 errorLogger 添加 transport，这样每条日志就会同时打印到这个 transport。
    app.getLogger('errorLogger').set('remote', new RemoteErrorTransport({ level: 'ERROR', app }));
  }
}
module.exports = AppBootHook;
