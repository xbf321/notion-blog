/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  // 一定要注意路由顺序
  const { router, controller } = app;

  // schedule-manual
  router.get('/schedule-manual/init', controller.scheduleManual.init);
  router.get('/schedule-manual/siteInfo', controller.scheduleManual.siteInfo);
  router.post('/schedule-manual/siteInfo', controller.scheduleManual.siteInfo);
  router.get('/schedule-manual/buildSitemapXML', controller.scheduleManual.buildSitemapXML);
  router.get('/schedule-manual/listPosts', controller.scheduleManual.listPosts);
  router.post('/schedule-manual/listPosts', controller.scheduleManual.listPosts);
  router.post('/schedule-manual/listPostsContent', controller.scheduleManual.listPostsContent);

  // 静态文件路由
  router.get('/combine', controller.static.combine);
  router.get('/500.html', controller.static.serverError);
  router.get('/sitemap.xml', controller.static.sitemapXML);
  router.get('/robots.txt', controller.static.robotsTXT);

  // post
  router.get('/archives/:pageId', controller.home.post);
  router.get('/categories/:slug/page/:pageIndex', controller.home.categories);
  router.get('/categories/:slug', controller.home.categories);
  router.get('/tags/:slug/page/:pageIndex', controller.home.tags);
  router.get('/tags/:slug', controller.home.tags);
  router.get('/page/:pageIndex', controller.home.index);

  // custome page
  router.get('/:slug', controller.home.page);

  // index
  router.get('/', controller.home.index);
};
