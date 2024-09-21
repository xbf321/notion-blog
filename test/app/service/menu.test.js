const { strict: assert } = require('node:assert');
// const path = require('node:path');
// const { statSync } = require('node:fs');
const { app } = require('egg-mock/bootstrap');

describe('getPrimary()', () => {
  it('获取主菜单', async () => {
    // 创建 ctx
    const ctx = app.mockContext();
    // 通过 ctx 访问 service.user
    const list = await ctx.service.meun.getPrimary();
    assert(list);
  });
});
