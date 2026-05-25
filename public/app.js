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

function getPlatform(name) {
  return (data?.platforms || []).find(platform => platform.name === name) || {
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

  const rows = items.map(item => `
    <li class="rank-row">
      <span class="rank-no">${escapeHtml(item.rank || '')}</span>
      <a class="rank-title" href=" " target="_blank" rel="noreferrer">
        ${escapeHtml(item.title || '')}
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
      el('updatedAt').textContent = data.meta?.generatedAtCN || '尚未更新';
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
