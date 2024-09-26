module.exports = {
  schedule: {
    // 间隔
    interval: '10m',
    type: 'worker',
    env: [ 'prod' ],
  },
  async task(ctx) {
    await ctx.service.schedule.transferFileToAWS();
  },
};
