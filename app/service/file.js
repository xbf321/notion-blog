const fs = require('fs-extra');
const download = require('download');
const { parseFilename } = require('ufo');
const Service = require('egg').Service;

class FileService extends Service {
  // 下载失败，返回 null
  // 下载成功，返回 新文件名
  async downloadFileToDisk(id, fileUrl) {
    const filesDir = `${this.app.baseDir}/.files`;
    await fs.ensureDir(filesDir, {
      mode: 0o2775,
    });
    const fileName = parseFilename(fileUrl, { strict: true });
    let renameFileName = `notion-${id}-${fileName}`;
    try {
      await download(fileUrl, filesDir, { filename: renameFileName });
    } catch (err) {
      this.ctx.logger.error(err);
      renameFileName = null;
    }
    return renameFileName;
  }
}
module.exports = FileService;
