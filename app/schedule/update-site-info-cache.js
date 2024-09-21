module.exports = {
  schedule: {
    interval: '5m',
    type: 'all',
    env: [ 'prod' ],
  },
  async task(ctx) {
    // type 为 all 同步所有 works 中的缓存
    ctx.app.cache.siteInfo = await ctx.service.blog.getSiteInfo();
  },
};