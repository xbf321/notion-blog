// 官方 client
const { Client, LogLevel } = require('@notionhq/client');
const Database = require('better-sqlite3');

const NOTION = Symbol('Application#notion');
const SQLITE = Symbol('Application#sqlite');
const CACHE = Symbol('Application#cache');

module.exports = {
  get notion() {
    // this 是 app 对象，在其中可以调用 app 上的其他方法，或访问属性
    const auth = this.config.notionAppKey;
    if (!this[NOTION]) {
      if (!auth) {
        this.logger.error('notion auth is empty');
        return;
      }
      this[NOTION] = new Client({
        auth,
        logLevel: LogLevel.INFO,
      });
    }
    return this[NOTION];
  },
  get db() {
    const { dbFile } = this.config;
    if (!this[SQLITE]) {
      const db = new Database(dbFile, { verbose: console.log });
      db.pragma('journal_mode = WAL');
      this[SQLITE] = db;
    }
    return this[SQLITE];
  },
  // 自定义缓存
  // 提高加载效率
  get cache() {
    if (!this[CACHE]) {
      this[CACHE] = {
        siteInfo: {},
        // 页面浏览数
        postViews: {},
        // 合并静态资源
        combineFile: {},
      };
    }
    return this[CACHE];
  },
};
