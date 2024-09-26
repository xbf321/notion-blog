const _ = require('lodash');
const moment = require('moment');
const { withLeadingSlash } = require('ufo');
const Service = require('egg').Service;

const PAGE_SIZE = 30;
class BlogService extends Service {
  constructor(ctx) {
    super(ctx);
    this.DB_NAME_KEYS = this.config.dbNameKeys;
  }

  initTableIfNotExists() {
    const isExsits = this.app.db.prepare("SELECT * FROM sqlite_master WHERE type = 'table' AND name = 'blog'").get();
    const tableDDL = `
      CREATE TABLE blog (
        name TEXT PRIMARY KEY NOT NULL,
        data TEXT NOT NULL DEFAULT (''),
        last_sync_time TEXT
      );
    `;
    if (!isExsits) {
      this.logger.info('init blog table');
      this.app.db.prepare(tableDDL).run();
    }
  }

  getSiteInfo() {
    const { siteDomain: domain } = this.config;
    const data = this.getDataFromDatabaseByName(this.DB_NAME_KEYS.SITE_INFO);
    const siteInfo = Object.assign({}, data || {}, {
      domain,
    });
    return siteInfo;
  }

  insertBlogDatabase(name, value) {
    const stmt = this.app.db.prepare('INSERT INTO blog(name, data, last_sync_time) VALUES(?, ?, ?) ON CONFLICT (name) DO UPDATE SET data = excluded.data, last_sync_time = excluded.last_sync_time');
    stmt.run(name, JSON.stringify(value), moment().format('YYYY-MM-DD hh:mm:ss'));
  }

  getDataFromDatabaseByName(name) {
    const { data } = this.app.db.prepare('SELECT data FROM blog WHERE name = ?').get(name) || {};
    let json = null;
    try {
      json = JSON.parse(data || '');
    } catch (err) {
      json = null;
      this.ctx.logger.error(`JSON parse error. name: ${name}`);
    }
    return json;
  }

  deleteDatabaseRowByName(name) {
    this.app.db.prepare('DELETE FROM blog WHERE name = ?').run(name);
  }

  async realtimeFetchNotionPagePropertyToDatabaseByPostId(pageId) {
    const { POST_PROPERTY, PAGE_PROPERTY } = this.DB_NAME_KEYS;
    const properties = await this.ctx.service.notion.retrievePagePropertiesByPageId(pageId);
    if (!properties) {
      return null;
    }
    const { id, type } = properties;
    const dbNameKey = type === 'Page' ? PAGE_PROPERTY : POST_PROPERTY;
    this.ctx.service.blog.insertBlogDatabase(`${dbNameKey}/${id}`, properties);

    return properties;
  }
  // 实时获取 Post content blocks
  // 且如果图片是 Notion 上传，非自建图床，需要下载到本地，然后同步到图床
  async realtimeFetchNotionPageContentToDatabaseByPostId(pageId) {
    const { POST_CONTENT } = this.DB_NAME_KEYS;
    const blocks = await this.ctx.service.notion.retrieveBlockChildren(pageId);
    if (!blocks || blocks.length === 0) {
      return [];
    }
    this.insertBlogDatabase(`${POST_CONTENT}/${pageId}`, blocks);
    this.retrieveImageBlocksToDatabase(blocks);
    return blocks;
  }

  // 检索图片，并保存到 Db
  // 目的是把从 Notion 上传的图片转存至 Cloudflare 中
  // 为了效率问题，这里不实时转存，只保存到 Db
  // 然后通过定时任务，定时转存
  // https://developers.notion.com/reference/file-object
  retrieveImageBlocksToDatabase(blocks) {
    const { POST_FILE } = this.DB_NAME_KEYS;
    _.each(blocks, item => {
      const { type, id } = item;
      if (type === 'image' && item.image.type === 'file') {
        this.insertBlogDatabase(`${POST_FILE}/${id}`, id);
      }
    });
  }

  // 首页调用
  async listPosts(pageIndex = 1) {
    return this.listPostsWithCondition(pageIndex);
  }

  // /categories/xxx 页面调用
  async listPostsByCategoryName(categoryName, pageIndex = 1) {
    const filter = ', json_each(T1.categories) WHERE json_each.value = :categoryName';
    return this.listPostsWithCondition(pageIndex, filter, {
      categoryName,
    });
  }

  // /tags/xx 页面调用
  async listPostsByTagName(tagName, pageIndex = 1) {
    const filter = ', json_each(T1.tags) WHERE json_each.value = :tagName';
    return this.listPostsWithCondition(pageIndex, filter, {
      tagName,
    });
  }

  // 统一分页
  async listPostsWithCondition(pageIndex = 1, filter = '', filterValue = {}) {
    const pageSize = _.toInteger(this.app.cache.siteInfo.pageSize) || PAGE_SIZE;
    const { POST_PROPERTY } = this.DB_NAME_KEYS;
    // total
    const totalSQL = `
      SELECT DISTINCT T1.name, T1.data, T1.publishDate FROM (
        SELECT name, data, json_extract(data, '$.publishDate') AS publishDate, json_extract(data, '$.tags') AS tags, json_extract(data, '$.categories') AS categories
        FROM blog
        WHERE name LIKE '${POST_PROPERTY}/%'
      ) AS T1 ${filter}
    `;
    const totalSTMT = this.app.db.prepare(`
      SELECT COUNT(*) AS total FROM (
        ${totalSQL}
      )
    `);
    const { total } = totalSTMT.get({
      ...filterValue,
    });

    if (pageIndex < 1) {
      pageIndex = 1;
    }

    let hasMore = false;
    if (pageIndex * pageSize < total) {
      hasMore = true;
    }
    const data = {
      results: [],
      hasMore,
      totalPage: Math.ceil(total / pageSize),
    };

    const stmt = this.app.db.prepare(`
      SELECT * FROM (
        ${totalSQL}
      )
      ORDER BY publishDate DESC
      LIMIT :pageSize  OFFSET(:pageIndex * :pageSize)
    `);
    const response = stmt.all({
      pageIndex: pageIndex - 1,
      pageSize,
      ...filterValue,
    });
    data.results = _.map(response, item => {
      let json = {};
      try {
        json = JSON.parse(item.data);
      } catch (err) {
        json = {};
        this.ctx.logger.error(`JSON parse error. param: ${JSON.stringify({
          pageIndex,
          filter,
          filterValue,
        })} `);
      }
      return json;
    });
    return data;
  }

  // 通过 slug 获得 pageId
  // 目前 slug 仅限 page 页面使用, Post 页面不支持 slug
  async getPageIdBySlugInPageProperty(slug = '') {
    const { PAGE_PROPERTY } = this.DB_NAME_KEYS;
    const { name } = this.app.db.prepare(`SELECT name, json_extract(data, '$.slug') AS slug FROM blog WHERE NAME LIKE '${PAGE_PROPERTY}/%' AND slug = ?`).get(withLeadingSlash(slug)) || {};
    if (!name) {
      return null;
    }
    const [ , id ] = name.split('/');
    return id || '';
  }

  async blockToHtml(block) {
    const { ctx } = this;
    const { id, type, has_children } = block;
    const data = {
      id,
      ...block[type],
    };
    let html = '';
    switch (type) {
      case 'heading_1':
        html = await ctx.helper.renderTemplateView('h2', data);
        break;
      case 'heading_2':
        html = await ctx.helper.renderTemplateView('h3', data);
        break;
      case 'heading_3':
        html = await ctx.helper.renderTemplateView('h4', data);
        break;
      case 'paragraph':
      case 'quote':
      case 'numbered_list_item':
      case 'bulleted_list_item':
      case 'divider':
      case 'code':
      case 'image':
      case 'to_do':
      case 'table':
      case 'child_page':
        html = await ctx.helper.renderTemplateView(type, data);
        break;
      default:
    }

    if (has_children) {
      const { children } = block[type];
      const childHTML = await this.formatBlocksToHtml(children);
      html = html.replace(/<!--children--\>/ig, childHTML);
    }
    // 去掉不必要的注释
    html = html.replace(/<!--children--\>/ig, '');
    return html;
  }

  // https://developers.notion.com/reference/rich-text#text
  // blocks 数据格式为 HTML
  async formatBlocksToHtml(blocks = []) {
    const htmlResult = [];
    if (!blocks || blocks.length === 0) {
      return '';
    }
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const html = await this.blockToHtml(block);
      htmlResult.push(html);
    }
    return htmlResult.join('');
  }

  // 获得 PostInfo 详情，包含 property 和 content
  // 页面区分 Post 和 Page
  // Post property 使用 post-property ，Page 使用 page-property
  // 但不论是 Page 还是 Post ，内容是一样的
  // 所以 Page 不区分： page-content ，还是使用 post-content
  // 那为什么 property 要区分 Page 和 Post
  // 因为目前 slug 仅在 Page 中饰使用，需要根据 slug 获取 pageId
  // 所以为了 slug 区分了 page-property 和 post-property
  async getPostByPageId(pageId, isPage = false) {
    const { PAGE_PROPERTY, POST_PROPERTY, POST_CONTENT } = this.DB_NAME_KEYS;
    let properties = this.getDataFromDatabaseByName(`${isPage === true ? PAGE_PROPERTY : POST_PROPERTY}/${pageId}`);
    if (!properties) {
      // 实时请求 Notion 获得数据
      properties = await this.realtimeFetchNotionPagePropertyToDatabaseByPostId(pageId);
    }
    // 还不存在，真当不存在
    if (!properties) {
      return null;
    }
    let blocks = this.getDataFromDatabaseByName(`${POST_CONTENT}/${pageId}`);
    // 当 properties 存在，content 不存在时
    // 实时请求 Notion 获得数据
    if (!blocks) {
      blocks = await this.realtimeFetchNotionPageContentToDatabaseByPostId(pageId);
    }
    const htmlContent = await this.formatBlocksToHtml(blocks);

    const postInfo = {
      ...properties,
      content: htmlContent,
    };

    return postInfo;
  }

  // 更新页面浏览数
  async updatePostViewsByPageId(pageId, views = 0) {
    await this.ctx.service.notion.updatePageProperties(pageId, {
      views: {
        number: views,
      },
    });
  }

  // 更新图片地址为自建图床URL
  async updateImageUrlByBlockId(blockId, url) {
    const response = await this.ctx.service.notion.updateBlock(blockId, {
      image: {
        external: {
          url,
        },
      },
    });
    return response;
  }
}
module.exports = BlogService;
