const _ = require('lodash');
const { Controller } = require('egg');


class BaseController extends Controller {

  async renderView(viewName, params = {}) {
    const siteInfo = this.app.cache.siteInfo;
    const options = Object.assign({}, params, {
      site: siteInfo,
    });
    await this.ctx.render(`simple/${viewName}`, options);
  }

  setPostViewsCache(pageId) {
    const prevData = this.app.cache.postViews || {};
    const views = (prevData[pageId] || 0) + 1;
    this.app.cache.postViews[pageId] = views;
  }

  buildPagination(urlPrefix = '', pageIndex = 1, hasMore = false) {
    let prevHref = '';
    let nextHref = '';
    const prevPageIndex = _.toInteger(pageIndex) - 1;
    const nextPageIndex = _.toInteger(pageIndex) + 1;

    if (prevPageIndex < 1) {
      prevHref = '';
    } else {
      prevHref = `${urlPrefix}/page/${prevPageIndex}`;
    }

    if (hasMore) {
      nextHref = `${urlPrefix}/page/${nextPageIndex}`;
    }
    return {
      prevHref,
      nextHref,
    };
  }
}

class HomeController extends BaseController {
  async index() {
    const { pageIndex = 1 } = this.ctx.params;
    const { results: posts, hasMore } = await this.ctx.service.blog.listPosts(pageIndex);
    const { prevHref, nextHref } = this.buildPagination('', pageIndex, hasMore);

    await this.renderView('index', {
      posts,
      prevHref,
      nextHref,
      hasMore,
    });
  }

  async categories() {
    const { slug, pageIndex = 1 } = this.ctx.params;
    const { results: posts, hasMore } = await this.ctx.service.blog.listPostsByCategoryName(slug);
    const { prevHref, nextHref } = this.buildPagination(`/categories/${slug}`, pageIndex, hasMore);

    await this.renderView('category', {
      categoryName: slug,
      posts,
      prevHref,
      nextHref,
      hasMore,
    });
  }

  async tags() {
    const { slug, pageIndex = 1 } = this.ctx.params;
    const { results: posts, hasMore } = await this.ctx.service.blog.listPostsByTagName(slug);
    const { prevHref, nextHref } = this.buildPagination(`/tags/${slug}`, pageIndex, hasMore);

    await this.renderView('tag', {
      tagName: slug,
      posts,
      prevHref,
      nextHref,
      hasMore,
    });
  }

  async post() {
    const { pageId } = this.ctx.params;
    const post = await this.ctx.service.blog.getPostByPageId(pageId);
    if (!post.id) {
      this.ctx.status === 404;
      this.ctx.bogy = null;
      return;
    }
    this.setPostViewsCache(pageId);
    await this.renderView('post', {
      post,
    });
  }

  async page() {
    const { slug } = this.ctx.params;
    const pageId = await this.ctx.service.blog.getPageIdBySlugInPageProperty(slug);
    if (!pageId) {
      this.ctx.status === 404;
      this.ctx.bogy = null;
      return;
    }

    this.setPostViewsCache(pageId);
    const post = await this.ctx.service.blog.getPostByPageId(pageId, true);
    await this.renderView('page', {
      post,
    });
  }
}

module.exports = HomeController;
