import fs from 'node:fs/promises';
import path from 'node:path';
import { SOURCES, PLATFORM_ORDER, CATEGORY_ORDER } from './sources.js';

const root = process.cwd();
const dataDir = path.join(root, 'public', 'data');
const latestFile = path.join(dataDir, 'latest.json');
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 18000);
const maxItemsPerSource = Number(process.env.MAX_ITEMS_PER_SOURCE || 50);

const blacklist = new Set([
  '首页', '今日热榜', '登录', '注册', '退出', '关于', '关于我们', '使用指南', '帮助',
  'App', 'APP', '下载', '榜单', '全部', '搜索', '查看完整榜单', '查看全部', '更多',
  '反馈', '隐私', '条款', '联系', '订阅', '节点', '分类', '热榜'
]);

function cnTime(date = new Date()) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(date).replaceAll('/', '-');
}

function decodeHtml(text = '') {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => String.fromCodePoint(parseInt(num, 10)));
}

function stripTags(html = '') {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function toAbsoluteUrl(url, base) {
  if (!url) return base;
  try {
    return new URL(decodeHtml(url), base).toString();
  } catch {
    return base;
  }
}

function normalizeTitle(title = '') {
  return title
    .toLowerCase()
    .replace(/[\s\u3000]+/g, '')
    .replace(/[【】\[\]（）()《》<>“”"'‘’、，。！？!?:：；;|｜#＃·・.。\-—_]+/g, '')
    .trim();
}

function parseHeatValue(heat = '') {
  const raw = String(heat || '').replace(/,/g, '').trim();
  const match = raw.match(/(\d+(?:\.\d+)?)\s*([万億亿kKmMwW]?)/);
  if (!match) return 0;
  const value = Number(match[1]);
  const unit = match[2];
  if (!Number.isFinite(value)) return 0;
  if (unit === '亿' || unit === '億') return value * 100000000;
  if (unit === '万' || unit === 'w' || unit === 'W') return value * 10000;
  if (unit === 'k' || unit === 'K') return value * 1000;
  if (unit === 'm' || unit === 'M') return value * 1000000;
  return value;
}

function extractHeat(text, title) {
  const cleaned = stripTags(text).replace(title, ' ');
  const prioritized = cleaned.match(/(\d+(?:\.\d+)?\s*(?:亿|億|万|w|W|k|K|m|M)?)(?:\s*(?:热度|热搜|指数|讨论|阅读|播放|观看|人气|关注|想看|评分))/);
  if (prioritized) return prioritized[1].replace(/\s+/g, '');
  const all = [...cleaned.matchAll(/\d+(?:\.\d+)?\s*(?:亿|億|万|w|W|k|K|m|M)?/g)]
    .map(m => m[0].replace(/\s+/g, ''))
    .filter(v => {
      const n = parseHeatValue(v);
      return n > 20;
    });
  if (all.length <= 1) return '';
  return all[all.length - 1] || '';
}

function looksLikeContentTitle(title, href) {
  const t = String(title || '').trim();
  if (!t || t.length < 2 || t.length > 120) return false;
  if (blacklist.has(t)) return false;
  if (/^(https?:|www\.|\d+$)/i.test(t)) return false;
  if (/^(首页|分类|更多|登录|注册|搜索|帮助|关于|下载)/.test(t)) return false;
  if (/^[A-Za-z\s]+$/.test(t) && t.length < 8) return false;
  const h = String(href || '');
  if (/\/(about|help|app|login|signup|c)\b/i.test(h)) return false;
  if (/^#/.test(h)) return false;
  return true;
}

function getMainHtml(html) {
  const compact = html.replace(/\r?\n/g, ' ');
  const table = compact.match(/<table[\s\S]*?<\/table>/i);
  if (table) return table[0];
  const card = compact.match(/<div[^>]+class=["'][^"']*(?:cc-cd|list|rank|node)[^"']*["'][\s\S]*?(?:<footer|<\/main>|<\/body>)/i);
  if (card) return card[0];
  const body = compact.match(/<body[\s\S]*?<\/body>/i);
  return body ? body[0] : compact;
}

function extractAnchors(fragment, baseUrl) {
  const anchors = [];
  const regex = /<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = regex.exec(fragment)) !== null) {
    const href = match[2];
    const inner = match[4];
    const title = stripTags(inner);
    if (!looksLikeContentTitle(title, href)) continue;
    anchors.push({ title, url: toAbsoluteUrl(href, baseUrl), index: match.index, html: match[0] });
  }
  return anchors;
}

function parseRows(html, source) {
  const main = getMainHtml(html);
  const rowFragments = [...main.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map(m => m[0]);
  const candidates = [];

  for (const row of rowFragments) {
    const anchors = extractAnchors(row, source.url);
    if (!anchors.length) continue;
    const selected = anchors.sort((a, b) => b.title.length - a.title.length)[0];
    candidates.push({
      title: selected.title,
      url: selected.url,
      heat: extractHeat(row, selected.title)
    });
  }

  if (candidates.length >= 3) return candidates;

  const anchors = extractAnchors(main, source.url);
  for (const anchor of anchors) {
    const context = main.slice(Math.max(0, anchor.index - 160), Math.min(main.length, anchor.index + 520));
    candidates.push({
      title: anchor.title,
      url: anchor.url,
      heat: extractHeat(context, anchor.title)
    });
  }

  return candidates;
}

function dedupeAndRank(items, source) {
  const seen = new Set();
  const cleaned = [];
  for (const item of items) {
    const key = normalizeTitle(item.title);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    cleaned.push({
      rank: cleaned.length + 1,
      title: item.title,
      url: item.url || source.url,
      heat: item.heat || '',
      heatValue: parseHeatValue(item.heat),
      sourceId: source.id,
      sourceName: source.name,
      platform: source.platform,
      category: source.category,
      sourceUrl: source.url
    });
    if (cleaned.length >= maxItemsPerSource) break;
  }
  return cleaned;
}

async function fetchWithRetry(source, attempt = 1) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  const headers = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36 EntertainmentRankBot/1.0',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'cache-control': 'no-cache'
  };

  if (process.env.TOPHUB_COOKIE) {
    headers.cookie = process.env.TOPHUB_COOKIE;
  }

  try {
    const res = await fetch(source.url, {
      headers,
      signal: controller.signal,
      redirect: 'follow'
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const html = await res.text();
    if (!html || html.length < 500) {
      throw new Error('页面内容过短，可能被拦截或返回空页');
    }
    return html;
  } catch (err) {
    if (attempt < 3) {
      await new Promise(resolve => setTimeout(resolve, 1200 * attempt));
      return fetchWithRetry(source, attempt + 1);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function itemScore(item, totalInSource) {
  const rankScore = Math.max(1, (totalInSource - item.rank + 1) / Math.max(totalInSource, 1) * 100);
  const heatScore = item.heatValue > 0 ? Math.min(30, Math.log10(item.heatValue + 1) * 5) : 0;
  return rankScore + heatScore;
}

function aggregate(items) {
  const groups = new Map();
  const totalBySource = new Map();
  for (const item of items) {
    totalBySource.set(item.sourceId, Math.max(totalBySource.get(item.sourceId) || 0, item.rank));
  }

  for (const item of items) {
    const key = normalizeTitle(item.title);
    if (!key) continue;
    const score = itemScore(item, totalBySource.get(item.sourceId) || 50);
    if (!groups.has(key)) {
      groups.set(key, {
        title: item.title,
        score: 0,
        sourceCount: 0,
        platforms: new Set(),
        categories: new Set(),
        sources: [],
        bestRank: item.rank,
        bestUrl: item.url,
        bestHeat: item.heat || ''
      });
    }
    const g = groups.get(key);
    g.score += score;
    g.sourceCount += 1;
    g.platforms.add(item.platform);
    g.categories.add(item.category);
    g.bestRank = Math.min(g.bestRank, item.rank);
    if (!g.bestHeat && item.heat) g.bestHeat = item.heat;
    g.sources.push({
      sourceId: item.sourceId,
      sourceName: item.sourceName,
      platform: item.platform,
      category: item.category,
      rank: item.rank,
      heat: item.heat,
      url: item.url,
      sourceUrl: item.sourceUrl
    });
  }

  return [...groups.values()]
    .map(g => ({
      title: g.title,
      score: Math.round(g.score),
      sourceCount: g.sourceCount,
      platforms: [...g.platforms],
      categories: [...g.categories],
      bestRank: g.bestRank,
      bestUrl: g.bestUrl,
      bestHeat: g.bestHeat,
      sources: g.sources.sort((a, b) => a.rank - b.rank)
    }))
    .sort((a, b) => b.score - a.score || a.bestRank - b.bestRank)
    .map((item, index) => ({ rank: index + 1, ...item }));
}

async function run() {
  await fs.mkdir(dataDir, { recursive: true });
  const generatedAt = new Date();
  const statuses = [];
  const raw = {};
  const allItems = [];

  for (const source of SOURCES) {
    try {
      console.log(`Fetching ${source.name}...`);
      const html = await fetchWithRetry(source);
      const parsed = dedupeAndRank(parseRows(html, source), source);
      if (parsed.length === 0) {
        throw new Error('未解析到榜单条目，可能页面结构已变化');
      }
      raw[source.id] = parsed;
      allItems.push(...parsed);
      statuses.push({
        id: source.id,
        name: source.name,
        platform: source.platform,
        category: source.category,
        url: source.url,
        ok: true,
        count: parsed.length,
        message: 'ok'
      });
    } catch (err) {
      console.error(`${source.name} failed:`, err?.message || err);
      raw[source.id] = [];
      statuses.push({
        id: source.id,
        name: source.name,
        platform: source.platform,
        category: source.category,
        url: source.url,
        ok: false,
        count: 0,
        message: String(err?.message || err)
      });
    }
  }

  const rankings = {
    overall: aggregate(allItems).slice(0, 100),
    platforms: {},
    categories: {}
  };

  for (const platform of PLATFORM_ORDER) {
    rankings.platforms[platform] = aggregate(allItems.filter(item => item.platform === platform)).slice(0, 60);
  }
  for (const category of CATEGORY_ORDER) {
    rankings.categories[category] = aggregate(allItems.filter(item => item.category === category)).slice(0, 60);
  }

  const output = {
    meta: {
      project: '全网文娱榜',
      version: '1.0.0',
      generatedAt: generatedAt.toISOString(),
      generatedAtCN: cnTime(generatedAt),
      sourceCount: SOURCES.length,
      successCount: statuses.filter(s => s.ok).length,
      failCount: statuses.filter(s => !s.ok).length,
      itemCount: allItems.length,
      note: '综合榜按同一标题跨来源聚合，基础分由来源内排名决定，热度数字作为弱加权。'
    },
    sources: statuses,
    rankings,
    raw
  };

  await fs.writeFile(latestFile, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Done. ${output.meta.successCount}/${output.meta.sourceCount} sources, ${output.meta.itemCount} items.`);
}

run().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
