module.exports = {
  schedule: {
    // 间隔
    interval: '1.5h',
    type: 'worker',
    env: [ 'prod' ],
  },
  async task(ctx) {
    await ctx.service.schedule.fetchNotionPostContentToDatabase();
  },
};
