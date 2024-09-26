const _ = require('lodash');
const { Controller } = require('egg');

class TestController extends Controller {
  async index() {
    this.ctx.body = 'hello,world..';
  }
}

module.exports = TestController;
