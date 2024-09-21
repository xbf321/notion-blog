module.exports = {
  schedule: {
    // 间隔
    interval: '2h',
    type: 'worker',
    env: [ 'prod' ],
  },
  async task(ctx) {
    await ctx.service.blog.fetchNotionPostContentToDatabase();
  },
};
