import { useState, useCallback } from 'react';
import { I18nContext } from './context.js';
import { STORAGE_KEYS } from '../config/storage.js';

const translations = {
  zh: {
    // Header
    'nav.brand': 'Spotti Spaghetti',
    'nav.logout': '退出',
    'theme.system': '跟随系统',
    'theme.light': '浅色模式',
    'theme.dark': '深色模式',
    'theme.label': '外观',
    'lang.toggle': 'EN',
    'lang.label': '语言 / Language',
    'lang.zh': '简体中文',
    'lang.en': 'English',

    // Hero
    'hero.title': 'Spotti Spaghetti',
    'hero.subtitle.line1': '把 Spotify 歌单揉成可备份、可恢复、可分析的数据面。',
    'hero.subtitle.line2': '导出、恢复、对比和洞察，一口气完成。',

    // Login
    'login.button': '连接 Spotify 账号',
    'login.aria': '连接Spotify账户',

    // Search & Filter
    'search.placeholder': '搜索歌单名称...',
    'search.grid': '网格卡片视图',
    'search.list': '列表表格视图',

    // Playlists
    'playlists.title': '播放列表',
    'playlists.exportAll': '打包全部 (ZIP)',
    'playlists.export': '导出',
    'playlists.exporting': '中...',
    'playlists.tracks': '首歌曲',
    'playlists.creator': '创建者:',
    'playlists.empty': '没有找到匹配的播放列表。',
    'playlists.count': (n) => `共找到 ${n} 个播放列表`,
    'playlists.col.cover': '封面',
    'playlists.col.name': '名称',
    'playlists.col.owner': '所有者',
    'playlists.col.tracks': '歌曲数',
    'playlists.col.action': '操作',

    // Workspace
    'workspace.restore': '恢复歌单',
    'workspace.history': '导出历史',
    'workspace.insights': '品味分析',
    'workspace.close': '关闭面板',
    'restore.csv': 'CSV 文件',
    'restore.name': '新歌单名称',
    'restore.submit': '创建歌单',
    'restore.loaded': (n) => `已读取 ${n} 首歌曲 URI`,
    'restore.running': '正在创建并写入 Spotify 歌单...',
    'restore.done': (name) => `已恢复歌单 "${name}"。`,
    'restore.failed': (msg) => `恢复失败: ${msg}`,
    'history.title': '最近导出',
    'history.clear': '清空',
    'history.analyze': '分析',
    'history.empty': '还没有导出历史。完成一次导出后，这里会显示快照与差异。',
    'history.latestDiff': (name, added, removed) => `${name}: 新增 ${added} 首，移除 ${removed} 首`,
    'history.firstSnapshot': (name) => `${name}: 已保存第一份快照`,
    'insights.sourceHistory': '分析导出记录',
    'insights.currentRecord': '当前分析',
    'insights.noHistory': '暂无导出记录',
    'insights.currentSource': (name) => `正在分析: ${name}`,
    'insights.empty': '还没有可分析的导出记录。先导出一个歌单即可生成统计。',
    'insights.summary': '概览',
    'insights.tracks': '歌曲',
    'insights.uniqueArtists': '艺人',
    'insights.albums': '专辑',
    'insights.genreCount': '流派',
    'insights.labelCount': '厂牌',
    'insights.duration': '总时长',
    'insights.avgDuration': '均长',
    'insights.popularity': '人气',
    'insights.explicit': '显式',
    'insights.mainstream': '热门',
    'insights.discovery': '冷门',
    'insights.releaseSpan': '年代跨度',
    'insights.artists': '艺人',
    'insights.topAlbums': '专辑',
    'insights.genres': '流派',
    'insights.labels': '厂牌',
    'insights.decades': '年代',
    'insights.years': '年份',
    'batch.retryFailed': (n) => `重试失败项 (${n})`,

    // Progress
    'progress.batchTitle': '正在批量导出歌单',
    'progress.singleTitle': '正在导出歌单歌曲',
    'progress.restoreTitle': '正在恢复 Spotify 歌单',
    'progress.waiting': '等待作业响应...',
    'progress.init': '初始化进度...',
    'progress.done': '处理已就绪，正在准备下载文件！',

    // Loading & Errors
    'loading.playlists': '正在获取您的 Spotify 播放列表，请稍候...',
    'error.loadFailed': '无法加载播放列表，请确认您的账号已被加入 Spotify 开发者白名单，或尝试重新登录。',
    'error.authFailed': '登录授权失败，请重新尝试。',
    'error.missingClientId': '缺少 Spotify Client ID。请在 .env 中配置 VITE_SPOTIFY_CLIENT_ID 后重启开发服务器。',
    'error.noTracks': (name) => `播放列表 "${name}" 中没有任何歌曲可以导出。`,
    'error.exportFailed': (name, msg) => `导出 "${name}" 时出错: ${msg}`,
    'error.batchFailed': (msg) => `批量打包导出时发生错误: ${msg}`,
    'error.batchPartialFailed': (n) => `批量导出已完成，但有 ${n} 个歌单失败。可以点击“重试失败项”继续。`,
    'error.allEmpty': '所有播放列表中均未找到可导出的歌曲数据。',
    'error.retryUnavailable': '没有找到可重试的失败歌单，请刷新列表后再试。',
    'error.restoreFailed': (msg) => `恢复歌单失败: ${msg}`,

    // Export task names
    'task.connecting': '正在连接 Spotify API...',
    'task.preparing': '准备批量导出...',
    'task.downloading': '下载歌曲数据中...',
    'task.userProfile': '正在获取用户信息...',
    'task.likedSongsCount': '正在获取“喜欢的歌曲”数量...',
    'task.userPlaylists': '正在获取您的播放列表...',
    'task.downloadTracks': (offset, total) => `正在下载歌曲信息: ${offset} / ${total}`,
    'task.artistGenres': '正在提取歌手流派分类...',
    'task.albumLabels': '正在获取专辑唱片公司...',
    'task.organizingExport': '正在整理并输出数据...',
    'task.complete': '完成!',
    'task.packing': '正在打包压缩中...',
    'task.restoring': '正在恢复歌单...',
    'task.rateLimit': (s) => `遭遇速率限制，自动重试中: 剩余 ${s} 秒`,
    'task.rateLimitBatch': (s) => `速率限制重试中: 剩余 ${s} 秒`,
    'task.batchItem': '全部播放列表',
    'task.batchProgress': (name, i, total) => `${name} (${i}/${total})`,

    // Footer
    'footer.rights': 'All rights reserved.',

    // Preview
    'preview.title': '歌单预览',
    'preview.loading': '正在获取歌单内歌曲，请稍候...',
    'preview.empty': '此歌单中没有找到可用的歌曲。',
    'preview.col.title': '歌曲与歌手',
    'preview.col.album': '专辑',
    'preview.col.duration': '时长',
    'preview.limit': '提示：预览仅显示前 50 首歌曲',
    'preview.close': '关闭预览',
  },

  en: {
    // Header
    'nav.brand': 'Spotti Spaghetti',
    'nav.logout': 'Logout',
    'theme.system': 'System',
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'theme.label': 'Appearance',
    'lang.toggle': '中文',
    'lang.label': 'Language / 语言',
    'lang.zh': '简体中文',
    'lang.en': 'English',

    // Hero
    'hero.title': 'Spotti Spaghetti',
    'hero.subtitle.line1': 'Twirl Spotify playlists into backup-ready, restorable, analyzable data.',
    'hero.subtitle.line2': 'Export, restore, compare, and inspect your music in one place.',

    // Login
    'login.button': 'Connect Spotify',
    'login.aria': 'Connect Spotify account',

    // Search & Filter
    'search.placeholder': 'Search playlists...',
    'search.grid': 'Grid view',
    'search.list': 'List view',

    // Playlists
    'playlists.title': 'Playlists',
    'playlists.exportAll': 'Export All (ZIP)',
    'playlists.export': 'Export',
    'playlists.exporting': '...',
    'playlists.tracks': 'tracks',
    'playlists.creator': 'By',
    'playlists.empty': 'No matching playlists found.',
    'playlists.count': (n) => `${n} playlists found`,
    'playlists.col.cover': 'Cover',
    'playlists.col.name': 'Name',
    'playlists.col.owner': 'Owner',
    'playlists.col.tracks': 'Tracks',
    'playlists.col.action': 'Action',

    // Workspace
    'workspace.restore': 'Restore',
    'workspace.history': 'History',
    'workspace.insights': 'Insights',
    'workspace.close': 'Close panel',
    'restore.csv': 'CSV file',
    'restore.name': 'New playlist name',
    'restore.submit': 'Create playlist',
    'restore.loaded': (n) => `${n} track URIs loaded`,
    'restore.running': 'Creating and filling Spotify playlist...',
    'restore.done': (name) => `Playlist "${name}" restored.`,
    'restore.failed': (msg) => `Restore failed: ${msg}`,
    'history.title': 'Recent exports',
    'history.clear': 'Clear',
    'history.analyze': 'Analyze',
    'history.empty': 'No export history yet. Export a playlist to see snapshots and diffs here.',
    'history.latestDiff': (name, added, removed) => `${name}: ${added} added, ${removed} removed`,
    'history.firstSnapshot': (name) => `${name}: first snapshot saved`,
    'insights.sourceHistory': 'Analyze export record',
    'insights.currentRecord': 'Current analysis',
    'insights.noHistory': 'No export records',
    'insights.currentSource': (name) => `Analyzing: ${name}`,
    'insights.empty': 'No export record is available yet. Export one playlist to generate stats.',
    'insights.summary': 'Summary',
    'insights.tracks': 'Tracks',
    'insights.uniqueArtists': 'Artists',
    'insights.albums': 'Albums',
    'insights.genreCount': 'Genres',
    'insights.labelCount': 'Labels',
    'insights.duration': 'Duration',
    'insights.avgDuration': 'Avg length',
    'insights.popularity': 'Popularity',
    'insights.explicit': 'Explicit',
    'insights.mainstream': 'Mainstream',
    'insights.discovery': 'Discovery',
    'insights.releaseSpan': 'Era span',
    'insights.artists': 'Artists',
    'insights.topAlbums': 'Albums',
    'insights.genres': 'Genres',
    'insights.labels': 'Labels',
    'insights.decades': 'Decades',
    'insights.years': 'Years',
    'batch.retryFailed': (n) => `Retry failed (${n})`,

    // Progress
    'progress.batchTitle': 'Batch exporting playlists',
    'progress.singleTitle': 'Exporting playlist tracks',
    'progress.restoreTitle': 'Restoring Spotify playlist',
    'progress.waiting': 'Waiting for response...',
    'progress.init': 'Initializing...',
    'progress.done': 'Ready! Preparing download...',

    // Loading & Errors
    'loading.playlists': 'Loading your Spotify playlists, please wait...',
    'error.loadFailed': 'Failed to load playlists. Please verify your account is whitelisted or try re-login.',
    'error.authFailed': 'Authorization failed. Please try again.',
    'error.missingClientId': 'Missing Spotify Client ID. Add VITE_SPOTIFY_CLIENT_ID to .env and restart the dev server.',
    'error.noTracks': (name) => `Playlist "${name}" has no tracks to export.`,
    'error.exportFailed': (name, msg) => `Error exporting "${name}": ${msg}`,
    'error.batchFailed': (msg) => `Batch export error: ${msg}`,
    'error.batchPartialFailed': (n) => `Batch export finished, but ${n} playlists failed. Use "Retry failed" to continue.`,
    'error.allEmpty': 'No exportable tracks found in any playlist.',
    'error.retryUnavailable': 'No failed playlists are available to retry. Refresh playlists and try again.',
    'error.restoreFailed': (msg) => `Playlist restore failed: ${msg}`,

    // Export task names
    'task.connecting': 'Connecting to Spotify API...',
    'task.preparing': 'Preparing batch export...',
    'task.downloading': 'Downloading track data...',
    'task.userProfile': 'Loading user profile...',
    'task.likedSongsCount': 'Loading Liked Songs count...',
    'task.userPlaylists': 'Loading playlists...',
    'task.downloadTracks': (offset, total) => `Downloading tracks: ${offset} / ${total}`,
    'task.artistGenres': 'Extracting artist genres...',
    'task.albumLabels': 'Loading album labels...',
    'task.organizingExport': 'Preparing export data...',
    'task.complete': 'Done!',
    'task.packing': 'Compressing archive...',
    'task.restoring': 'Restoring playlist...',
    'task.rateLimit': (s) => `Rate limited, retrying in ${s}s`,
    'task.rateLimitBatch': (s) => `Rate limited, retrying in ${s}s`,
    'task.batchItem': 'All playlists',
    'task.batchProgress': (name, i, total) => `${name} (${i}/${total})`,

    // Footer
    'footer.rights': 'All rights reserved.',

    // Preview
    'preview.title': 'Playlist Preview',
    'preview.loading': 'Fetching songs, please wait...',
    'preview.empty': 'No tracks found in this playlist.',
    'preview.col.title': 'Song & Artist',
    'preview.col.album': 'Album',
    'preview.col.duration': 'Duration',
    'preview.limit': 'Tip: Preview shows the first 50 songs only',
    'preview.close': 'Close Preview',
  },
};

export const I18nProvider = ({ children }) => {
  const [locale, setLocale] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.language);
    if (saved) return saved;
    return navigator.language.startsWith('zh') ? 'zh' : 'en';
  });

  const t = useCallback((key, ...args) => {
    const val = translations[locale]?.[key] ?? translations.zh[key] ?? key;
    if (typeof val === 'function') return val(...args);
    return val;
  }, [locale]);

  const toggleLocale = useCallback(() => {
    setLocale(prev => {
      const next = prev === 'zh' ? 'en' : 'zh';
      localStorage.setItem(STORAGE_KEYS.language, next);
      return next;
    });
  }, []);

  const changeLocale = useCallback((val) => {
    setLocale(val);
    localStorage.setItem(STORAGE_KEYS.language, val);
  }, []);

  return (
    <I18nContext.Provider value={{ locale, t, toggleLocale, changeLocale }}>
      {children}
    </I18nContext.Provider>
  );
};
