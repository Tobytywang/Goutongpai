/* 后端接口封装 */

async function request(method, path, body) {
  // 网页端只读：任何写操作在出发前就被拦下，避免收到后端 403
  if ((method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH') && window.__WEB_READONLY__) {
    throw new Error('网页端为只读模式，写入操作请使用小程序');
  }
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(path, options);
  } catch (err) {
    throw new Error('无法连接到服务器，请确认服务已启动');
  }

  let payload = {};
  try {
    payload = await res.json();
  } catch (_) {
    /* 非 JSON 响应 */
  }

  if (!res.ok || payload.ok === false) {
    throw new Error(payload.error || `请求失败（HTTP ${res.status}）`);
  }
  return payload.data;
}

export const api = {
  bootstrap: () => request('GET', '/api/bootstrap'),

  createPlayer: (data) => request('POST', '/api/players', data),
  updatePlayer: (id, data) => request('PUT', `/api/players/${id}`, data),
  deletePlayer: (id) => request('DELETE', `/api/players/${id}`),
  uploadPlayerImage: (id, kind, dataUrl) => request('POST', `/api/players/${id}/${kind}`, { dataUrl }),

  createSeason: (data) => request('POST', '/api/seasons', data),
  updateSeason: (id, data) => request('PUT', `/api/seasons/${id}`, data),
  deleteSeason: (id) => request('DELETE', `/api/seasons/${id}`),

  createMatch: (data) => request('POST', '/api/matches', data),
  deleteMatch: (id) => request('DELETE', `/api/matches/${id}`),

  createHighlight: (data) => request('POST', '/api/highlights', data),
  updateHighlight: (id, data) => request('PUT', `/api/highlights/${id}`, data),
  deleteHighlight: (id) => request('DELETE', `/api/highlights/${id}`),
};
