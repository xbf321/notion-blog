const _ = require('lodash');
const PAGE_ID_REGEX = /\b([a-f0-9]{32})\b/;

module.exports = {
  async renderTemplateView(viewName, data) {
    const { ctx } = this;
    const tplPath = `block/${viewName}.nj`;
    return await ctx.renderView(tplPath, data);
  },

  colorNameToCss(colorName) {
    const colorNameMap = {
      gray: 'rgba(120, 119, 116, 1)',
      brown: 'rgba(159, 107, 83, 1)',
      orange: 'rgba(199, 125, 72, 1)',
      yellow: 'rgba(203, 145, 47, 1)',
      green: 'rgba(68, 131, 97, 1)',
      blue: 'rgba(51, 126, 169, 1)',
      purple: 'rgba(144, 101, 176, 1)',
      pink: 'rgba(193, 76, 138, 1)',
      red: 'rgba(223, 84, 82, 1)',
      default: '',
    };
    return colorNameMap[colorName];
  },

  annotationsToCss(annotations) {
    const styleMap = {
      bold: 'font-weight: 800',
      italic: 'font-style: italic',
      underline: 'border-bottom: 0.05em solid',
      strikethrough: 'text-decoration:line-through',
    };

    const picked = _.pickBy(annotations);
    const styleResult = [];
    _.each(picked, (value, key) => {
      if (key === 'color') {
        const colorWithCSS = this.colorNameToCss(value);
        if (colorWithCSS) {
          styleResult.push(`${key}: ${colorWithCSS}`);
        }
      } else {
        styleResult.push(styleMap[key]);
      }
    });
    return _.remove(styleResult, item => !!item).join(';');
  },

  isPageId(id) {
    const match = id.match(PAGE_ID_REGEX);
    return match;
  },

  async useLRUCache(instance, key, fetchFn) {
    const lru = this.app.lru.get(instance);
    let cacheData = lru.get(key);
    if (!cacheData) {
      cacheData = await fetchFn();
      lru.set(key, cacheData);
    }
    return cacheData;
  },

  addTabSpace(text, n = 0) {
    const tab = ' ';
    for (let i = 0; i < n; i++) {
      if (text.includes('\n')) {
        const multiLineText = text.split(/(?:^|\n)/).join(`\n${tab}`);
        text = tab + multiLineText;
      } else text = tab + text;
    }
    return text;
  },
};
