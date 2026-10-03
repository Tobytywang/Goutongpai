// 图片选择 + 压缩 + base64 编码，返回可直接传给后端 /api/players/:id/avatar 的 data URL
// 复刻 Web 端 canvas 压缩思路：先 compressImage 压到 <=400px / 质量 70，再读成 base64
const { BASE } = require('./request');

/**
 * 选一张图，压缩后转成 data URL。
 * @param {Object} opts { maxSide=400, quality=70 }
 * @returns {Promise<string>} data:image/xxx;base64,....
 */
function chooseImageAsDataUrl(opts = {}) {
  const maxSide = opts.maxSide || 400;
  const quality = opts.quality || 70;

  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: (res) => {
        const temp = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath;
        if (!temp) {
          reject(new Error('未选择到图片'));
          return;
        }
        wx.compressImage({
          src: temp,
          quality,
          compressedWidth: maxSide,
          success: (cres) => {
            const out = cres.tempFilePath;
            // compressImage 输出可能是 jpg / webp / png，按扩展名决定 mime，避免服务端拒收
            const ext = (out.split('.').pop() || 'jpg').toLowerCase();
            const mime =
              ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
            wx.getFileSystemManager().readFile({
              filePath: out,
              encoding: 'base64',
              success: (r) => resolve('data:' + mime + ';base64,' + r.data),
              fail: (e) => reject(new Error((e && e.errMsg) || '读取图片失败')),
            });
          },
          fail: (e) => reject(new Error((e && e.errMsg) || '压缩图片失败')),
        });
      },
      fail: (e) => reject(new Error((e && e.errMsg) || '选择图片失败')),
    });
  });
}

module.exports = { chooseImageAsDataUrl, BASE };
