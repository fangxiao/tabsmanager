// Settabs Service Worker (MV3)
// 职责:点击图标打开侧边栏;监听标签事件;向侧边栏 panel 广播变化通知。
// 注意:所有事件监听器必须在顶层同步注册,这样事件/连接才能唤醒休眠的 SW。

importScripts('shared/domain.js');

// 已连接的 panel 长连接集合
const ports = new Set();
let refreshTimer = null;

// 向所有已连接 panel 广播"标签已变化"
function broadcastTabsChanged() {
  for (const port of ports) {
    try {
      port.postMessage({ type: 'tabs-changed' });
    } catch (e) {
      // 端口可能已失效,由 onDisconnect 清理
    }
  }
}

// 合并高频事件:300ms 内的多个事件只广播一次
function scheduleRefresh() {
  if (refreshTimer !== null) return;
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    broadcastTabsChanged();
  }, 300);
}

// 点击工具栏图标直接打开侧边栏
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

// panel 长连接管理
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'settabs-panel') return;
  ports.add(port);
  port.onDisconnect.addListener(() => {
    ports.delete(port);
  });
});

// ---- 标签事件(顶层注册,唤醒 SW 后触发) ----

chrome.tabs.onCreated.addListener(scheduleRefresh);
chrome.tabs.onRemoved.addListener(scheduleRefresh);
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // 只有影响展示的字段变化才刷新
  if (
    changeInfo.title ||
    changeInfo.url ||
    changeInfo.favIconUrl ||
    'discarded' in changeInfo ||
    changeInfo.status
  ) {
    scheduleRefresh();
  }
});
chrome.tabs.onActivated.addListener(scheduleRefresh);
chrome.tabs.onMoved.addListener(scheduleRefresh);
chrome.tabs.onAttached.addListener(scheduleRefresh);
chrome.tabs.onDetached.addListener(scheduleRefresh);

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) scheduleRefresh();
});
chrome.windows.onRemoved.addListener(scheduleRefresh);
