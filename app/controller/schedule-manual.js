const _ = require('lodash');
const { Controller } = require('egg');

// 手动执行 Schedule
// get -> 获得DB数据
// post -> 实时从 Notion 获取，并更新 DB
class ScheduleManualController extends Controller {
  async init() {
    await this.ctx.service.blog.initTableIfNotExists();
    this.ctx.body = 'ok';
  }
  async siteInfo() {
    const { ctx } = this;
    const { method } = ctx.request;
    let siteInfo = this.app.cache.siteInfo;
    if (method === 'POST') {
      siteInfo = await ctx.service.schedule.fetchNotionSiteInfoToDatabase();
      this.app.cache.siteInfo = siteInfo;
    }
    this.ctx.body = siteInfo;
  }
  async buildSitemapXML() {
    const content = await this.ctx.service.schedule.buildSitemapXMLFile();
    this.ctx.body = `"${content}"`;
  }
  async listPosts() {
    if (this.ctx.request.method === 'POST') {
      await this.ctx.service.schedule.fetchNotionPostPropertyToDatabase();
    }
    const list = await this.ctx.service.blog.listPosts();
    this.ctx.body = list;
  }
  async listPostsContent() {
    if (this.ctx.request.method === 'POST') {
      await this.ctx.service.schedule.fetchNotionPostContentToDatabase();
    }
    this.ctx.body = 'ok';
  }
}

module.exports = ScheduleManualController;
