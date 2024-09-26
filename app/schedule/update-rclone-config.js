module.exports = {
  schedule: {
    interval: '1h',
    type: 'worker',
    env: [ 'prod' ],
  },
  async task(ctx) {
    await ctx.service.schedule.updateRcloneConfig();
  },
};
