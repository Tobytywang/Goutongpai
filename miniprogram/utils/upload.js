// 图片选择 + 压缩 + base64 编码，返回可直接传给后端 /api/players/:id/avatar|photo 的 data URL
// 复刻 Web 端 canvas 压缩思路：先 compressImage 压到 <=maxSide / 质量 quality，再读成 base64
const { BASE, post } = require('./request');

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

/**
 * 选图 → 压缩 → 上传到玩家头像或背景图。
 * 复用服务端 /api/players/:id/:kind（kind = 'avatar' | 'photo'），与 Web 端互通。
 * @param {number|string} id 玩家 id
 * @param {'avatar'|'photo'} kind 头像 / 背景
 * @param {Object} opts { maxSide, quality }
 * @returns {Promise<string>} 上传后的 data URL
 */
async function uploadPlayerImage(id, kind, opts = {}) {
  const maxSide = opts.maxSide || (kind === 'photo' ? 800 : 400);
  const quality = opts.quality || 70;
  const dataUrl = await chooseImageAsDataUrl({ maxSide, quality });
  await post('/api/players/' + id + '/' + kind, { dataUrl });
  return dataUrl;
}

/**
 * 选图 → 压缩 → 上传到赛季背景图。
 * 复用服务端 /api/seasons/:id/photo（与玩家背景图同一套落盘 + 旧图清理逻辑）。
 * @param {number|string} id 赛季 id
 * @param {Object} opts { maxSide=800, quality=75 }
 * @returns {Promise<string>} 上传后的 data URL
 */
async function uploadSeasonImage(id, opts = {}) {
  const maxSide = opts.maxSide || 800;
  const quality = opts.quality || 75;
  const dataUrl = await chooseImageAsDataUrl({ maxSide, quality });
  await post('/api/seasons/' + id + '/photo', { dataUrl });
  return dataUrl;
}

module.exports = { chooseImageAsDataUrl, uploadPlayerImage, uploadSeasonImage, BASE };
