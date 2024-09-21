module.exports = {
  schedule: {
    // 间隔
    interval: '8h',
    type: 'worker',
    env: [ 'prod' ],
  },
  async task(ctx) {
    await ctx.service.schedule.buildRotbotsTXTFile();
  },
};
