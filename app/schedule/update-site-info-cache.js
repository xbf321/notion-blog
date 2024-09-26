module.exports = {
  schedule: {
    interval: '10m',
    type: 'all',
  },
  async task(ctx) {
    // type 为 all 同步所有 works 中的缓存
    ctx.app.cache.siteInfo = await ctx.service.blog.getSiteInfo();
  },
};
