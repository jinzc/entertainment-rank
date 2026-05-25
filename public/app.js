const PLATFORM_ORDER = ['微博', '抖音', '百度', 'B站', '豆瓣'];

let data = null;
let activePlatform = PLATFORM_ORDER[0];

const el = id => document.getElementById(id);

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, s => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[s]));
}

function normalizePlatform(source = {}) {
  const text = [
    source.platform,
    source.name,
    source.title,
    source.id,
    source.url
  ].filter(Boolean).join(' ');

  if (text.includes('微博') || text.toLowerCase().includes('weibo')) return '微博';
  if (text.includes('抖音') || text.toLowerCase().includes('douyin')) return '抖音';
  if (text.includes('百度') || text.toLowerCase().includes('baidu')) return '百度';
  if (
    text.includes('哔哩') ||
    text.includes('B站') ||
    text.includes('b站') ||
    text.toLowerCase().includes('bilibili')
  ) return 'B站';
  if (text.includes('豆瓣') || text.toLowerCase().includes('douban')) return '豆瓣';

  return '其他';
}

function getSourceItems(source = {}) {
  const id = source.id;

  if (Array.isArray(source.items)) return source.items;
  if (Array.isArray(source.data)) return source.data;
  if (Array.isArray(source.list)) return source.list;

  if (id && Array.isArray(data?.raw?.[id])) return data.raw[id];
  if (id && Array.isArray(data?.items?.[id])) return data.items[id];
  if (id && Array.isArray(data?.boards?.[id])) return data.boards[id];

  return [];
}

function normalizeItem(item = {}, index = 0, source = {}) {
  return {
    rank: item.rank || item.index || item.no || index + 1,
    title: item.title || item.name || item.keyword || item.text || '',
    url: item.url || item.link || item.href || source.url || '#',
    heat: item.heat || item.hot || item.value || item.score || item.desc || ''
  };
}

function buildPlatformsFromSources() {
  const grouped = PLATFORM_ORDER.map(name => ({
    name,
    sources: []
  }));

  const sourceList = []
    .concat(Array.isArray(data?.sources) ? data.sources : [])
    .concat(Array.isArray(data?.sourceStatus) ? data.sourceStatus : [])
    .concat(Array.isArray(data?.boards) ? data.boards : []);

  sourceList.forEach(source => {
    const platformName = normalizePlatform(source);
    const platform = grouped.find(item => item.name === platformName);
    if (!platform) return;

    const items = getSourceItems(source).map((item, index) => normalizeItem(item, index, source));

    platform.sources.push({
      id: source.id,
      name: source.name || source.title || source.id || platformName,
      platform: platformName,
      url: source.url || '#',
      ok: source.ok !== false,
      count: items.length,
      message: source.message || source.error || '',
      items
    });
  });

  return grouped;
}

function getPlatforms() {
  if (Array.isArray(data?.platforms) && data.platforms.length > 0) {
    return PLATFORM_ORDER.map(name => {
      const platform = data.platforms.find(item => item.name === name);
      return {
        name,
        sources: platform?.sources || []
      };
    });
  }

  return buildPlatformsFromSources();
}

function getPlatform(name) {
  return getPlatforms().find(platform => platform.name === name) || {
    name,
    sources: []
  };
}

function renderTabs() {
  const tabs = el('tabs');
  if (!tabs) return;

  tabs.innerHTML = PLATFORM_ORDER.map(name => {
    const platform = getPlatform(name);
    const boardCount = platform.sources?.length || 0;

    return `
      <button class="tab ${name === activePlatform ? 'active' : ''}" data-platform="${escapeHtml(name)}">
        ${escapeHtml(name)}<span>${boardCount}</span>
      </button>
    `;
  }).join('');

  tabs.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => {
      activePlatform = button.dataset.platform;
      render();
    });
  });
}

function renderBoard(source) {
  const items = source.items || [];
  const status = source.ok
    ? `${items.length} 条`
    : `抓取失败：${source.message || '未知原因'}`;

  const rows = items.map((item, index) => {
    const normalized = normalizeItem(item, index, source);

    return `
      <li class="rank-row">
        <span class="rank-no">${escapeHtml(normalized.rank)}</span>
        <a class="rank-title" href=" " target="_blank" rel="noreferrer">
          ${escapeHtml(normalized.title)}
        </a >
        ${normalized.heat ? `<span class="rank-heat">${escapeHtml(normalized.heat)}</span>` : '<span class="rank-heat"></span>'}
      </li>
    `;
  }).join('');

  return `
    <article class="board-card">
      <div class="board-head">
        <div>
          <h3>${escapeHtml(source.name)}</h3>
          <p>${escapeHtml(status)}</p >
        </div>
        <a class="source-link" href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">原榜单</a >
      </div>
      ${items.length > 0 ? `<ol class="rank-list">${rows}</ol>` : '<div class="board-empty">本次未抓取到条目。</div>'}
    </article>
  `;
}

function renderBoards() {
  const platform = getPlatform(activePlatform);
  const sources = platform.sources || [];

  if (el('platformTitle')) {
    el('platformTitle').textContent = `${activePlatform}榜单`;
  }

  if (el('platformHint')) {
    el('platformHint').textContent = `${activePlatform}下共 ${sources.length} 个原始榜单，按来源分别展示。`;
  }

  if (el('emptyState')) {
    el('emptyState').hidden = sources.length > 0;
  }

  if (el('boardList')) {
    el('boardList').innerHTML = sources.map(renderBoard).join('');
  }
}

function render() {
  renderTabs();
  renderBoards();
}

async function init() {
  try {
    const response = await fetch(`./data/latest.json?t=${Date.now()}`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    data = await response.json();

    if (el('updatedAt')) {
      el('updatedAt').textContent = data.meta?.generatedAtCN || data.meta?.generatedAt || '尚未更新';
    }

    if (el('sourceStatus')) {
      el('sourceStatus').textContent = `来源 ${data.meta?.successCount || 0}/${data.meta?.sourceCount || 0}，条目 ${data.meta?.itemCount || 0}`;
    }

    render();
  } catch (err) {
    if (el('updatedAt')) {
      el('updatedAt').textContent = '数据加载失败';
    }

    if (el('sourceStatus')) {
      el('sourceStatus').textContent = err.message;
    }

    if (el('boardList')) {
      el('boardList').innerHTML = '';
    }

    if (el('emptyState')) {
      el('emptyState').hidden = false;
    }

    console.error(err);
  }
}

init();
