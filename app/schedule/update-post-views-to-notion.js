module.exports = {
  schedule: {
    interval: '2h',
    type: 'all',
    env: [ 'prod' ],
  },
  async task(ctx) {
    await ctx.service.schedule.updatePostViewsToNotion();
  },
};
