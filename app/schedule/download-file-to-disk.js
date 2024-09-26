module.exports = {
  schedule: {
    // 间隔
    interval: '20m',
    type: 'worker',
    env: [ 'prod' ],
  },
  async task(ctx) {
    await ctx.service.schedule.downloadFileToDisk();
  },
};
