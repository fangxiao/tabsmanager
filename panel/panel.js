// Settabs 侧边栏面板逻辑
// 职责:拉取全部标签 → 按域名分组渲染 → 勾选 → 批量关闭/挂起;监听实时刷新。
// 安全:所有标题/URL 一律用 textContent 渲染,不用 innerHTML(标签标题来自不可信网页)。

'use strict';

// ---- DOM 引用 ----
const selectAllEl = document.getElementById('selectAll');
const totalCountEl = document.getElementById('totalCount');
const groupListEl = document.getElementById('groupList');
const emptyStateEl = document.getElementById('emptyState');
const actionBarEl = document.getElementById('actionBar');
const closeSelectedBtn = document.getElementById('closeSelected');
const discardSelectedBtn = document.getElementById('discardSelected');
const closeCountEl = document.getElementById('closeCount');
const discardCountEl = document.getElementById('discardCount');
const searchInputEl = document.getElementById('searchInput');
const searchClearEl = document.getElementById('searchClear');

const OTHER_KEY = '__other__';
const STORAGE_KEY_COLLAPSED = 'collapsedGroups';

// ---- 状态 ----
const selected = new Set(); // 勾选的 tabId 集合
let collapsedGroups = new Set(); // 折叠的分组 key 集合(从 storage 恢复)
let searchQuery = ''; // 当前搜索关键词(已小写、首尾 trim)
let totalManageable = 0; // 全部可管理 tab 数(用于显示 N/M)

// ---- 持久化:折叠状态跨会话保留 ----
async function loadCollapsedGroups() {
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY_COLLAPSED);
    const list = stored[STORAGE_KEY_COLLAPSED];
    if (Array.isArray(list)) collapsedGroups = new Set(list);
  } catch (e) {
    // storage 不可用时保持默认空集合
  }
}

function saveCollapsedGroups() {
  // fire-and-forget:失败不阻塞 UI
  chrome.storage.local
    .set({ [STORAGE_KEY_COLLAPSED]: [...collapsedGroups] })
    .catch(() => {});
}
let groups = []; // [{ key, displayName, tabs: [...] }]
let activeTabId = null;

// ---- 实时同步:长连接 + 自动重连 ----
let port = null;

function connectPort() {
  try {
    port = chrome.runtime.connect({ name: 'settabs-panel' });
  } catch (e) {
    port = null;
  }
  if (!port) return;

  port.onMessage.addListener((msg) => {
    if (msg && msg.type === 'tabs-changed') refresh();
  });

  port.onDisconnect.addListener(() => {
    port = null;
    // SW 休眠会断开连接,重连成功后强制全量刷新,保证一致性
    setTimeout(() => {
      connectPort();
      refresh();
    }, 500);
  });
}

// ---- 数据查询与分组 ----
async function refresh() {
  let tabs;
  let focusedWinId;
  try {
    [tabs, focusedWinId] = await Promise.all([
      chrome.tabs.query({}),
      chrome.windows.getLastFocused().then((w) => w.id),
    ]);
  } catch (e) {
    return;
  }

  const manageable = tabs.filter((t) => SettabsDomain.isManageable(t));
  totalManageable = manageable.length;
  activeTabId = null;
  for (const t of tabs) {
    if (t.active && t.windowId === focusedWinId) {
      activeTabId = t.id;
      break;
    }
  }

  groups = buildGroups(manageable);
  pruneSelection(manageable);
  render();
}

// 匹配 title / url / hostname(任一包含关键词即命中)
function matchesSearch(tab, q) {
  if (!q) return true;
  const title = (tab.title || '').toLowerCase();
  if (title.includes(q)) return true;
  const url = (tab.url || '').toLowerCase();
  if (url.includes(q)) return true;
  const host = (SettabsDomain.getDisplayHost(tab) || '').toLowerCase();
  if (host.includes(q)) return true;
  return false;
}

function buildGroups(tabs) {
  const map = new Map();
  const q = searchQuery;
  for (const tab of tabs) {
    if (!matchesSearch(tab, q)) continue;
    const key = SettabsDomain.getDomainKey(tab.url) || OTHER_KEY;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(tab);
  }

  const groups = [];
  for (const [key, groupTabs] of map) {
    groupTabs.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    groups.push({
      key,
      displayName: key === OTHER_KEY ? '其他' : key,
      tabs: groupTabs,
    });
  }

  // 组间排序:tab 数多的在前,同数量按名字
  groups.sort(
    (a, b) => b.tabs.length - a.tabs.length || a.displayName.localeCompare(b.displayName)
  );
  return groups;
}

// 清理已不存在的勾选(用全量可管理 tab,不要用过滤后的 groups,
// 否则搜索时会静默丢弃被过滤掉的勾选)
function pruneSelection(manageable) {
  const alive = new Set();
  for (const t of manageable) alive.add(t.id);
  for (const id of selected) if (!alive.has(id)) selected.delete(id);
}

// ---- 渲染 ----
function render() {
  const visible = groups.reduce((n, g) => n + g.tabs.length, 0);
  if (searchQuery) {
    totalCountEl.textContent = `${visible} / ${totalManageable}`;
  } else {
    totalCountEl.textContent = String(visible);
  }
  renderGroups();
  renderSelectAllState();
  renderActionBar();
}

function renderGroups() {
  groupListEl.textContent = '';
  for (const group of groups) {
    groupListEl.appendChild(buildGroupEl(group));
  }

  const hasAny = groups.length > 0;
  emptyStateEl.classList.toggle('hidden', hasAny);
  groupListEl.classList.toggle('hidden', !hasAny);
  // 搜索无结果时切换空状态文案
  if (!hasAny && searchQuery) {
    setEmptyState('⌕', '没有匹配的标签页', '试试其他关键词,或清空搜索');
  } else if (!hasAny) {
    setEmptyState('✓', '没有可管理的标签页', '新打开的网页会按域名自动分组显示在这里');
  }
}

function setEmptyState(icon, text, hint) {
  const iconEl = emptyStateEl.querySelector('.empty-icon');
  const textEl = emptyStateEl.querySelector('.empty-text');
  const hintEl = emptyStateEl.querySelector('.empty-hint');
  if (iconEl) iconEl.textContent = icon;
  if (textEl) textEl.textContent = text;
  if (hintEl) hintEl.textContent = hint;
}

function buildGroupEl(group) {
  const groupEl = document.createElement('section');
  groupEl.className = 'group';
  groupEl.dataset.groupKey = group.key;
  if (collapsedGroups.has(group.key)) groupEl.classList.add('collapsed');

  // 分组头
  const header = document.createElement('div');
  header.className = 'group-header';

  const toggle = document.createElement('button');
  toggle.className = 'group-toggle';
  toggle.type = 'button';
  toggle.textContent = '▾';
  toggle.title = collapsedGroups.has(group.key) ? '展开' : '折叠';

  const name = document.createElement('span');
  name.className = 'group-name';
  name.textContent = group.displayName;

  const count = document.createElement('span');
  count.className = 'group-count';
  count.textContent = String(group.tabs.length);

  const groupSelLabel = document.createElement('label');
  groupSelLabel.className = 'group-select-label';
  const groupSel = document.createElement('input');
  groupSel.type = 'checkbox';
  groupSel.className = 'group-select';
  groupSel.dataset.groupKey = group.key;
  const groupSelText = document.createElement('span');
  groupSelText.textContent = '全选';
  groupSelLabel.append(groupSel, groupSelText);
  updateGroupCheckbox(groupSel, group);

  header.append(toggle, name, count, groupSelLabel);
  header.addEventListener('click', (e) => {
    // 点击 checkbox/按钮不触发折叠
    if (e.target.closest('input, button')) return;
    toggleGroup(group.key);
  });

  // 组内标签列表
  const tabsWrap = document.createElement('div');
  tabsWrap.className = 'group-tabs';
  for (const tab of group.tabs) {
    tabsWrap.appendChild(buildTabRowEl(tab, group));
  }

  groupEl.append(header, tabsWrap);
  return groupEl;
}

function buildTabRowEl(tab, group) {
  const row = document.createElement('div');
  row.className = 'tab-row';
  row.dataset.tabId = String(tab.id);
  if (tab.id === activeTabId) row.classList.add('active');
  if (selected.has(tab.id)) row.classList.add('selected');
  if (tab.discarded) row.classList.add('discarded');

  // 勾选框
  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'tab-check';
  check.checked = selected.has(tab.id);
  check.dataset.tabId = String(tab.id);

  // favicon(带字母占位兜底)
  const favWrap = document.createElement('span');
  favWrap.className = 'favicon-wrap';
  const letter = document.createElement('span');
  letter.className = 'favicon-letter';
  letter.textContent = (group.displayName || '?').charAt(0).toUpperCase();
  const img = document.createElement('img');
  img.className = 'favicon';
  img.alt = '';
  setFavicon(img, tab, group.key);
  favWrap.append(letter, img);

  // 标题 + URL
  const info = document.createElement('div');
  info.className = 'tab-info';
  const title = document.createElement('div');
  title.className = 'tab-title';
  title.textContent = tab.title || '(无标题)';
  const url = document.createElement('div');
  url.className = 'tab-url';
  url.textContent = tab.url || '';
  info.append(title, url);

  row.append(check, favWrap, info);

  // 挂起角标 + 恢复按钮
  if (tab.discarded) {
    const badge = document.createElement('span');
    badge.className = 'discarded-badge';
    badge.textContent = '已挂起';
    const restore = document.createElement('button');
    restore.className = 'restore-btn';
    restore.type = 'button';
    restore.textContent = '恢复';
    restore.addEventListener('click', (e) => {
      e.stopPropagation();
      restoreTab(tab.id);
    });
    row.append(badge, restore);
  }

  return row;
}

// favicon 加载:直接 URL → google favicon 兜底 → 隐藏 img 保留字母占位
function setFavicon(img, tab, groupKey) {
  const fallback = () => {
    if (groupKey === OTHER_KEY) {
      img.style.display = 'none';
      return;
    }
    img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
      groupKey
    )}&sz=32`;
    img.onerror = () => {
      img.onerror = null;
      img.style.display = 'none';
    };
  };

  if (tab.favIconUrl) {
    img.src = tab.favIconUrl;
    img.onerror = () => {
      img.onerror = null;
      fallback();
    };
  } else {
    fallback();
  }
}

// ---- 勾选状态 ----
// 当前可见(已过滤)tab 中被勾选的数量
function getVisibleSelectedCount() {
  let n = 0;
  for (const g of groups) for (const t of g.tabs) if (selected.has(t.id)) n++;
  return n;
}

// 当前可见 tab 中被勾选的 id 列表
function getVisibleSelectedIds() {
  const ids = [];
  for (const g of groups) for (const t of g.tabs) if (selected.has(t.id)) ids.push(t.id);
  return ids;
}

function updateGroupCheckbox(input, group) {
  const total = group.tabs.length;
  const checked = group.tabs.filter((t) => selected.has(t.id)).length;
  input.checked = checked > 0;
  input.indeterminate = checked > 0 && checked < total;
}

function renderSelectAllState() {
  const total = groups.reduce((n, g) => n + g.tabs.length, 0);
  const checked = getVisibleSelectedCount();
  selectAllEl.checked = checked > 0;
  selectAllEl.indeterminate = checked > 0 && checked < total;
}

function renderActionBar() {
  const n = getVisibleSelectedCount();
  const hasSelection = n > 0;
  actionBarEl.classList.toggle('hidden', !hasSelection);
  closeCountEl.textContent = String(n);
  discardCountEl.textContent = String(n);
}

// ---- 操作 ----
function toggleGroup(key) {
  if (collapsedGroups.has(key)) collapsedGroups.delete(key);
  else collapsedGroups.add(key);
  saveCollapsedGroups();
  // 仅重渲染对应分组,避免整树重建
  const group = groups.find((g) => g.key === key);
  if (!group) return;
  const groupEl = groupListEl.querySelector(`.group[data-group-key="${CSS.escape(key)}"]`);
  if (groupEl) {
    groupEl.classList.toggle('collapsed');
    const toggle = groupEl.querySelector('.group-toggle');
    if (toggle) toggle.textContent = collapsedGroups.has(key) ? '▸' : '▾';
  }
}

async function activateTab(tabId) {
  try {
    await chrome.tabs.update(tabId, { active: true });
  } catch (e) {
    /* tab 可能已关闭 */
  }
}

async function restoreTab(tabId) {
  try {
    await chrome.tabs.update(tabId, { active: true });
  } catch (e) {
    /* ignore */
  }
}

async function closeSelected() {
  const ids = getVisibleSelectedIds();
  if (ids.length === 0) return;
  if (!confirm(`确定关闭选中的 ${ids.length} 个标签页吗?`)) return;
  try {
    await chrome.tabs.remove(ids);
  } catch (e) {
    /* 部分已关闭 */
  }
  for (const id of ids) selected.delete(id);
  refresh();
}

async function discardSelected() {
  const ids = getVisibleSelectedIds();
  if (ids.length === 0) return;
  for (const id of ids) {
    try {
      await chrome.tabs.discard(id);
    } catch (e) {
      /* 单个失败不影响其他 */
    }
  }
  for (const id of ids) selected.delete(id);
  refresh();
}

// ---- 事件绑定 ----
selectAllEl.addEventListener('change', () => {
  if (selectAllEl.checked) {
    for (const g of groups) for (const t of g.tabs) selected.add(t.id);
  } else if (searchQuery.length === 0) {
    selected.clear();
  } else {
    // 搜索时只取消可见的勾选,保留被过滤掉的勾选
    for (const g of groups) for (const t of g.tabs) selected.delete(t.id);
  }
  render();
});

// 事件委托:处理勾选、组内全选、激活 tab
groupListEl.addEventListener('change', (e) => {
  const target = e.target;

  if (target.classList.contains('tab-check')) {
    const id = Number(target.dataset.tabId);
    if (target.checked) selected.add(id);
    else selected.delete(id);
    const row = target.closest('.tab-row');
    if (row) row.classList.toggle('selected', target.checked);
    // 更新所属分组 checkbox 状态
    const groupEl = target.closest('.group');
    const group = groups.find((g) => g.key === groupEl.dataset.groupKey);
    if (group) {
      const groupSel = groupEl.querySelector('.group-select');
      if (groupSel) updateGroupCheckbox(groupSel, group);
    }
    renderSelectAllState();
    renderActionBar();
    return;
  }

  if (target.classList.contains('group-select')) {
    const group = groups.find((g) => g.key === target.dataset.groupKey);
    if (!group) return;
    const willSelect = target.checked;
    for (const t of group.tabs) {
      if (willSelect) selected.add(t.id);
      else selected.delete(t.id);
    }
    render();
  }
});

groupListEl.addEventListener('click', (e) => {
  // 点击非交互区 = 激活该 tab
  const row = e.target.closest('.tab-row');
  if (!row) return;
  if (e.target.closest('input, button')) return;
  activateTab(Number(row.dataset.tabId));
});

closeSelectedBtn.addEventListener('click', closeSelected);
discardSelectedBtn.addEventListener('click', discardSelected);

// 搜索:实时过滤,无关键词时显示全部
function setSearchQuery(raw) {
  const next = (raw || '').trim().toLowerCase();
  if (next === searchQuery) return;
  searchQuery = next;
  searchClearEl.classList.toggle('hidden', next.length === 0);
  refresh();
}

searchInputEl.addEventListener('input', (e) => {
  setSearchQuery(e.target.value);
});

// Esc 清空搜索
searchInputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && searchInputEl.value) {
    e.preventDefault();
    searchInputEl.value = '';
    setSearchQuery('');
  }
});

searchClearEl.addEventListener('click', () => {
  searchInputEl.value = '';
  setSearchQuery('');
  searchInputEl.focus();
});

// ---- 启动 ----
(async function init() {
  await loadCollapsedGroups();
  connectPort();
  refresh();
})();
