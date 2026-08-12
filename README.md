# tabs管理工具

一个 Chrome 扩展(MV3),按域名分组展示所有标签页,支持批量关闭和挂起以释放内存。

## 功能

- 📑 **按域名自动分组** — 同一站点的标签页聚在一起,组内按 tab 顺序排列
- 🔍 **实时搜索** — 匹配标题、URL 或域名,搜索时批量操作只作用于可见 tab;80ms debounce + 本地缓存,大 tab 数下不卡
- 💤 **批量挂起** — 一键 `chrome.tabs.discard` 释放内存,挂起的 tab 仍保留在分组中并支持一键恢复
- ❌ **批量关闭** — 勾选后一次性关闭多个标签页
- 🗂️ **分组级批量** — 每个分组头有"挂起整组"/"关闭整组"按钮,一键清掉某个域名下的所有 tab
- 🕘 **最近关闭** — 面板顶部展示最近 10 条关闭的 tab / 窗口,一键恢复
- 🔄 **实时同步** — 打开/关闭/切换/挂起等事件触发自动刷新(300ms 节流)
- 💾 **状态持久化** — 折叠状态通过 `chrome.storage.local` 跨会话保留
- 🎨 **favicon 兜底** — 自带 favicon → Google s2 → 字母占位,无网络也好看
- 🔢 **勾选反馈** — 分组头实时显示 `已选 / 总数`,如 `3 / 12`

## 安装

1. 克隆仓库:`git clone https://github.com/fangxiao/tabsmanager.git`
2. 打开 Chrome,访问 `chrome://extensions`
3. 打开右上角"开发者模式"
4. 点击"加载已解压的扩展程序",选择项目根目录(包含 `manifest.json` 的目录)
5. 点击工具栏的扩展图标即可打开侧边栏

## 权限说明

| 权限 | 用途 |
|---|---|
| `tabs` | 读取/查询/更新/关闭/挂起标签页 |
| `sidePanel` | 打开 Chrome 侧边栏显示面板 |

> 扩展不收集任何用户数据,所有处理都在本地完成。

## 文件结构

```
.
├── manifest.json         # MV3 配置
├── background.js         # Service Worker:事件监听 + 长连接广播
├── shared/
│   └── domain.js         # 域名解析/分组/可管理性判断(双端共用)
├── panel/
│   ├── panel.html        # 侧边栏 UI
│   ├── panel.css         # 样式
│   └── panel.js          # 交互逻辑
├── icons/                # 16/48/128 三套尺寸
├── LICENSE
└── README.md
```

## 开发

直接修改源码后,在 `chrome://extensions` 点击扩展卡片上的 🔄 刷新按钮即可重新加载。无构建步骤,纯静态资源。

## 许可

[MIT](LICENSE)
