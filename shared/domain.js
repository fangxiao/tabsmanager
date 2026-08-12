// Settabs 共享工具函数(域名解析/分组/可管理性判断)
// 双端兼容:background.js 用 importScripts() 引入,panel.html 用 <script src> 引入。
// 函数挂载到 globalThis.SettabsDomain。
(function (global) {
  'use strict';

  // 不可管理、不展示的内部/保留页面前缀
  const FORBIDDEN_PREFIXES = [
    'chrome://',
    'chrome-extension://',
    'chrome-search://',
    'edge://',
    'devtools://',
    'about:',
    'view-source:',
  ];

  // 去掉 www. 前缀,统一小写
  function normalizeHostname(host) {
    return host.toLowerCase().replace(/^www\./, '');
  }

  // 解析 URL 得到分组 key(hostname);非 http(s) 或解析失败返回 null
  function getDomainKey(url) {
    try {
      const u = new URL(url);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      return normalizeHostname(u.hostname);
    } catch (e) {
      return null;
    }
  }

  // 判断一个 tab 是否可管理(可展示、可关闭/挂起)
  function isManageable(tab) {
    if (tab.id === undefined) return false;
    const url = tab.url || '';
    if (!url) return false;
    if (FORBIDDEN_PREFIXES.some((p) => url.startsWith(p))) return false;
    return true;
  }

  // 分组显示名:域名 key 或空(归入"其他"时用)
  function getDisplayHost(tab) {
    return getDomainKey(tab.url) || '';
  }

  global.SettabsDomain = {
    normalizeHostname,
    getDomainKey,
    isManageable,
    getDisplayHost,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
