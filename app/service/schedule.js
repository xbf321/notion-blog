const _ = require('lodash');
const fs = require('fs-extra');
const shell = require('shelljs');
const { cleanDoubleSlashes } = require('ufo');

const Service = require('egg').Service;

class ScheduleService extends Service {
  // 查询 SiteInfo
  async fetchNotionSiteInfoToDatabase() {
    this.logger.info('service.schedule -> fetchNotionSiteInfoToDatabase');
    const { SITE_INFO } = this.config.dbNameKeys;
    const response = await this.ctx.service.notion.retrieveSiteInfo();
    // search menus
    const { menus, config: notionConfig } = await this.ctx.service.notion.retrieveMenusAndConfig();
    _.each(menus, item => {
      // 增加 target 属性
      item.target = '';
      const { slug } = item;
      if (_.startsWith(slug, 'http')) {
        item.target = '_blank';
      }
    });
    const data = {
      ...response,
      ...notionConfig,
      menus,
    };
    this.ctx.service.blog.insertBlogDatabase(SITE_INFO, data);
    return data;
  }

  // 递归查询，时间间隔，重复调用，间隔至少 1 小时
  async fetchNotionPostPropertyToDatabase(startCursor = undefined, pageSize = 10) {
    this.logger.info('service.schedule -> fetchNotionPostPropertyToDatabase');
    const { PAGE_PROPERTY, POST_PROPERTY } = this.config.dbNameKeys;
    const { results, next_cursor, has_more } = await this.ctx.service.notion.queryPages(startCursor, pageSize);
    _.each(results, item => {
      const { id, type } = item;
      const dbNameKey = type === 'Page' ? PAGE_PROPERTY : POST_PROPERTY;
      this.ctx.service.blog.insertBlogDatabase(`${dbNameKey}/${id}`, item);
    });
    if (has_more && next_cursor) {
      await this.fetchNotionPostPropertyToDatabase(next_cursor, pageSize);
    }
  }

  // 1. 从 db 中获取所有 postId
  // 2. fetch notion API
  // 3. 把数据存放到 database
  // 重复调用，时间间隔至少 1 小时
  async fetchNotionPostContentToDatabase() {
    this.logger.info('service.schedule -> fetchNotionPostContentToDatabase');
    const { POST_PROPERTY, PAGE_PROPERTY } = this.config.dbNameKeys;
    const stmt = this.app.db.prepare(`SELECT name from blog WHERE name LIKE '${PAGE_PROPERTY}/%' OR name LIKE '${POST_PROPERTY}/%'`);
    const dbData = stmt.all();
    if (!dbData || dbData.length === 0) {
      return;
    }
    for (let i = 0; i < dbData.length; i++) {
      // 格式：post-property/09897ebb-c7c1-47c7-95cb-6d5361d58470
      const [ , id ] = dbData[i].name.split('/');
      if (id) {
        await this.ctx.service.blog.realtimeFetchNotionPostContentToDatabaseByPostId(id);
      }
    }
  }

  // 使用 rclone 同步到 AWS
  async transferFileToAWS() {
    this.logger.info('service.schedule -> transferFileToAWS');
    // 判断是否安装 rclone
    const hasRclone = shell.exec('rclone --version').code === 0;
    if (!hasRclone) {
      this.logger.error('command not found: rclone');
      return;
    }
    // 调用 sh
    // 出现权限错误时，执行：chmod +x ../scripts/test.sh
    const { baseDir } = this.app;
    const { awsBucket } = this.app.cache.siteInfo;
    if (!awsBucket) {
      this.logger.error('missing awsBucket in transferFileToAWS, exists.');
      return;
    }
    const sourceDir = `${baseDir}/.files`;
    const targetDir = `${baseDir}/.files-tmp`;
    shell.mkdir('-p', sourceDir);
    // 1. 先移动到 .files-tmp 目录，避免同步时，下载文件
    shell.mv(sourceDir, targetDir);
    // 2. mv 之后，sourceDir 已经移除，务必在创建
    shell.mkdir('-p', sourceDir);
    // 3. 使用 rclone 同步
    const result = shell.exec(`rclone copy -P ${targetDir} ${awsBucket}`);
    // 4. 删除 targetDir
    shell.rm('-rf', targetDir);
    return result;
  }

  // 下载图片到本地磁盘
  async downloadFileToDisk() {
    this.logger.info('service.schedule -> downloadFileToDisk');
    // 1. 从 Database 中获取需要下载文件 blockId
    // 2. 实时根据 blockId 获取文件路径（Notion文件有很短的有效期，所以需要实时获取）
    // 3. 下载成功，删除 Database 记录，同时更新 Notion Block 为自己域名的文件名
    // 4. 下载失败，什么都不做
    const { imageDomain } = this.app.cache.siteInfo;
    if (!imageDomain) {
      this.ctx.logger.warn('missing image domain in downloadFileToDisk action, exists.');
      return;
    }
    const { dbNameKeys } = this.config;
    const { POST_FILE } = dbNameKeys;
    const response = this.app.db.prepare(`SELECT data FROM blog WHERE name LIKE '${POST_FILE}/%'`).all();
    const ids = _.map(response, item => JSON.parse(item.data));
    if (ids && ids.length === 0) {
      return;
    }
    this.ctx.logger.info('开始从 Notion 下载文件到磁盘。', ids);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const { type, image } = await this.service.notion.retrieveBlockInfo(id);
      if (type !== 'image') {
        continue;
      }
      if (image.type !== 'file') {
        continue;
      }
      const { url } = image.file;
      const newFileName = await this.service.file.downloadFileToDisk(id, url);
      if (newFileName) {
        // 删除 Database
        this.service.blog.deleteDatabaseRowByName(`${POST_FILE}/${id}`);
        // 更新 Notion
        await this.service.blog.updateImageUrlByBlockId(id, `${imageDomain}/${newFileName}`);
      }
      this.ctx.logger.info(`从 Notion 下载文件到磁盘。下载文件名：${newFileName}`);
    }
  }

  // 创建 sitemap.xml 物理文件
  async buildSitemapXMLFile() {
    this.logger.info('service.schedule -> buildSitemapXMLFile');
    const { POST_PROPERTY } = this.config.dbNameKeys;
    const { siteInfo } = this.app.cache;
    const response = this.app.db.prepare(`SELECT data FROM blog WHERE name LIKE '${POST_PROPERTY}/%'`).all();
    const result = [];
    result.push('<?xml version="1.0" encoding="UTF-8"?>');
    result.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    _.each(response, item => {
      const { data } = item;
      let json = null;
      try {
        json = JSON.parse(data);
        const { href } = json;
        const loc = cleanDoubleSlashes(`${siteInfo.domain}/${href}`);
        result.push('<url>');
        result.push(`<loc>${loc}</loc>`);
        result.push('</url>');
      } catch (err) {
        this.ctx.logger.error(err);
      }
    });
    result.push('</urlset>');
    const content = result.join('');
    fs.outputFileSync(`${this.app.baseDir}/sitemap.xml`, content);
    return content;
  }

  // 更新页面浏览数
  async updatePostViewsToNotion() {
    this.logger.info('service.schedule -> updatePostViewsToNotion');
    const { ctx, app } = this;
    const { postViews } = app.cache;
    // 这块有个细微的BUG
    // 如果在更新 Views 时间过长，这时又频繁请求 Post
    // 在这个时间差内，缓存中的 views 是不可用的，会丢弃
    // 不过因为是 views 不是重要数据，可以接受
    for (const item of Object.entries(postViews)) {
      const [ pageId, viewCount ] = item;
      // 需要实时获取 post views
      // 在这个基础上累加
      // 因为 DB 中的数据也不是实时获取
      const { views: baseViews } = await ctx.service.notion.retrievePagePropertiesByPageId(pageId);
      const totalViews = (baseViews || 0) + (viewCount || 1);
      await ctx.service.blog.updatePostViewsByPageId(pageId, totalViews);
      delete this.app.cache.postViews[pageId];
    }
  }

  // 更新 rclone 配置文件
  // 数据来源：Notion Config 中的 rcloneConfig
  updateRcloneConfig() {
    const { app, logger } = this;
    const { rcloneConfig } = app.cache.siteInfo;
    if (!rcloneConfig) {
      logger.warn('missing rcloneConfig in updateRcloneConfig action, exists.');
      return;
    }
    // rclone config 固定目录
    const rcloneConfigPath = '/root/.config/rclone/rclone.conf';
    fs.outputFileSync(rcloneConfigPath, rcloneConfig);
    return rcloneConfig;
  }
}
module.exports = ScheduleService;
