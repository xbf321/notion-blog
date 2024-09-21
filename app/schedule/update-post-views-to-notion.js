module.exports = {
  schedule: {
    interval: '5m',
    type: 'worker',
    env: [ 'prod' ],
  },
  async task(ctx) {
    await ctx.service.schedule.updatePostViewsToNotion();
  },
};
