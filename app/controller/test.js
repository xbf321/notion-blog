const _ = require('lodash');
const { Controller } = require('egg');

class TestController extends Controller {
  async index() {
    this.ctx.body = 'hello,world..';
    // await this.ctx.render('block-test', {
    //   content,
    // });
  }
}

module.exports = TestController;
