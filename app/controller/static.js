const _ = require('lodash');
const { Controller } = require('egg');
const { parseURL } = require('ufo');
const fs = require('fs-extra');
const CleanCSS = require('clean-css');

class StaticController extends Controller {
  async serverError() {
    const { ctx } = this;
    await ctx.render('500.html');
  }

  async sitemapXML() {
    const { ctx, app } = this;
    const fileName = `${app.baseDir}/sitemap.xml`;
    let content = null;
    try {
      content = await this.readFile(fileName);
    } catch (err) {
      ctx.logger.error(err);
    }
    ctx.body = content || '';
    ctx.set('content-type', 'application/xml');
  }

  async robotsTXT() {
    const { ctx, app } = this;
    const fileName = `${app.baseDir}/robots.txt`;
    let content = null;
    try {
      content = await this.readFile(fileName);
    } catch (err) {
      ctx.logger.error(err);
    }
    ctx.body = content || '';
  }

  // 合并 js/css 减少网络请求
  async combine() {
    const { ctx, app } = this;
    const { url: rawURL } = ctx.request;
    const normalURL = _.replace(rawURL, '/combine/??', '');
    const { pathname } = parseURL(normalURL);
    const fileNames = _.split(pathname, ',').map(file => `${app.baseDir}/${file}`);
    // /combine/??public/styles/notion-block.css,public/styles/prism.css,theme/simple/assets/style.css,xx.css
    // /combine/??public/scripts/alpine.js
    const isCSS = pathname.indexOf('.css') > 0;
    const contentType = isCSS ? 'text/css' : 'application/javascript';

    let fileContent = app.cache.combineFile[normalURL];
    if (!fileContent) {
      fileContent = await this.readAssetsFiles(fileNames, isCSS);
      app.cache.combineFile[normalURL] = fileContent;
    }
    ctx.body = fileContent;
    ctx.set('content-type', contentType);
  }

  async readAssetsFiles(fileNames, isCSS) {
    const { ctx } = this;
    const contentArray = [];
    for (let i = 0; i < fileNames.length; i++) {
      const fileName = _.trim(fileNames[i]);
      if (!fileName) {
        continue;
      }
      try {
        const content = await this.readFile(fileName);
        if (content) {
          contentArray.push(content);
        }
      } catch (err) {
        ctx.logger.error(err);
      }
    }
    let result = contentArray.join('');
    if (isCSS) {
      result = new CleanCSS().minify(result).styles;
    }
    return result;
  }

  async readFile(filePath) {
    const exists = await fs.pathExists(filePath);
    if (!exists) {
      return null;
    }
    return await fs.readFile(filePath, 'utf8');
  }
}

module.exports = StaticController;
