module.exports = {
  schedule: {
    interval: '30m',
    type: 'worker',
    env: [ 'prod' ],
  },
  async task(ctx) {
    await ctx.service.schedule.updateRcloneConfig();
  },
};
