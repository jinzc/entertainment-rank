const tabs = [
  { id: 'overall', label: '综合榜', title: '综合榜单', hint: '按多来源出现、来源内排名和热度数字综合排序。' },
  { id: 'platform:微博', label: '微博', title: '微博平台榜', hint: '微博来源内的文娱热点聚合。' },
  { id: 'platform:抖音', label: '抖音', title: '抖音平台榜', hint: '抖音娱乐榜和明星榜聚合。' },
  { id: 'platform:百度', label: '百度', title: '百度平台榜', hint: '百度电影榜和电视剧榜聚合。' },
  { id: 'platform:哔哩哔哩', label: 'B站', title: '哔哩哔哩平台榜', hint: 'B站影视榜和娱乐榜聚合。' },
  { id: 'platform:豆瓣', label: '豆瓣', title: '豆瓣平台榜', hint: '豆瓣新片、正在上映和热门剧集聚合。' },
  { id: 'category:电影', label: '电影', title: '电影榜', hint: '百度电影、豆瓣电影相关来源聚合。' },
  { id: 'category:电视剧', label: '电视剧', title: '电视剧榜', hint: '电视剧与热门剧集相关来源聚合。' },
  { id: 'category:明星', label: '明星', title: '明星榜', hint: '明星相关热点聚合。' },
  { id: 'category:娱乐', label: '娱乐', title: '娱乐榜', hint: '娱乐类热点聚合。' }
];

let data = null;
let activeTab = 'overall';
let keyword = '';

const el = id => document.getElementById(id);

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}

function getItems() {
  if (!data) return [];
  if (activeTab === 'overall') return data.rankings.overall || [];
  const [type, name] = activeTab.split(':');
  if (type === 'platform') return data.rankings.platforms?.[name] || [];
  if (type === 'category') return data.rankings.categories?.[name] || [];
  return [];
}

function renderTabs() {
  el('tabs').innerHTML = tabs.map(tab => `
    <button class="tab ${tab.id === activeTab ? 'active' : ''}" data-tab="${tab.id}">${tab.label}</button>
  `).join('');

  el('tabs').querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => {
      activeTab = button.dataset.tab;
      render();
    });
  });
}

function renderSummary() {
  const meta = data?.meta || {};
  const cards = [
    ['来源', `${meta.successCount || 0}/${meta.sourceCount || 0}`],
    ['条目', meta.itemCount || 0],
    ['综合榜', data?.rankings?.overall?.length || 0],
    ['失败来源', meta.failCount || 0]
  ];
  el('summaryGrid').innerHTML = cards.map(([label, value]) => `
    <div class="summary-card">
      <span class="card-label">${label}</span>
      <strong>${value}</strong>
    </div>
  `).join('');
}

function sourceChips(item) {
  return (item.sources || []).slice(0, 6).map(s => `
    <a class="chip" href="${escapeHtml(s.sourceUrl)}" target="_blank" rel="noreferrer">
      ${escapeHtml(s.sourceName)} · #${s.rank}${s.heat ? ` · ${escapeHtml(s.heat)}` : ''}
    </a>
  `).join('');
}

function renderList() {
  const tab = tabs.find(t => t.id === activeTab) || tabs[0];
  el('listTitle').textContent = tab.title;
  el('listHint').textContent = tab.hint;

  const q = keyword.trim().toLowerCase();
  const items = getItems().filter(item => {
    if (!q) return true;
    return [item.title, ...(item.platforms || []), ...(item.categories || []), ...(item.sources || []).map(s => s.sourceName)]
      .join(' ')
      .toLowerCase()
      .includes(q);
  });

  el('emptyState').hidden = items.length > 0;
  el('rankList').innerHTML = items.map(item => `
    <article class="rank-item">
      <div class="rank-no">${item.rank}</div>
      <div>
        <a class="rank-title" href="${escapeHtml(item.bestUrl || '#')}" target="_blank" rel="noreferrer">${escapeHtml(item.title)}</a>
        <div class="meta-line">
          <span class="chip">平台：${escapeHtml((item.platforms || []).join(' / ') || '-')}</span>
          <span class="chip">分类：${escapeHtml((item.categories || []).join(' / ') || '-')}</span>
          <span class="chip">来源数：${item.sourceCount || 1}</span>
          ${sourceChips(item)}
        </div>
      </div>
      <div class="score">
        综合分
        <strong>${item.score || 0}</strong>
      </div>
    </article>
  `).join('');
}

function renderSources() {
  const sources = data?.sources || [];
  el('sources').innerHTML = sources.map(source => `
    <a class="source-card" href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">
      <span class="source-title">
        <span>${escapeHtml(source.name)}</span>
        <span class="${source.ok ? 'ok' : 'fail'}">${source.ok ? '成功' : '失败'}</span>
      </span>
      <small>${escapeHtml(source.platform)} / ${escapeHtml(source.category)} · ${source.count || 0} 条</small>
      <small>${escapeHtml(source.message || '')}</small>
    </a>
  `).join('');
}

function render() {
  renderTabs();
  renderSummary();
  renderList();
  renderSources();
}

async function init() {
  try {
    const response = await fetch(`./data/latest.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
    el('updatedAt').textContent = data.meta?.generatedAtCN || '尚未更新';
    el('sourceStatus').textContent = `成功 ${data.meta?.successCount || 0} 个来源，失败 ${data.meta?.failCount || 0} 个来源`;
    render();
  } catch (err) {
    el('updatedAt').textContent = '数据加载失败';
    el('sourceStatus').textContent = err.message;
    el('rankList').innerHTML = '';
    el('emptyState').hidden = false;
  }
}

el('searchInput').addEventListener('input', e => {
  keyword = e.target.value;
  renderList();
});

init();
