const _ = require('lodash');
const { Controller } = require('egg');

class TestController extends Controller {
  async index() {
    const { ctx } = this;
    ctx.body = 'hello,world..';
  }
}

module.exports = TestController;
