// Settabs 共享工具函数(按类型分类)
// 分类策略(固定 10 类,纯本地确定性计算,无网络请求):
//   第1层 标题/URL 关键词打分:每类一份中英双语"强词"表,标题命中权重 2 倍于 URL,
//         英文词用词边界匹配避免误报(如 'ai' 不命中 'email'),同分按固定分类顺序取先者;
//   第2层 域名表兜底(自定义 > 内置):关键词未命中时,按域名归类;
//   第3层 「其他」。
(function (global) {
  'use strict';

  // 分类顺序 = 按类型视图下的展示顺序,「其他」始终兜底放最后
  const CATEGORIES = [
    '技术/开发',
    '新闻/资讯',
    '社交/社区',
    '视频/影音',
    '搜索',
    '办公/效率',
    'AI 工具',
    '购物',
    '金融/理财',
    '其他',
  ];

  const OTHER = '其他';

  // ---- 第1层:关键词表(强词,宁缺毋滥,避免误判) ----
  // 中文词子串匹配;英文词/品牌词词边界匹配;品牌词直接并入所属分类。
  const KEYWORDS = {
    '技术/开发': [
      '代码', '编程', '教程', '开源', '前端', '后端', '程序员', '面试', '算法', '数据库',
      '部署', '源码', '框架', '接口', '开发者', '函数', '脚本', '缓存', '调试', '报错',
      '异常', '日志', '监控', '服务器', '架构', '微服务', '容器', '爬虫', '网络安全', '加密',
      '版本控制', '代码仓库', '编译', '测试', '文档', '教程',
      // 中英文品牌 / 术语
      'github', 'gitlab', 'git', 'nginx', 'leetcode', 'npm', 'docker', 'kubernetes',
      'stack', 'overflow', '掘金', 'csdn', '菜鸟教程', 'codepen',
      'programming', 'coding', 'developer', 'typescript', 'javascript', 'python', 'java',
      'rust', 'golang', 'react', 'vue', 'angular', 'nodejs', 'sql', 'api', 'sdk',
      'docs', 'documentation', 'open source', 'open-source', 'deploy', 'server', 'database',
      'debug', 'tutorial', 'compiler', 'terminal', 'cli', 'regex', 'localhost',
    ],

    '新闻/资讯': [
      '新闻', '快讯', '头条', '热点', '报道', '资讯', '时政', '突发', '独家', '深度',
      '发布会', '国际', '财经', '评论', '观点', '调查',
      'news', 'breaking', 'headline', 'report', 'politics', 'world', 'business',
      'economy', 'reuters', 'bloomberg', 'bbc', 'cnn', 'guardian', 'nytimes',
      'hackernews', 'hacker news',
    ],

    '社交/社区': [
      '社区', '论坛', '贴吧', '热榜', '回答', '提问', '关注', '粉丝', '私信', '话题',
      '动态', '微博', '帖子', '讨论', '小组', '广场', '朋友圈', '点赞', '转发',
      'reddit', 'twitter', 'facebook', 'instagram', 'linkedin', 'weibo', 'zhihu',
      'telegram', 'discord', 'community', 'forum', 'thread', 'profile', 'feed',
      'follow', 'comment', 'social', 'tweet', 'post', 'reply',
    ],

    '视频/影音': [
      '视频', '直播', '弹幕', '番剧', '追剧', '电视剧', '综艺', '动漫', '电影', '影音',
      '播放', '点播', '音乐', '电台', '演唱会', '片单', '影视',
      'youtube', 'bilibili', 'video', 'watch', 'live', 'stream', 'netflix', 'twitch',
      'spotify', 'movie', 'film', 'music', 'anime', 'playlist', 'episode', 'cinema',
      'podcast', 'song', 'audio', 'tv',
    ],

    '搜索': [
      '搜索', '检索', '百度', '谷歌', '搜狗', '搜索引擎',
      'google', 'baidu', 'bing', 'search', 'query', 'duckduckgo',
    ],

    '办公/效率': [
      '邮箱', '邮件', '收件箱', '日历', '会议', '日程', '待办', '任务', '协作', '工作台',
      '表格', '幻灯片', '审批', '打卡', '考勤', '云盘', '网盘', '通讯录', '笔记', '思维导图',
      '在线文档', '办公',
      'gmail', 'outlook', 'mail', 'inbox', 'calendar', 'meeting', 'docs', 'spreadsheet',
      'slide', 'notion', 'slack', 'teams', 'zoom', 'feishu', 'task', 'todo', 'drive',
      'file', 'folder', 'note', 'workspace', 'office', 'email', 'schedule', 'sheet',
    ],

    'AI 工具': [
      '对话', '聊天', '智能', '模型', '提示词', '生成', '助手', '大模型', '训练', '推理',
      '机器学习', '深度学习', '神经网络', '文生图', '语音识别', '机器人',
      'chatgpt', 'openai', 'claude', 'gemini', 'perplexity', 'llm', 'ai', 'gpt',
      'copilot', 'chatbot', 'prompt', 'midjourney', 'stable diffusion', 'huggingface',
      'deepseek', 'kimi', 'doubao', 'qwen', 'tongyi', 'grok', 'groq',
    ],

    '购物': [
      '购物', '下单', '购物车', '秒杀', '优惠券', '促销', '折扣', '特价', '旗舰店', '订单',
      '发货', '快递', '物流', '退款', '比价', '团购', '拼单', '满减', '加购', '商城',
      '好物', '宝贝', '预售',
      'amazon', 'taobao', 'jd', 'aliexpress', 'shop', 'cart', 'checkout', 'coupon',
      'discount', 'sale', 'buy', 'price', 'shipping', 'delivery', 'wishlist',
    ],

    '金融/理财': [
      '股票', '基金', '理财', '行情', '涨幅', '跌幅', '大盘', '股价', '交易', '钱包',
      '支付', '转账', '余额', '充值', '提现', '还款', '借款', '贷款', '信用卡', '账单',
      '汇率', '黄金', '期货', '期权', '债券', '上市', '市盈率', '涨停', '跌停', '支付宝',
      '公积金', '工资',
      'stock', 'fund', 'trading', 'wallet', 'pay', 'payment', 'transfer', 'balance',
      'credit', 'loan', 'bank', 'finance', 'investment', 'crypto', 'bitcoin', 'ethereum',
      'forex', 'dividend',
    ],
  };

  // ---- 第2层:域名表兜底(hostname 已去 www、小写) ----
  // 具体子域名规则优先:mail.google.com → 办公/效率,google.com → 搜索
  const BUILTIN_RULES = {
    // ---- 技术/开发 ----
    'github.com': '技术/开发',
    'gitee.com': '技术/开发',
    'gitlab.com': '技术/开发',
    'bitbucket.org': '技术/开发',
    'stackoverflow.com': '技术/开发',
    'stackexchange.com': '技术/开发',
    'segmentfault.com': '技术/开发',
    'csdn.net': '技术/开发',
    'juejin.cn': '技术/开发',
    'oschina.net': '技术/开发',
    'cnblogs.com': '技术/开发',
    '51cto.com': '技术/开发',
    'infoq.cn': '技术/开发',
    'leetcode.cn': '技术/开发',
    'leetcode.com': '技术/开发',
    'v2ex.com': '技术/开发',
    'npmjs.com': '技术/开发',
    'mozilla.org': '技术/开发',
    'caniuse.com': '技术/开发',
    'w3schools.com.cn': '技术/开发',
    'runoob.com': '技术/开发',
    'codepen.io': '技术/开发',
    'docker.com': '技术/开发',
    'kubernetes.io': '技术/开发',
    'git-scm.com': '技术/开发',
    'vercel.com': '技术/开发',
    'netlify.com': '技术/开发',
    'cloud.google.com': '技术/开发',
    'aws.amazon.com': '技术/开发',
    'azure.microsoft.com': '技术/开发',
    'aliyun.com': '技术/开发',
    'tencentcloud.com': '技术/开发',
    'huaweicloud.com': '技术/开发',

    // ---- 新闻/资讯 ----
    'news.ycombinator.com': '新闻/资讯',
    '36kr.com': '新闻/资讯',
    'huxiu.com': '新闻/资讯',
    'thepaper.cn': '新闻/资讯',
    'jiemian.com': '新闻/资讯',
    'caixin.com': '新闻/资讯',
    'news.sina.com.cn': '新闻/资讯',
    'news.163.com': '新闻/资讯',
    'news.qq.com': '新闻/资讯',
    'bbc.com': '新闻/资讯',
    'cnn.com': '新闻/资讯',
    'reuters.com': '新闻/资讯',
    'bloomberg.com': '新闻/资讯',
    'nytimes.com': '新闻/资讯',
    'theguardian.com': '新闻/资讯',
    'medium.com': '新闻/资讯',
    'wikipedia.org': '新闻/资讯',

    // ---- 社交/社区 ----
    'x.com': '社交/社区',
    'twitter.com': '社交/社区',
    'reddit.com': '社交/社区',
    'weibo.com': '社交/社区',
    'zhihu.com': '社交/社区',
    'douban.com': '社交/社区',
    'facebook.com': '社交/社区',
    'instagram.com': '社交/社区',
    'tiktok.com': '社交/社区',
    'discord.com': '社交/社区',
    'telegram.org': '社交/社区',
    'tieba.baidu.com': '社交/社区',
    'linkedin.com': '社交/社区',

    // ---- 视频/影音 ----
    'youtube.com': '视频/影音',
    'bilibili.com': '视频/影音',
    'douyin.com': '视频/影音',
    'kuaishou.com': '视频/影音',
    'iqiyi.com': '视频/影音',
    'youku.com': '视频/影音',
    'v.qq.com': '视频/影音',
    'mgtv.com': '视频/影音',
    'netflix.com': '视频/影音',
    'twitch.tv': '视频/影音',
    'spotify.com': '视频/影音',
    'music.163.com': '视频/影音',

    // ---- 搜索 ----
    'google.com': '搜索',
    'baidu.com': '搜索',
    'bing.com': '搜索',
    'duckduckgo.com': '搜索',
    'sogou.com': '搜索',

    // ---- 办公/效率 ----
    'mail.google.com': '办公/效率',
    'gmail.com': '办公/效率',
    'drive.google.com': '办公/效率',
    'docs.google.com': '办公/效率',
    'calendar.google.com': '办公/效率',
    'meet.google.com': '办公/效率',
    'mail.qq.com': '办公/效率',
    'mail.163.com': '办公/效率',
    'outlook.com': '办公/效率',
    'office.com': '办公/效率',
    'microsoft.com': '办公/效率',
    'slack.com': '办公/效率',
    'notion.so': '办公/效率',
    'feishu.cn': '办公/效率',
    'dingtalk.com': '办公/效率',
    'work.weixin.qq.com': '办公/效率',
    'trello.com': '办公/效率',
    'figma.com': '办公/效率',
    'canva.com': '办公/效率',
    'zoom.us': '办公/效率',
    'teams.microsoft.com': '办公/效率',

    // ---- AI 工具 ----
    'chatgpt.com': 'AI 工具',
    'openai.com': 'AI 工具',
    'claude.ai': 'AI 工具',
    'anthropic.com': 'AI 工具',
    'gemini.google.com': 'AI 工具',
    'perplexity.ai': 'AI 工具',
    'poe.com': 'AI 工具',
    'huggingface.co': 'AI 工具',
    'deepseek.com': 'AI 工具',
    'kimi.moonshot.cn': 'AI 工具',
    'tongyi.aliyun.com': 'AI 工具',
    'doubao.com': 'AI 工具',
    'yuanbao.tencent.com': 'AI 工具',
    'wenxin.baidu.com': 'AI 工具',

    // ---- 购物 ----
    'taobao.com': '购物',
    'tmall.com': '购物',
    'jd.com': '购物',
    'pinduoduo.com': '购物',
    'amazon.com': '购物',
    'amazon.cn': '购物',
    '1688.com': '购物',
    'suning.com': '购物',
    'meituan.com': '购物',

    // ---- 金融/理财 ----
    'alipay.com': '金融/理财',
    'xueqiu.com': '金融/理财',
    'eastmoney.com': '金融/理财',
    '10jqka.com.cn': '金融/理财',
    'tradingview.com': '金融/理财',
    'coinmarketcap.com': '金融/理财',
    'coingecko.com': '金融/理财',
    'binance.com': '金融/理财',
    'okx.com': '金融/理财',
  };

  // 用户自定义规则列表 [{ domain, category }],由面板注入,优先级高于内置
  let customRules = [];

  function setCustomRules(rules) {
    customRules = Array.isArray(rules) ? rules : [];
  }

  // 在给定规则表中匹配:先精确,再最长后缀(host 以 '.'+rule 结尾)
  function matchInMap(host, map) {
    if (map[host]) return map[host];
    let best = null;
    let bestLen = 0;
    for (const k in map) {
      if (k.length > bestLen && host.endsWith('.' + k)) {
        best = map[k];
        bestLen = k.length;
      }
    }
    return best;
  }

  // ---- 关键词匹配(预编译,避免每次匹配都建正则) ----
  function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // 纯英文单 token 用词边界,中文/含空格短语用子串
  const COMPILED = {};
  for (const cat in KEYWORDS) {
    COMPILED[cat] = KEYWORDS[cat].map((w) => {
      const lower = w.toLowerCase();
      if (/^[a-z0-9]+$/.test(lower)) {
        return { re: new RegExp(`\\b${escapeRegExp(lower)}\\b`) };
      }
      return { str: lower };
    });
  }

  function keywordHits(haystack, entries) {
    let hits = 0;
    for (const e of entries) {
      if (e.re ? e.re.test(haystack) : haystack.includes(e.str)) hits++;
    }
    return hits;
  }

  // 只取 URL 路径(不含 hostname):hostname 交给域名兜底层处理,
  // 避免 mail.google.com 里 mail/google 等词跨分类撞车
  function urlPathOf(url) {
    try {
      return new URL(url).pathname;
    } catch (e) {
      return url || '';
    }
  }

  // 标题/URL 关键词打分:标题权重 2,URL 权重 1;同分取 CATEGORIES 顺序靠前者
  function categoryFromKeywords(title, url) {
    const titleH = (title || '').toLowerCase();
    const urlH = urlPathOf(url).toLowerCase();
    let bestCat = null;
    let bestScore = 0;
    for (const cat of CATEGORIES) {
      if (cat === OTHER) continue;
      const entries = COMPILED[cat] || [];
      const score = keywordHits(titleH, entries) * 2 + keywordHits(urlH, entries);
      if (score > bestScore) {
        bestScore = score;
        bestCat = cat;
      }
    }
    return bestScore > 0 ? bestCat : null;
  }

  // 分类一个 tab(hostname 小写、去 www):标题/URL 关键词 → 域名兜底 → 其他
  function getCategory(hostname, title, url) {
    const fromKeywords = categoryFromKeywords(title, url);
    if (fromKeywords) return fromKeywords;

    const h = (hostname || '').toLowerCase().replace(/^www\./, '');
    if (!h) return OTHER;

    const customMap = {};
    for (const r of customRules) customMap[r.domain] = r.category;
    const fromCustom = matchInMap(h, customMap);
    if (fromCustom) return fromCustom;

    const fromBuiltin = matchInMap(h, BUILTIN_RULES);
    return fromBuiltin || OTHER;
  }

  global.SettabsCategories = {
    CATEGORIES,
    OTHER,
    setCustomRules,
    getCategory,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
