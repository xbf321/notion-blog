const _ = require('lodash');
const Service = require('egg').Service;

const SITE_PROPERTY_RULE = {
  title: item => _.map(item, child => child.plain_text).join(''),
  description: item => _.map(item, child => child.plain_text).join(''),
  icon: item => item.external.url,
  tags: item => item.multi_select.options.map(child => _.pick(child, [ 'name', 'color' ])),
  categories: item => item.multi_select.options.map(child => _.pick(child, [ 'name', 'color' ])),
};

const POST_PROPERTY_RULE = {
  categories: item => item.multi_select.map(child => child.name),
  tags: item => item.multi_select.map(child => child.name),
  type: item => item.select.name || '',
  publishDate: item => (item.date && item.date.start) || '',
  slug: item => item.rich_text.map(child => child.plain_text).join(''),
  summary: item => item.rich_text.map(child => child.plain_text).join(''),
  title: item => item.title.map(child => child.plain_text).join(''),
  views: item => item.number || 0,
};

class NotionService extends Service {
  // 过滤站点菜单
  // 目前只支持一级
  async retrieveMenusAndConfig() {
    const { app } = this;
    this.ctx.logger.info('service.notion -> retrieveMenus');
    const { results } = await this.queryDatabase({
      databaseId: app.config.notionDatabaseId,
      filter: {
        and: [{
          or: [{
            property: 'type',
            select: {
              equals: 'Menu',
            },
          }, {
            property: 'type',
            select: {
              equals: 'Config',
            },
          }],
        }, {
          property: 'status',
          select: {
            equals: 'Published',
          },
        }],
      },
      sorts: [{
        property: 'publishDate',
        direction: 'ascending',
      }],
    });
    const rule = {
      title: item => _.map(item.title, child => child.plain_text).join(''),
      slug: item => _.map(item.rich_text, child => child.plain_text).join(''),
      type: item => item.select && item.select.name || '',
    };
    const filterValue = [];
    _.each(results, item => {
      const { id } = item;
      const info = {
        id,
      };
      _.each(item.properties, (value, key) => {
        if (rule[key]) {
          info[key] = rule[key](value);
        }
      });
      filterValue.push(info);
    });
    const notionConfigPageId = _.find(filterValue, item => item.type === 'Config');
    const notionConfig = await this.retrieveConfig((notionConfigPageId && notionConfigPageId.id) || '');
    const menus = _.filter(filterValue, item => item.type === 'Menu').map(item => {
      return {
        slug: item.slug,
        title: item.title,
      };
    });
    return {
      menus,
      config: notionConfig,
    };
  }

  // 1. 根据 pageId 查询 blocks
  // 2. 从 blocks 中找到 database_id
  // 3. 根据 databas_id 查询配置项
  async retrieveConfig(pageId) {
    this.ctx.logger.info('service.notion -> retrieveConfig', pageId);
    const blocks = await this.retrieveBlockChildren(pageId);
    const databaseBlock = _.find(blocks, item => item.type === 'child_database');
    if (!databaseBlock) {
      return {};
    }
    const { id: databaseId } = databaseBlock;
    const { results } = await this.queryDatabase({
      databaseId,
    });
    const config = {};
    if (results.length === 0) {
      return config;
    }
    const rule = {
      key: item => _.map(item.title, child => child.plain_text).join(''),
      enabled: item => item.checkbox,
      value: item => _.map(item.rich_text, child => child.plain_text).join(''),
    };
    _.each(results, item => {
      const info = {};
      _.each(item.properties, (value, key) => {
        if (rule[key]) {
          info[key] = rule[key](value);
        }
      });
      const { enabled, key, value } = info;
      // 如果 某项禁用，value 直接为空
      // 好处是在调用时，只需要 siteInfo.pageSize ，而不是 siteInfo.pageSize.value
      config[key] = enabled === true ? value : '';
    });
    return config;
  }

  // 过滤站点信息
  async retrieveSiteInfo() {
    this.ctx.logger.info('service.notion -> retrieveSiteInfo');
    const { config } = this;
    const result = {};
    const response = await this.retrieveDatabase(config.notionDatabaseId);
    const { properties } = response;
    // response 和 properties 都有 title 属性
    // 必须先遍历 properties，在遍历 response
    // 否则会出现 title 覆盖的情况
    _.each(properties, (value, key) => {
      if (SITE_PROPERTY_RULE[key]) {
        result[key] = SITE_PROPERTY_RULE[key](value);
      }
    });
    _.each(response, (value, key) => {
      if (SITE_PROPERTY_RULE[key]) {
        result[key] = SITE_PROPERTY_RULE[key](value);
      }
    });
    return result;
  }

  async retrieveDatabase(databaseId) {
    const response = await this.app.notion.databases.retrieve({ database_id: databaseId });
    return response;
  }

  async queryDatabase(options = {}) {
    const { databaseId, startCursor = undefined, pageSize = 100, filter = undefined, sorts = undefined } = options;
    const response = await this.app.notion.databases.query({
      database_id: databaseId,
      page_size: pageSize,
      start_cursor: startCursor,
      filter,
      sorts,
    });
    return response;
  }

  async queryPages(startCursor = undefined, pageSize = 10) {
    this.ctx.logger.info('service.notion -> queryPages');
    const { config } = this;
    // 默认全部 Posts
    const filter = {
      and: [{
        or: [{
          property: 'type',
          select: {
            equals: 'Post',
          },
        }, {
          property: 'type',
          select: {
            equals: 'Page',
          },
        }],
      }, {
        property: 'status',
        select: {
          equals: 'Published',
        },
      }],
    };
    const { results: rawResult, next_cursor, has_more } = await this.queryDatabase({
      databaseId: config.notionDatabaseId,
      pageSize,
      startCursor,
      filter,
      sorts: [{
        property: 'publishDate',
        direction: 'descending',
      }],
    });
    const list = {
      results: [],
      next_cursor,
      has_more,
    };
    _.each(rawResult, item => {
      const { id, properties } = item;
      const postInfo = {
        id,
      };
      _.each(properties, (value, key) => {
        if (POST_PROPERTY_RULE[key]) {
          postInfo[key] = POST_PROPERTY_RULE[key](value);
        }
      });
      postInfo.href = postInfo.slug ? `${config.siteDomain}/${postInfo.slug}` : `${config.siteDomain}/archives/${postInfo.id}`;
      list.results.push(postInfo);
    });
    return list;
  }

  async updatePageProperties(pageId, data = {}) {
    this.ctx.logger.info('service.notion -> updatePageProperties');
    const params = {
      page_id: pageId,
      properties: {
        ...data,
      },
    };
    const response = await this.app.notion.pages.update(params);
    return response;
  }

  async updateBlock(blockId, body = {}) {
    const param = {
      block_id: blockId,
      ...body,
    };
    const response = await this.app.notion.blocks.update(param);
    return response;
  }

  async retrieveBlockInfo(blockId) {
    this.ctx.logger.info('service.notion -> retrieveBlockInfo');
    const response = await this.app.notion.blocks.retrieve({
      block_id: blockId,
    });
    return response;
  }

  // 页面也是 block
  // A page ID can be passed as a block ID: https://developers.notion.com/docs/working-with-page-content#modeling-content-as-blocks
  async retrieveBlockChildren(blockId) {
    this.ctx.logger.info('service.notion -> retrieveBlockChildren');
    const { results: blocks } = await this.app.notion.blocks.children.list({
      block_id: blockId,
    });
    if (blocks.length === 0) {
      return [];
    }
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const { id, type } = block;
      // 处理 Table
      if (type === 'table') {
        block.table.rows = [];
        const tableRowBlocks = await this.retrieveBlockChildren(id);
        _.each(tableRowBlocks, tableRowBlock => {
          const { id: tableRowId, table_row: tableRow } = tableRowBlock;
          if (tableRow) {
            block.table.rows.push({
              id: tableRowId,
              cells: tableRow.cells || [],
            });
          }
        });
      }
    }
    this.modifyNumberedListObject(blocks);
    return blocks;
  }

  // 针对 NumberedList 增加有序序号
  modifyNumberedListObject(blocks) {
    let numberedListIndex = 0;
    _.each(blocks, item => {
      const { type } = item;
      if (type === 'numbered_list_item') {
        item.numbered_list_item.number = ++numberedListIndex;
      } else {
        numberedListIndex = 0;
      }
    });
  }

  // 检索页面 Property
  async retrievePagePropertiesByPageId(pageId) {
    const response = await this.app.notion.pages.retrieve({ page_id: pageId });
    const postInfo = {};
    if (!response || !response.properties) {
      return postInfo;
    }

    _.each(response.properties, (value, key) => {
      if (POST_PROPERTY_RULE[key]) {
        postInfo[key] = POST_PROPERTY_RULE[key](value);
      }
    });
    return postInfo;
  }
}
module.exports = NotionService;
