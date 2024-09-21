module.exports = {
  schedule: {
    // 间隔
    interval: '1h',
    type: 'worker',
    env: [ 'prod' ],
  },
  async task(ctx) {
    await ctx.service.schedule.fetchNotionSiteInfoToDatabase();
  },
};
