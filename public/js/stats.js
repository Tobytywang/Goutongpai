/* ==========================================================================
   统计口径模块
   —— 排行榜上每一个数字从哪来、怎么算，全部收敛在这里。
   ------------------------------------------------------------------------
   一局（match）的数据形状：
     { id, season_id, deck_count, deck_total, win_line, winner_camp_id, played_at,
       camps: [ { id, name, color, total_score, is_winner,
                  players: [ { player_id, score, finished, is_mvp } ] } ] }

   【计数单位说明】—— 避免「到底是局数还是次数」的歧义
     games        出场局数：一名玩家参与过的对局数量。同一局只计 1。
     wins         胜局数：所在阵营在该局判为获胜的局数量。同一局最多计 1。
     finishedGames 出完牌局数：把牌出完的局数量。

   【分数口径】—— 三档分必须能对上账
     points       个人累计分 = Σ 该玩家在所有出场局里录得的分数（不管出没出完）
     banked       入账分   = Σ 仅在「已出完牌」的局里录得的分数（这部分才参与阵营胜负判定）
     wasted       作废分   = points − banked（没出完牌，分白拿了）
     闭合关系：banked + wasted === points   ← 页面上会显式校验

   【单局账目闭合】—— 用来发现漏录
     每局把牌库总分拆成三段，理论上有：
       banked(各阵营总分之和) + wasted(作废分) + unclaimed(未录入分) === deck_total
     unclaimed 不为 0 说明还有分没录进来（可能牌没打完/漏录），页面会标出来。
   ========================================================================== */

/** 从一局里取所有得分明细 */
function entriesOf(match) {
  const out = [];
  for (const camp of match.camps || []) {
    for (const entry of camp.players || []) {
      out.push({ ...entry, camp_id: camp.id, camp_name: camp.name, camp_is_winner: !!camp.is_winner });
    }
  }
  return out;
}

/**
 * 单局账目校验。
 * @returns {{banked:number, wasted:number, distributed:number, unclaimed:number,
 *            balanced:boolean, overDeck:boolean, winners:number}}
 */
export function auditMatch(match) {
  const entries = entriesOf(match);
  const banked = entries.filter((e) => e.finished).reduce((s, e) => s + e.score, 0);
  const wasted = entries.filter((e) => !e.finished).reduce((s, e) => s + e.score, 0);
  const distributed = banked + wasted;
  const unclaimed = match.deck_total - distributed;
  const winners = (match.camps || []).filter((c) => c.is_winner).length;

  return {
    banked,
    wasted,
    distributed,
    unclaimed,
    /** 各阵营总分之和是否等于「出完牌玩家分数之和」 */
    balanced: banked === (match.camps || []).reduce((s, c) => s + c.total_score, 0),
    /** 录入的分数是否超过了牌库总分（超了必然有录错） */
    overDeck: distributed > match.deck_total,
    winners,
  };
}

/** 计算全部玩家的统计指标（含从未出场的人，便于展示完整名册） */
export function computePlayerStats(matches, players, seasonId = null) {
  const scope = seasonId === null || seasonId === undefined
    ? matches
    : matches.filter((m) => m.season_id === Number(seasonId));

  const map = new Map();
  const ensure = (playerId) => {
    if (!map.has(playerId)) {
      map.set(playerId, {
        player_id: playerId,
        games: 0,
        wins: 0,
        finishedGames: 0,
        points: 0,
        banked: 0,
        wasted: 0,
        mvp: 0,
        best: 0,
        campWin: new Map(), // 阵营名 → 出场局数，用于「最常搭档」
        lastPlayed: null,
      });
    }
    return map.get(playerId);
  };

  for (const p of players) ensure(p.id);

  for (const m of scope) {
    for (const entry of entriesOf(m)) {
      const s = ensure(entry.player_id);
      s.games += 1;
      s.points += entry.score;
      if (entry.finished) {
        s.banked += entry.score;
        s.finishedGames += 1;
      } else {
        s.wasted += entry.score;
      }
      if (entry.camp_is_winner) s.wins += 1;
      if (entry.is_mvp) s.mvp += 1;
      if (entry.score > s.best) s.best = entry.score;
      if (!s.lastPlayed || m.played_at > s.lastPlayed) s.lastPlayed = m.played_at;

      const campName = entry.camp_name || '未命名阵营';
      s.campWin.set(campName, (s.campWin.get(campName) || 0) + 1);
    }
  }

  const rows = players.map((player) => {
    const s = map.get(player.id);
    const winRate = s.games ? s.wins / s.games : 0;
    const finishRate = s.games ? s.finishedGames / s.games : 0;
    const avg = s.games ? s.points / s.games : 0;

    let mainCamp = null;
    let mainCampCount = 0;
    for (const [name, count] of s.campWin) {
      if (count > mainCampCount) {
        mainCamp = name;
        mainCampCount = count;
      }
    }

    return {
      player,
      player_id: player.id,
      name: player.name,
      games: s.games,
      wins: s.wins,
      losses: s.games - s.wins,
      finishedGames: s.finishedGames,
      points: s.points,
      banked: s.banked,
      wasted: s.wasted,
      mvp: s.mvp,
      best: s.best,
      winRate,
      finishRate,
      avg,
      mainCamp,
      lastPlayed: s.lastPlayed,
      /** 自检：入账分 + 作废分 必须等于累计分 */
      coherent: s.banked + s.wasted === s.points,
    };
  });

  return rows;
}

/** 可用的排序键。label 用中文，hint 说明口径，避免「这个数字是什么意思」 */
export const SORT_KEYS = [
  { key: 'wins', label: '胜局', hint: '所在阵营获胜的局数', numeric: true },
  { key: 'winRate', label: '胜率', hint: '胜局 ÷ 出场局数', numeric: true, percent: true },
  { key: 'banked', label: '入账分', hint: '只在「把牌出完」的局里拿到的分数之和，这部分才参与胜负判定', numeric: true },
  { key: 'points', label: '累计分', hint: '所有出场局里拿到的分数之和，包含没出完牌而作废的分', numeric: true },
  { key: 'avg', label: '场均分', hint: '累计分 ÷ 出场局数', numeric: true },
  { key: 'finishRate', label: '出完率', hint: '把牌出完的局数 ÷ 出场局数', numeric: true, percent: true },
  { key: 'mvp', label: 'MVP 次数', hint: '被标记为本局 MVP 的次数', numeric: true },
  { key: 'games', label: '出场', hint: '参与过的对局数', numeric: true },
];

/** 按指定键排序（降序），同值再按胜局、出场数、入账分兜底，保证顺序稳定 */
export function sortStats(rows, key = 'wins') {
  const copy = rows.slice();
  copy.sort((a, b) => {
    const diff = (b[key] ?? 0) - (a[key] ?? 0);
    if (diff !== 0) return diff;
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.games !== a.games) return b.games - a.games;
    if (b.banked !== a.banked) return b.banked - a.banked;
    return String(a.name).localeCompare(String(b.name), 'zh-Hans-CN');
  });
  return copy;
}

/** 赛季（或全部）的整体概览 */
export function computeOverview(matches, players, seasonId = null) {
  const scope = seasonId === null || seasonId === undefined
    ? matches
    : matches.filter((m) => m.season_id === Number(seasonId));

  let banked = 0;
  let wasted = 0;
  let unclaimed = 0;
  let deckTotal = 0;
  let unresolved = 0;
  const campTally = new Map();

  for (const m of scope) {
    const a = auditMatch(m);
    banked += a.banked;
    wasted += a.wasted;
    unclaimed += a.unclaimed;
    deckTotal += m.deck_total;
    if (a.winners !== 1) unresolved += 1;

    for (const camp of m.camps || []) {
      const key = camp.name;
      const rec = campTally.get(key) || { name: key, color: camp.color, plays: 0, wins: 0 };
      rec.plays += 1;
      if (camp.is_winner) rec.wins += 1;
      campTally.set(key, rec);
    }
  }

  const activePlayers = new Set();
  for (const m of scope) {
    for (const camp of m.camps || []) {
      for (const e of camp.players || []) activePlayers.add(e.player_id);
    }
  }

  return {
    matchCount: scope.length,
    playerCount: players.length,
    activePlayerCount: activePlayers.size,
    banked,
    wasted,
    unclaimed,
    deckTotal,
    unresolvedMatches: unresolved,
    /** 账目闭合校验：入账 + 作废 + 未录入 === 牌库总分合计 */
    balanced: banked + wasted + unclaimed === deckTotal,
    camps: Array.from(campTally.values()).sort((a, b) => b.wins - a.wins || b.plays - a.plays),
    latestMatch: scope[0] || null,
  };
}

/** 玩家在最近 N 局的状态（用于「近期手气」小条） */
export function recentForm(matches, playerId, limit = 5) {
  const out = [];
  for (const m of matches) {
    for (const camp of m.camps || []) {
      for (const e of camp.players || []) {
        if (e.player_id !== playerId) continue;
        out.push({ matchId: m.id, win: !!camp.is_winner, score: e.score, finished: !!e.finished });
      }
    }
    if (out.length >= limit) break;
  }
  return out.slice(0, limit);
}
