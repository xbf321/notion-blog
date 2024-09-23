const RemoteErrorTransport = require('./app/lib/remote-error-transport');
module.exports = async app => {
  const ctx = app.createAnonymousContext();
  const { env } = app.config;
  app.messenger.on('init_data', () => {
    if (env !== 'prod') {
      return;
    }
    // 某一个 worker 会运行下面逻辑
    app.logger.info('init_data');
    ctx.runInBackground(async () => {
      app.logger.info('checking blog table');
      // 1. 检查 blog 表是否存在
      ctx.service.blog.initTableIfNotExists();
      // 2. 加载 siteInfo 数据到 DB
      await ctx.service.schedule.fetchNotionSiteInfoToDatabase();
      // 3. 让所有 worker 更新 siteInfo 缓存
      await app.runSchedule('update-site-info-cache');
    });
  });
  // 让所有 worker 更新 siteInfo 缓存
  ctx.runInBackground(async () => {
    if (env !== 'prod') {
      // 在本地开发时，可以打开这句，加载 siteInfo
      // 为了避免每次文件改动，都需要执行，建议首次打开，以后注释掉
      // await ctx.service.schedule.fetchNotionSiteInfoToDatabase();
    }
    await app.runSchedule('update-site-info-cache');
  });
  app.logger.info('init app.js');
  // 在 app.js 中给 errorLogger 添加 transport，这样每条日志就会同时打印到这个 transport。
  app.getLogger('errorLogger').set('remote', new RemoteErrorTransport({ level: 'ERROR', app }));
};
