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

function normalizePlatform(platform = '') {
  if (platform.includes('微博')) return '微博';
  if (platform.includes('抖音')) return '抖音';
  if (platform.includes('百度')) return '百度';
  if (platform.includes('哔哩') || platform.includes('B站') || platform.includes('b站')) return 'B站';
  if (platform.includes('豆瓣')) return '豆瓣';
  return platform || '其他';
}

function getPlatforms() {
  if (Array.isArray(data?.platforms)) {
    return data.platforms;
  }

  const grouped = PLATFORM_ORDER.map(name => ({
    name,
    sources: []
  }));

  const sourceList = data?.sources || [];
  const raw = data?.raw || {};

  sourceList.forEach(source => {
    const platformName = normalizePlatform(source.platform || source.name || '');
    const platform = grouped.find(item => item.name === platformName);
    if (!platform) return;

    platform.sources.push({
      id: source.id,
      name: source.name,
      platform: platformName,
      url: source.url,
      ok: source.ok !== false,
      count: source.count || raw[source.id]?.length || 0,
      message: source.message || '',
      items: raw[source.id] || source.items || []
    });
  });

  return grouped;
}

function getPlatform(name) {
  return getPlatforms().find(platform => platform.name === name) || {
    name,
    sources: []
  };
}

function renderTabs() {
  el('tabs').innerHTML = PLATFORM_ORDER.map(name => {
    const platform = getPlatform(name);
    const boardCount = platform.sources?.length || 0;

    return `
      <button class="tab ${name === activePlatform ? 'active' : ''}" data-platform="${escapeHtml(name)}">
        ${escapeHtml(name)}<span>${boardCount}</span>
      </button>
    `;
  }).join('');

  el('tabs').querySelectorAll('button').forEach(button => {
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

  const rows = items.map(item => `
    <li class="rank-row">
      <span class="rank-no">${escapeHtml(item.rank || '')}</span>
      <a class="rank-title" href=" " target="_blank" rel="noreferrer">
        ${escapeHtml(item.title)}
      </a >
      ${item.heat ? `<span class="rank-heat">${escapeHtml(item.heat)}</span>` : '<span class="rank-heat"></span>'}
    </li>
  `).join('');

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

  el('platformTitle').textContent = `${activePlatform}榜单`;
  el('platformHint').textContent = `${activePlatform}下共 ${sources.length} 个原始榜单，按来源分别展示。`;

  el('emptyState').hidden = sources.length > 0;
  el('boardList').innerHTML = sources.map(renderBoard).join('');
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

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    data = await response.json();

    el('updatedAt').textContent = data.meta?.generatedAtCN || '尚未更新';
    el('sourceStatus').textContent = `来源 ${data.meta?.successCount || 0}/${data.meta?.sourceCount || 0}`;

    render();
  } catch (err) {
    el('updatedAt').textContent = '数据加载失败';
    el('sourceStatus').textContent = err.message;
    el('boardList').innerHTML = '';
    el('emptyState').hidden = false;
  }
}

init();
