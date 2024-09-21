/* eslint valid-jsdoc: "off" */
const path = require('node:path');
/**
 * @param {Egg.EggAppInfo} appInfo app info
 */
module.exports = appInfo => {
  /**
   * built-in config
   * @type {Egg.EggAppConfig}
   **/
  const config = exports = {};

  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + '_1725678580974_1080';

  config.timezone = '+08:00';

  config.onerror = {
    // 线上发生异常时，重定向到此页面
    errorPageUrl: '/500.html',
  };

  config.view = {
    root: [
      path.join(appInfo.baseDir, 'app/view'),
      path.join(appInfo.baseDir, 'themes'),
    ].join(','),
    defaultViewEngine: 'nunjucks',
    defaultExtension: '.html',
  };

  // add your middleware config here
  config.middleware = [ 'notfoundHandler' ];

  config.static = {
    prefix: '/public/',
    dirs: [{
      prefix: '/public',
      dir: path.join(appInfo.baseDir, 'public'),
    }, {
      prefix: '/themes',
      dir: path.join(appInfo.baseDir, 'themes'),
    }],
  };

  // add your user config here
  const userConfig = {
    // 下面不可更改
    dbFile: `${appInfo.baseDir}/data/data.db`,
    dbNameKeys: {
      SITE_INFO: 'site-info',
      PAGE_PROPERTY: 'page-property',
      POST_PROPERTY: 'post-property',
      POST_CONTENT: 'post-content',
      POST_FILE: 'post-file',
    },
    // 下面这些可以根据环境设置
    notionAppKey: process.env.NOTION_APP_KEY || '',
    notionDatabaseId: process.env.NOTION_DATABASE_ID || '',
    siteDomain: process.env.SITE_DOMAIN || '',
  };

  return {
    ...config,
    ...userConfig,
  };
};
