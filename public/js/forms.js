/* 复用型表单弹窗：新建玩家 / 新建赛季 / 选图 */

import { store } from './store.js';
import { api } from './api.js';
import { h, formModal, notifyOk, notifyErr, compressImage, confirmDialog, IMAGE_PRESETS, fmtBytes, describeImage } from './util.js';

/** 弹出系统文件选择框，压缩后返回 { dataUrl, width, height }，取消返回 null */
export function pickImage(opts = {}) {
  return new Promise((resolve) => {
    const input = h('input', {
      type: 'file',
      accept: 'image/png,image/jpeg,image/webp,image/gif',
      style: { display: 'none' },
    });
    document.body.append(input);

    // settled 守卫：change / cancel / 兜底清理三者只会结算一次
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      if (document.body.contains(input)) input.remove();
      resolve(value);
    };

    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return done(null);
      try {
        done(await compressImage(file, opts));
      } catch (err) {
        notifyErr(err.message || '图片处理失败');
        done(null);
      }
    });
    // 用户取消选择：部分浏览器触发 cancel 而非 change（此时既无文件也不应残留节点）
    input.addEventListener('cancel', () => done(null));
    // 兜底：极端情况下既无 change 也无 cancel，定时移除隐藏节点避免泄漏
    setTimeout(() => {
      if (!settled && document.body.contains(input)) input.remove();
    }, 10 * 60 * 1000);

    input.click();
  });
}

/* ---------------------------------------------------------------- 玩家 */

export function promptNewPlayer({ onCreated, defaults = {} } = {}) {
  return new Promise((resolve) => {
    const m = formModal({
      title: '新增玩家',
      submitText: '创建玩家',
      fields: [
        { name: 'name', label: '昵称 *', value: defaults.name || '', placeholder: '例如：老王（最多6个字）', maxlength: '6' },
        {
          name: 'bio',
          label: '个性签名',
          type: 'textarea',
          full: true,
          rows: 2,
          value: '',
          placeholder: '口头禅、性格特点、名场面……',
        },
      ],
      onSubmit: async (values) => {
        if (!values.name) throw new Error('昵称不能为空');
        if (values.name.length > 6) throw new Error('昵称最多6个字符');
        const player = await api.createPlayer(values);
        await store.load();
        notifyOk(`已创建玩家「${player.name}」，可到「玩家」页上传头像与照片`);
        m.close();
        if (onCreated) onCreated(player);
        resolve(player);
      },
    });
  });
}

/* ---------------------------------------------------------------- 赛季 */

export function promptNewSeason({ onCreated } = {}) {
  return new Promise((resolve) => {
    const today = new Date();
    const p = (n) => String(n).padStart(2, '0');
    const defaultName = `${today.getFullYear()} 第 ${today.getMonth() + 1} 赛季`;

    const m = formModal({
      title: '新建赛季',
      submitText: '创建赛季',
      fields: [
        { name: 'name', label: '赛季名称 *', value: defaultName, placeholder: '例如：2026 秋季赛（最多8个字）', maxlength: '8' },
        {
          name: 'started_on',
          label: '开始日期',
          type: 'date',
          value: `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`,
        },
        { name: 'note', label: '赛季说明', type: 'textarea', full: true, rows: 2, placeholder: '赛制、参与人数、奖励……' },
      ],
      onSubmit: async (values) => {
        if (!values.name) throw new Error('赛季名称不能为空');
        if (values.name.length > 8) throw new Error('赛季名称最多8个字符');
        const season = await api.createSeason(values);
        await store.load();
        store.setSeason(season.id);
        notifyOk(`已创建「${season.name}」并切换为当前赛季`);
        m.close();
        if (onCreated) onCreated(season);
        resolve(season);
      },
    });
  });
}

/* ---------------------------------------------------------------- 赛季编辑 */

export function promptEditSeason(season) {
  return new Promise((resolve) => {
    const m = formModal({
      title: `编辑赛季 · ${season.name}`,
      submitText: '保存',
      fields: [
        { name: 'name', label: '赛季名称 *', value: season.name, maxlength: '8' },
        {
          name: 'status',
          label: '状态',
          type: 'select',
          value: season.status,
          options: [
            { value: 'active', label: '进行中' },
            { value: 'archived', label: '已归档' },
          ],
          tip: '归档后仍可查看，但不会作为默认当前赛季推荐',
        },
        { name: 'started_on', label: '开始日期', type: 'date', value: season.started_on || '' },
        { name: 'ended_on', label: '结束日期', type: 'date', value: season.ended_on || '' },
        { name: 'note', label: '赛季说明', type: 'textarea', full: true, rows: 2, value: season.note || '' },
      ],
      onSubmit: async (values) => {
        if (!values.name) throw new Error('赛季名称不能为空');
        if (values.name.length > 8) throw new Error('赛季名称最多8个字符');
        await api.updateSeason(season.id, values);
        await store.load();
        notifyOk('赛季已更新');
        m.close();
        resolve(true);
      },
    });
  });
}

/* ---------------------------------------------------------------- 玩家编辑 */

export function promptEditPlayer(player) {
  return new Promise((resolve) => {
    const m = formModal({
      title: `编辑玩家 · ${player.name}`,
      submitText: '保存',
      fields: [
        { name: 'name', label: '昵称 *', value: player.name, maxlength: '6' },
        { name: 'bio', label: '个性签名', type: 'textarea', full: true, rows: 3, value: player.bio || '' },
      ],
      onSubmit: async (values) => {
        if (!values.name) throw new Error('昵称不能为空');
        if (values.name.length > 6) throw new Error('昵称最多6个字符');
        await api.updatePlayer(player.id, values);
        await store.load();
        notifyOk('玩家资料已更新');
        m.close();
        resolve(true);
      },
    });
  });
}

/* ---------------------------------------------------------------- 高光 */

export function promptNewHighlight({ defaults = {} } = {}) {
  return new Promise((resolve) => {
    const seasonOptions = [
      { value: '', label: '不关联赛季' },
      ...store.seasons.map((s) => ({ value: String(s.id), label: s.name })),
    ];
    const matchOptions = [
      { value: '', label: '不关联对局（赛后补录）' },
      ...store.matches
        .filter((m) => !store.currentSeasonId || m.season_id === store.currentSeasonId)
        .map((m) => ({ value: String(m.id), label: `#${m.id} · ${(m.played_at || '').slice(0, 10)}` })),
    ];

    const checkedPlayers = new Set(Array.isArray(defaults.player_ids) ? defaults.player_ids : []);
    const playerCheckWrap = h(
      'div',
      { class: 'check-grid' },
      store.players.map((p) => {
        const cb = h('input', {
          type: 'checkbox',
          value: String(p.id),
          checked: checkedPlayers.has(p.id),
          onchange: (e) => {
            if (e.target.checked) checkedPlayers.add(p.id);
            else checkedPlayers.delete(p.id);
          },
        });
        return h('label', { class: 'check' }, cb, h('span', {}, p.name));
      })
    );
    const playerField = h(
      'div',
      { class: 'field field--full' },
      h('label', {}, '参与玩家（可多选）'),
      playerCheckWrap
    );

    let imageData = null;
    const preview = h(
      'div',
      { class: 'uploader__preview' },
      h('span', {}, '🖼')
    );
    // 提示行：先说明加工策略，选完图后换成实测的「压缩前 → 压缩后」
    const hint = h(
      'div',
      { class: 'uploader__hint' },
      `自动压缩到 ${IMAGE_PRESETS.figure.maxSide}px / ${fmtBytes(IMAGE_PRESETS.figure.maxBytes)} 以内，支持 PNG·JPG·WebP·GIF`
    );

    const imageField = h(
      'div',
      { class: 'field field--full' },
      h('label', {}, '现场图片（可选）'),
      h(
        'div',
        { class: 'uploader' },
        preview,
        h(
          'div',
          {},
          h(
            'button',
            {
              class: 'btn btn--sm',
              type: 'button',
              onclick: async () => {
                const picked = await pickImage(IMAGE_PRESETS.figure);
                if (!picked) return;
                imageData = picked.dataUrl;
                preview.innerHTML = '';
                preview.append(h('img', { src: picked.dataUrl, alt: '高光图片预览' }));
                clearBtn.style.display = '';
                hint.textContent = `已加工：${describeImage(picked)}`;
              },
            },
            '选择图片'
          ),
          hint
        )
      )
    );

    const clearBtn = h(
      'button',
      {
        class: 'btn btn--sm btn--ghost',
        type: 'button',
        style: { display: 'none' },
        onclick: () => {
          imageData = null;
          preview.innerHTML = '';
          preview.append(h('span', {}, '🖼'));
          clearBtn.style.display = 'none';
        },
      },
      '移除'
    );
    imageField.querySelector('.uploader > div').append(clearBtn);

    const m = formModal({
      title: '记录高光时刻',
      wide: true,
      submitText: '保存高光',
      fields: [
        {
          name: 'title',
          label: '标题 *',
          value: defaults.title || '',
          placeholder: '例如：最后一轮连抓两张 K 翻盘',
          full: true,
        },
        {
          name: 'kind',
          label: '类型',
          type: 'select',
          value: defaults.kind || '逆风翻盘',
          options: ['逆风翻盘', '神级配合', '爆分时刻', '默契沟通', '首次达成', '名场面', '精彩瞬间'].map((v) => ({
            value: v,
            label: v,
          })),
        },
        { name: 'happened_on', label: '发生日期', type: 'date', value: defaults.happened_on || new Date().toISOString().slice(0, 10) },
        { name: 'match_id', label: '关联对局', type: 'select', value: String(defaults.match_id || ''), options: matchOptions },
        { name: 'season_id', label: '所属赛季', type: 'select', value: String(defaults.season_id || ''), options: seasonOptions },
        { name: 'playerNode', type: 'custom', node: playerField },
        {
          name: 'content',
          label: '发生了什么',
          type: 'textarea',
          full: true,
          rows: 4,
          value: defaults.content || '',
          placeholder: '把当时的过程写下来，越具体越好 —— 这会是以后最有味道的记录',
        },
        { name: 'imageNode', type: 'custom', node: imageField },
      ],
      onSubmit: async (values) => {
        if (!values.title) throw new Error('标题不能为空');
        await api.createHighlight({
          season_id: values.season_id ? Number(values.season_id) : undefined,
          match_id: values.match_id ? Number(values.match_id) : undefined,
          player_ids: [...checkedPlayers],
          title: values.title,
          content: values.content || '',
          kind: values.kind || '精彩瞬间',
          happened_on: values.happened_on,
          image: imageData,
        });
        await store.load();
        notifyOk('高光时刻已记录');
        m.close();
        resolve(true);
      },
    });
  });
}

/* ---------------------------------------------------------------- 确认

   删除操作统一走这里，文案强调「不可恢复」并说清连带影响 */

export async function confirmDeletePlayer(player) {
  // 前端预判：有对局记录的玩家禁止删除（与后端规则一致，避免误弹确认框）
  const played = store.matches.filter((m) =>
    (m.camps || []).some((c) => (c.players || []).some((e) => e.player_id === player.id))
  ).length;
  if (played > 0) {
    notifyErr(
      `该玩家已有 ${played} 条对局记录，无法删除（删除会导致历史战绩不可逆丢失）。`
    );
    return false;
  }

  const ok = await confirmDialog({
    title: `删除玩家「${player.name}」`,
    message:
      '该玩家没有任何对局记录，可以删除。\n\n头像与照片文件会一并从服务器移除，且不可恢复。',
    confirmText: '删除',
    danger: true,
  });
  if (!ok) return false;
  try {
    await api.deletePlayer(player.id);
    await store.load();
    notifyOk('玩家已删除');
    return true;
  } catch (err) {
    // 后端在「已有对局记录」时会拒绝，前端已预判，此处兜底提示
    notifyErr(err.message || '删除失败');
    return false;
  }
}

export async function confirmDeleteMatch(match) {
  const campText = (match.camps || []).map((c) => `${c.name} ${c.total_score} 分`).join('、');
  const ok = await confirmDialog({
    title: `删除第 ${match.id} 局记录`,
    message: `对局时间：${match.played_at}\n本局结果：${campText}\n\n删除后该局分数会从所有排行榜统计中移除，且不可恢复。`,
    confirmText: '删除本局',
    danger: true,
  });
  if (!ok) return false;
  try {
    await api.deleteMatch(match.id);
    await store.load();
    notifyOk('本局记录已删除');
    return true;
  } catch (err) {
    notifyErr(err.message || '删除失败');
    return false;
  }
}

export async function confirmDeleteSeason(season) {
  // 前端预判：有对局记录的赛季禁止删除（与后端规则一致，避免误弹确认框）
  const matchCount = store.matches.filter((m) => m.season_id === season.id).length;
  if (matchCount > 0) {
    notifyErr(
      `该赛季已有 ${matchCount} 局对局记录，无法删除（删除会导致历史对局与战绩不可逆丢失）。`
    );
    return false;
  }

  const ok = await confirmDialog({
    title: `删除赛季「${season.name}」`,
    message:
      '该赛季下没有任何对局记录，可以删除。\n\n关联的高光记录会被解绑但保留，操作不可恢复。如果只是想封存，建议改为「已归档」。',
    confirmText: '删除',
    danger: true,
  });
  if (!ok) return false;
  try {
    await api.deleteSeason(season.id);
    await store.load();
    notifyOk('赛季已删除');
    return true;
  } catch (err) {
    notifyErr(err.message || '删除失败');
    return false;
  }
}

export async function confirmDeleteHighlight(item) {
  const ok = await confirmDialog({
    title: '删除这条高光时刻',
    message: `「${item.title}」将被删除，配图也会从服务器移除，不可恢复。`,
    confirmText: '删除',
    danger: true,
  });
  if (!ok) return false;
  try {
    await api.deleteHighlight(item.id);
    await store.load();
    notifyOk('已删除');
    return true;
  } catch (err) {
    notifyErr(err.message || '删除失败');
    return false;
  }
}
