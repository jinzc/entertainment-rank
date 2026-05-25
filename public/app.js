const PLATFORM_ORDER = ['微博', '抖音', '百度', 'B站', '豆瓣'];

const SOURCE_DEFS = [
  {
    id: 'weibo_entertainment',
    name: '微博·文娱榜',
    platform: '微博',
    url: 'https://tophub.today/n/3QeLwJEd7k'
  },
  {
    id: 'douyin_entertainment',
    name: '抖音·娱乐榜',
    platform: '抖音',
    url: 'https://tophub.today/n/2me33NBewj'
  },
  {
    id: 'douyin_star',
    name: '抖音·明星榜',
    platform: '抖音',
    url: 'https://tophub.today/n/RrvWy7Re5z'
  },
  {
    id: 'baidu_movie',
    name: '百度·电影榜',
    platform: '百度',
    url: 'https://tophub.today/n/4KvxRL1ekx'
  },
  {
    id: 'baidu_tv',
    name: '百度·电视剧榜',
    platform: '百度',
    url: 'https://tophub.today/n/ENeYp23dY4'
  },
  {
    id: 'bilibili_film_tv',
    name: '哔哩哔哩·影视榜',
    platform: 'B站',
    url: 'https://tophub.today/n/MZd77ypdrO'
  },
  {
    id: 'bilibili_entertainment',
    name: '哔哩哔哩·娱乐榜',
    platform: 'B站',
    url: 'https://tophub.today/n/YKd67qneaP'
  },
  {
    id: 'douban_new_movies',
    name: '豆瓣电影·豆瓣新片榜',
    platform: '豆瓣',
    url: 'https://tophub.today/n/mDOvnyBoEB'
  },
  {
    id: 'douban_now_showing',
    name: '豆瓣电影·正在上映的电影',
    platform: '豆瓣',
    url: 'https://tophub.today/n/m4ejbjyexE'
  },
  {
    id: 'douban_hot_series',
    name: '豆瓣电影·热门剧集排行榜',
    platform: '豆瓣',
    url: 'https://tophub.today/n/nBe0JLBv37'
  }
];

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

function findStatus(source) {
  const lists = [
    data?.sources,
    data?.sourceStatus,
    data?.boards
  ].filter(Array.isArray);

  for (const list of lists) {
    const found = list.find(item =>
      item.id === source.id ||
      item.name === source.name ||
      item.title === source.name
    );

    if (found) return found;
  }

  return {};
}

function getSourceItems(source, status = {}) {
  if (Array.isArray(data?.raw?.[source.id])) return data.raw[source.id];
  if (Array.isArray(data?.items?.[source.id])) return data.items[source.id];
  if (Array.isArray(data?.boards?.[source.id])) return data.boards[source.id];

  if (Array.isArray(status.items)) return status.items;
  if (Array.isArray(status.data)) return status.data;
  if (Array.isArray(status.list)) return status.list;

  if (Array.isArray(data?.platforms)) {
    for (const platform of data.platforms) {
      const matched = (platform.sources || []).find(item =>
        item.id === source.id ||
        item.name === source.name ||
        item.title === source.name
      );

      if (matched?.items && Array.isArray(matched.items)) {
        return matched.items;
      }
    }
  }

  if (Array.isArray(data?.items)) {
    return data.items.filter(item =>
      item.sourceId === source.id ||
      item.source === source.id ||
      item.sourceName === source.name ||
      item.board === source.name
    );
  }

  return [];
}

function normalizeItem(item = {}, index = 0, source = {}) {
  return {
    rank: item.rank || item.index || item.no || index + 1,
    title: item.title || item.name || item.keyword || item.text || '',
    url: item.url || item.link || item.href || source.url || '#',
    heat: item.heat || item.hot || item.value || item.desc || ''
  };
}

function buildPlatforms() {
  return PLATFORM_ORDER.map(platformName => {
    const sources = SOURCE_DEFS
      .filter(source => source.platform === platformName)
      .map(source => {
        const status = findStatus(source);
        const items = getSourceItems(source, status).map((item, index) =>
          normalizeItem(item, index, source)
        );

        return {
          ...source,
          ok: status.ok !== false,
          message: status.message || status.error || '',
          count: items.length,
          items
        };
      });

    return {
      name: platformName,
      sources
    };
  });
}

function getPlatform(name) {
  return buildPlatforms().find(platform => platform.name === name) || {
    name,
    sources: []
  };
}

function renderTabs() {
  const tabs = el('tabs');
  if (!tabs) return;

  tabs.innerHTML = PLATFORM_ORDER.map(name => {
    const platform = getPlatform(name);
    const boardCount = platform.sources.length;

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

// 页面打开时，每 5 分钟自动重新读取一次最新数据。
// GitHub Actions 仍然是每小时更新数据文件；这里负责让已打开的网页不用手动刷新。
setInterval(() => {
  init();
}, 5 * 60 * 1000);

// 用户切回页面时，也自动刷新一次。
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    init();
  }
});
