import { fetchAudioList, fetchAudioTimeline } from "../../services/api";
import type { AudioItem } from "../../utils/types";
import { withTheme } from "../../behaviors/theme";
import { getThumbUrl, fmtDuration, getImageUrl, isModuleEnabled } from "../../utils/util";
import { isLoggedIn } from "../../utils/auth";
import { safeNavigateBack } from "../../utils/nav";

const app = getApp<IAppOption>();

interface GroupedAudios {
  month: string;
  yearMonth: string;
  tracks: AudioItem[];
  count: number;
  loaded: boolean;
  loading: boolean;
}

/** 页面实例类型，用于方法内 this 注解 */
type AudioPageInstance = WechatMiniprogram.Page.Instance<AudioData & AudioInstance, Record<string, any>>;

interface AudioData {
  showNowPlaying: boolean;
  groupedAudios: GroupedAudios[];
  filteredGroupedAudios: GroupedAudios[]; // 用于显示的过滤后数据
  allTracks: AudioItem[];
  playingTrackId: string | null;
  isPlayingAudio: boolean;
  currentTrack: AudioItem | null;
  months: { label: string; value: string }[];
  currentMonth: string;
  currentYear: number;
  showYearPicker: boolean;
  yearRange: number[];
  yearIndex: number;
  tempYear: number;
  artistId: string;

  isLoading: boolean;
  statusBarHeight: number;
  navBarHeight: number;
  visualizerBars: number[];

  /** 音频进度 */
  audioProgress: number;
  audioCurrentTime: string;
  audioDuration: string;

  // 进度条拖拽状态
  _npIsDragging: boolean;
  _npDraggingProgress: number;
  _npDraggingTime: string;

  // 登录状态
  isLoggedIn: boolean;
  showLoginPopup: boolean;
  _guestLimit: boolean;
  /** 模块是否启用（控制整个页面是否展示） */
  moduleEnabled: boolean;
}

interface AudioInstance {
  _allTimelineItems?: { yearMonth: string; count: number }[];
  _loadingMonths?: Set<string>;
  _failedMonths?: Map<string, number>; // 失败月份及重试次数
  _visualizerTimer?: number | null;
  _innerAudioContext?: WechatMiniprogram.InnerAudioContext;
  /** 连续播放错误计数（防死循环） */
  _consecutiveErrors?: number;
  /** 上次出错的 trackId */
  _lastErrorTrackId?: string | null;
}

Page(withTheme({
  data: {
    showNowPlaying: false,
    groupedAudios: [] as GroupedAudios[],
    filteredGroupedAudios: [] as GroupedAudios[],
    allTracks: [] as AudioItem[],
    playingTrackId: null as string | null,
    isPlayingAudio: false,
    currentTrack: null as AudioItem | null,
    currentMonth: "", // 默认选中 ALL（空字符串表示全部）
    currentYear: new Date().getFullYear(),
    showYearPicker: false,
    yearRange: [] as number[],
    yearIndex: 0,
    tempYear: new Date().getFullYear(),
    artistId: "" as string,
    months: [
      { label: "JAN", value: "01" },
      { label: "FEB", value: "02" },
      { label: "MAR", value: "03" },
      { label: "APR", value: "04" },
      { label: "MAY", value: "05" },
      { label: "JUN", value: "06" },
      { label: "JUL", value: "07" },
      { label: "AUG", value: "08" },
      { label: "SEP", value: "09" },
      { label: "OCT", value: "10" },
      { label: "NOV", value: "11" },
      { label: "DEC", value: "12" },
    ],

    /** 状态栏高度 */
    statusBarHeight: 20,
    navBarHeight: 64,
    isLoading: false,
    visualizerBars: Array.from({ length: 28 }, () => Math.floor(Math.random() * 60) + 25),

    /** 音频进度 */
    audioProgress: 0,
    audioCurrentTime: "0:00",
    audioDuration: "0:00",

    // 进度条拖拽状态
    _npIsDragging: false,
    _npDraggingProgress: 0,
    _npDraggingTime: "0:00",

    // 登录状态
    isLoggedIn: isLoggedIn(),
    showLoginPopup: false,
    _guestLimit: false,
    moduleEnabled: true,
  } as AudioData,

  /** 页面加载：初始化音频播放器和数据 */
  onLoad(this: AudioPageInstance) {
    const artistId = (app.globalData.selectedCharId || "haoyiran") as string;
    const { statusBarHeight } = (wx as any).getWindowInfo?.() ?? {
      statusBarHeight: 20,
    };
    const navBarHeight = statusBarHeight + 44;
    this.setData({ artistId, statusBarHeight, navBarHeight });
    this.initYearRange();

    // 检查 audios 模块是否启用（cached_modules 存在且包含 "audios"）
    if (!isModuleEnabled("audios")) { 
      this.setData({ moduleEnabled: false });
      return;
    }

    this.loadAudiosFromServer(artistId);
    this.initAudioContext();
  },

  /** 页面卸载：销毁音频实例 */
  onUnload(this: AudioPageInstance) {
    this.destroyAudioContext();
  },

  async loadAudiosFromServer(this: AudioPageInstance, artistId: string) {
      const self = this as unknown as AudioInstance;
      try {
        this.setData({ isLoading: true });

        // 1. 获取时间轴数据
        const timelineRes = await fetchAudioTimeline({
          year: this.data.currentYear,
          artistIds: artistId ? [artistId] : undefined,
        });
        const timelineItems = (timelineRes || []) as {
          yearMonth: string;
          count: number;
        }[];
        self._allTimelineItems = timelineItems;
        self._loadingMonths = new Set();

        if (timelineItems.length === 0) {
          this.setData({
            groupedAudios: [],
            allTracks: [],
            isLoading: false,
          });
          return;
        }

        // 2. 构建分组骨架
        const skeletonGroups: GroupedAudios[] = timelineItems.map((t) => ({
          month: this._formatYearMonth(t.yearMonth),
          yearMonth: t.yearMonth,
          tracks: [],
          count: t.count,
          loaded: false,
          loading: false,
        }));

        this.setData({
          groupedAudios: skeletonGroups,
        });

        // 3. 默认加载所有月份数据（因为默认是 ALL）
        await this.loadAllMonths(skeletonGroups, artistId);

        // 设置过滤后的数据（默认显示全部）
        this.setData({ filteredGroupedAudios: skeletonGroups });

        // 4. 设置当前播放状态
        this.syncPlayingState();

        this.setData({ isLoading: false });
      } catch (err) {
        console.error("[audio] 从后端加载数据失败:", err);
        this.setData({ isLoading: false });
      }
    },

    async loadAllMonths(this: AudioPageInstance, groups: GroupedAudios[], artistId: string) {
      // 并行加载所有月份
      await Promise.all(
        groups.map((group, index) =>
          this.loadMonth(group.yearMonth, index, artistId)
        )
      );

      // 合并所有数据到 allTracks
      const allTracks: AudioItem[] = [];
      groups.forEach((group) => {
        allTracks.push(...group.tracks);
      });

      this.setData({ allTracks });
    },

    async loadMonth(this: AudioPageInstance, yearMonth: string, index: number, artistId: string) {
      const self = this as unknown as AudioInstance;

      // 检查是否已失败超过最大重试次数（默认3次）
      const MAX_RETRIES = 3;
      if ((self._failedMonths?.get(yearMonth) ?? 0) >= MAX_RETRIES) {
        console.warn(`[audio] 月份 ${yearMonth} 已失败 ${MAX_RETRIES} 次，停止重试`);
        return;
      }

      if (self._loadingMonths?.has(yearMonth)) return;
      const group = this.data.groupedAudios[index];
      if (!group || group.loaded || group.loading) return;

      if (!self._loadingMonths) self._loadingMonths = new Set();
      if (!self._failedMonths) self._failedMonths = new Map();

      self._loadingMonths.add(yearMonth);
      this.setData({
        [`groupedAudios[${index}].loading`]: true,
      });

      try {
        const allRawAudios: any[] = [];
        let page = 1;
        const pageSize = 50;

        while (true) {
          const res = await fetchAudioList({
            yearMonth,
            page,
            pageSize,
            artistIds: artistId ? [artistId] : undefined,
          });
          if (res?.items?.length) {
            allRawAudios.push(...res.items);
          }
          if (!res?.items || res.items.length < pageSize) break;
          if (res.total != null && allRawAudios.length >= res.total) break;
          page++;
        }

        // 映射数据格式
        const mappedTracks = allRawAudios.map((a: any) => ({
          id: String(a.id),
          title: a.title || "",
          duration: a.duration,
          durationSec:fmtDuration(a.duration),
          thumbnail: getThumbUrl(a.coverUrl) || "",
          author: a.artistId,
          date: a.shootDate
            ? new Date(a.shootDate)
                .toISOString()
                .split("T")[0]
                .replace(/-/g, ".")
            : "",
          bitRate: "",
          audioUrl: getImageUrl(a.originalUrl)  || "",
        }));

        this.setData({
          [`groupedAudios[${index}].tracks`]: mappedTracks,
          [`groupedAudios[${index}].loaded`]: true,
          [`groupedAudios[${index}].loading`]: false,
        });

        // 成功后清除失败记录
        self._failedMonths.delete(yearMonth);
      } catch (err) {
        console.error(`[audio] 加载月份 ${yearMonth} 失败:`, err);
        this.setData({
          [`groupedAudios[${index}].loading`]: false,
        });

        // 记录失败次数
        const failCount = (self._failedMonths.get(yearMonth) || 0) + 1;
        self._failedMonths.set(yearMonth, failCount);
        console.warn(`[audio] 月份 ${yearMonth} 第 ${failCount} 次失败`);
        
        // 如果达到最大重试次数，提示用户
        if (failCount >= MAX_RETRIES) {
          wx.showToast({ title: "数据加载失败，请稍后重试", icon: "none" });
        }
      } finally {
        self._loadingMonths?.delete(yearMonth);
      }
    },

    syncPlayingState(this: AudioPageInstance) {
      const { allTracks } = this.data;
      const playingTrackId = app.globalData.playingTrackId;
      const isPlayingAudio = app.globalData.isPlayingAudio;
      const currentTrack =
        allTracks.find((a: AudioItem) => a.id === playingTrackId) ||
        allTracks[0] ||
        null;

      this.setData({
        playingTrackId,
        isPlayingAudio,
        currentTrack,
      });

      // 如果全局状态显示正在播放且有当前音轨，则自动启动播放
      if (isPlayingAudio && currentTrack && currentTrack.audioUrl) {
        // 延迟执行以确保 InnerAudioContext 已初始化
        setTimeout(() => {
          this.playTrack(currentTrack);
        }, 100);
      }
    },

    /** 获取当前显示的音频列表 */
    getDisplayTracks(this: AudioPageInstance): AudioItem[] {
      const { currentMonth, groupedAudios, allTracks } = this.data;

      // 如果选中 ALL，返回全部数据
      if (!currentMonth || currentMonth === "") {
        return allTracks;
      }

      // 否则筛选对应月份的数据
      return groupedAudios
        .filter(
          (group) => group.yearMonth && group.yearMonth.endsWith(currentMonth)
        )
        .flatMap((group) => group.tracks);
    },

    onTrackRowTap(this: AudioPageInstance, e: WechatMiniprogram.BaseEvent) {
      const trackId = e.currentTarget.dataset.id as string;
      const displayTracks = this.getDisplayTracks();
      const track = displayTracks.find((a: AudioItem) => a.id === trackId);
      if (!track) return;

      app.globalData.playingTrackId = trackId;
      app.globalData.isPlayingAudio = true;

      this.setData({
        playingTrackId: trackId,
        isPlayingAudio: true,
        showNowPlaying: true,
        currentTrack: track,
      });

      this.playTrack(track);
    },

    onTogglePlay(this: AudioPageInstance) {
      const ctx = (this as unknown as AudioInstance)._innerAudioContext;
      if (!ctx) return;

      if (this.data.isPlayingAudio) {
        ctx.pause();
      } else {
        ctx.play();
      }
    },

    /** 初始化 InnerAudioContext */
    initAudioContext(this: AudioPageInstance) {
      const self = this as unknown as AudioInstance;

      // 销毁已有实例
      if (self._innerAudioContext) {
        self._innerAudioContext.destroy();
      }

      // 创建新实例（长音频场景，关闭 WebAudio）
      const ctx = (wx as any).createInnerAudioContext({
        useWebAudioImplement: false,
      });

      ctx.obeyMuteSwitch = false;

      // 播放事件
      ctx.onPlay(() => {
        app.globalData.isPlayingAudio = true;
        this.setData({ isPlayingAudio: true });
        this.startVisualizer();
      });

      // 暂停事件
      ctx.onPause(() => {
        app.globalData.isPlayingAudio = false;
        this.setData({ isPlayingAudio: false });
        this.stopVisualizer();
      });

      // 停止事件
      ctx.onStop(() => {
        app.globalData.isPlayingAudio = false;
        this.setData({ isPlayingAudio: false });
        this.stopVisualizer();
      });

      // 播放结束（自动下一首）
      ctx.onEnded(() => {
        // 如果是因为错误导致的 ended（isPlayingAudio 已被 onError 置为 false），不要自动切歌
        if (!this.data.isPlayingAudio) return;

        app.globalData.isPlayingAudio = false;
        this.setData({ isPlayingAudio: false });
        this.stopVisualizer();
        setTimeout(() => this.onNextTrack(), 500);
      });

      // 进度更新（核心：替换模拟进度）
      ctx.onTimeUpdate(() => {
        const duration = ctx.duration || 0;
        const current = ctx.currentTime || 0;
        if (duration > 0) {
          const progress = Math.min((current / duration) * 100, 100);
          this.setData({
            audioProgress: progress,
            audioCurrentTime: this._formatTime(current),
            audioDuration: this._formatTime(duration),
          });
        }
      });

      // 错误处理（带防死循环保护）
      ctx.onError((err: any) => {
        console.error("[audio] onError:", err);
        const self = this as unknown as AudioInstance;
        const currentTrack = this.data.currentTrack;

        // 防止同一首曲子无限重试导致死循环
        if (self._lastErrorTrackId === currentTrack?.id) {
          self._consecutiveErrors = (self._consecutiveErrors || 0) + 1;
          console.warn(`[audio] 连续播放失败 ${self._consecutiveErrors} 次, trackId=${currentTrack?.id}`);
          
          if (self._consecutiveErrors >= 3) {
            console.warn("[audio] 连续播放失败3次，停止自动切歌，等待用户手动操作");
            app.globalData.isPlayingAudio = false;
            this.setData({
              isPlayingAudio: false,
              audioCurrentTime: "0:00",
            });
            this.stopVisualizer();
            wx.showToast({ title: "播放异常，请稍后重试", icon: "none" });
            return; // 不再触发任何自动操作
          }
        } else {
          // 切换了新曲目，重置计数器
          self._consecutiveErrors = 1;
          self._lastErrorTrackId = currentTrack?.id || null;
        }

        // 原有错误处理
        app.globalData.isPlayingAudio = false;
        this.setData({
          isPlayingAudio: false,
          audioCurrentTime: "0:00",
        });
        this.stopVisualizer();
        // wx.showToast({ title: "播放失败", icon: "none" });
      });

      // 等待可播放（缓冲）
      ctx.onCanplay(() => {
        if (ctx.duration) {
          this.setData({
            audioDuration: this._formatTime(ctx.duration),
          });
        }
      });

      // 缓冲中
      ctx.onWaiting(() => {
      });

      self._innerAudioContext = ctx;
    },

    /** 销毁音频实例 */
    destroyAudioContext(this: AudioPageInstance) {
      const self = this as unknown as AudioInstance;
      if (self._innerAudioContext) {
        self._innerAudioContext.stop();
        self._innerAudioContext.destroy();
        self._innerAudioContext = undefined;
      }
      this.stopVisualizer();
    },

    /** 播放指定音轨 */
    playTrack(this: AudioPageInstance, track: AudioItem) {
      const ctx = (this as unknown as AudioInstance)._innerAudioContext;
      if (!ctx || !track.audioUrl) {
        console.warn("[audio] 无法播放，缺少音频上下文或 URL", { hasCtx: !!ctx, url: track.audioUrl });
        return;
      }

      const self = this as unknown as AudioInstance;

      // 只有切换到不同曲目时才重置错误计数器（防止同一曲目的死循环）
      if (self._lastErrorTrackId !== track.id) {
        self._consecutiveErrors = 0;
        self._lastErrorTrackId = null;
      } else if ((self._consecutiveErrors || 0) >= 3) {
        // 同一曲目已经失败 3 次，拒绝再次播放
        console.warn("[audio] 该曲目已连续失败3次，拒绝再次播放, trackId=", track.id);
        wx.showToast({ title: "播放异常，请稍后重试", icon: "none" });
        return;
      }

      // 重置进度
      this.setData({
        audioProgress: 0,
        audioCurrentTime: "0:00",
        audioDuration: "0:00",
      });

      ctx.stop();

      // 设置新音源并播放
      ctx.src = track.audioUrl;
      ctx.play();
    },

    /** 格式化秒数为 mm:ss */
    _formatTime(this: AudioPageInstance, seconds: number): string {
      if (!seconds || !isFinite(seconds)) return "0:00";
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60);
      return `${m}:${String(s).padStart(2, "0")}`;
    },

    /** 启动波形可视化动画 */
    startVisualizer(this: AudioPageInstance) {
      this.stopVisualizer();
      const timer = setInterval(() => {
        const bars = Array.from({ length: 28 }, () => Math.floor(Math.random() * 70) + 20);
        this.setData({ visualizerBars: bars });
      }, 150);
      (this as unknown as AudioInstance)._visualizerTimer = timer;
    },

    /** 停止波形可视化动画 */
    stopVisualizer(this: AudioPageInstance) {
      const self = this as unknown as AudioInstance;
      if (self._visualizerTimer) {
        clearInterval(self._visualizerTimer);
        self._visualizerTimer = null;
      }
      // 重置为静态波形
      const bars = Array.from({ length: 28 }, () => 15);
      this.setData({ visualizerBars: bars });
    },

    /** 进度条点击事件（阻止冒泡） */
    onMiniPlayerProgressTap(this: AudioPageInstance) {
      // 阻止事件冒泡到mini-player的onMiniPlayerTap
    },

    /** 全屏播放器进度条 - 触摸开始 */
    onNpProgressTouchStart(this: AudioPageInstance, e: WechatMiniprogram.TouchEvent) {
      this._updateProgressFromTouch(e);
      this.setData({ _npIsDragging: true });
    },

    /** 全屏播放器进度条 - 触摸移动 */
    onNpProgressTouchMove(this: AudioPageInstance, e: WechatMiniprogram.TouchEvent) {
      if (!this.data._npIsDragging) return;
      this._updateProgressFromTouch(e);
    },

    /** 全屏播放器进度条 - 触摸结束 */
    onNpProgressTouchEnd(this: AudioPageInstance, _e: WechatMiniprogram.TouchEvent) {
      if (!this.data._npIsDragging) return;

      const ctx = (this as unknown as AudioInstance)._innerAudioContext;
      const duration = ctx?.duration || 0;
      if (duration > 0 && ctx) {
        // 根据最终拖拽进度计算目标秒数并 seek
        const targetSeconds = (this.data._npDraggingProgress / 100) * duration;
        ctx.seek(targetSeconds);
      }

      this.setData({
        _npIsDragging: false,
        _npDraggingProgress: 0,
        _npDraggingTime: "0:00",
      });
    },

    /** 根据触摸位置计算并更新进度 */
    _updateProgressFromTouch(this: AudioPageInstance, e: WechatMiniprogram.TouchEvent) {
      const touch = e.touches[0];
      const query = wx.createSelectorQuery().in(this);
      query.select(".np-progress-bar").boundingClientRect();
      query.exec((res) => {
        if (!res || !res[0]) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rect = res[0] as any;
        let progress = ((touch.clientX - rect.left) / rect.width) * 100;
        progress = Math.max(0, Math.min(100, progress));

        const ctx = (this as unknown as AudioInstance)._innerAudioContext;
        const duration = ctx?.duration || 0;
        const currentSeconds = (progress / 100) * duration;

        this.setData({
          _npDraggingProgress: progress,
          _npDraggingTime: this._formatTime(currentSeconds),
        });
      });
    },

    onNextTrack(this: AudioPageInstance) {
      const displayTracks = this.getDisplayTracks();
      if (displayTracks.length === 0) return;

      const { playingTrackId } = this.data;
      const currentIdx = displayTracks.findIndex(
        (a: AudioItem) => a.id === playingTrackId
      );
      const nextIdx =
        currentIdx >= 0 ? (currentIdx + 1) % displayTracks.length : 0;
      const nextTrack = displayTracks[nextIdx];

      app.globalData.playingTrackId = nextTrack.id;
      this.setData({
        playingTrackId: nextTrack.id,
        isPlayingAudio: true,
        currentTrack: nextTrack,
      });

      this.playTrack(nextTrack);
    },

    onPrevTrack(this: AudioPageInstance) {
      const displayTracks = this.getDisplayTracks();
      if (displayTracks.length === 0) return;

      const { playingTrackId } = this.data;
      const currentIdx = displayTracks.findIndex(
        (a: AudioItem) => a.id === playingTrackId
      );
      const prevIdx =
        currentIdx >= 0
          ? (currentIdx - 1 + displayTracks.length) % displayTracks.length
          : 0;
      const prevTrack = displayTracks[prevIdx];

      app.globalData.playingTrackId = prevTrack.id;
      this.setData({
        playingTrackId: prevTrack.id,
        isPlayingAudio: true,
        currentTrack: prevTrack,
      });

      this.playTrack(prevTrack);
    },

    onMiniPlayerTap(this: AudioPageInstance) {
      this.setData({ showNowPlaying: true });
    },

    onCloseNowPlaying(this: AudioPageInstance) {
      this.setData({ showNowPlaying: false });
    },

    onShowNowPlaying(this: AudioPageInstance, e: WechatMiniprogram.BaseEvent) {
      const trackId = e.currentTarget.dataset.id as string;
      this.onTrackRowTap({
        currentTarget: { dataset: { id: trackId } },
      } as unknown as WechatMiniprogram.BaseEvent);
    },

    onMonthTap(this: AudioPageInstance, e: WechatMiniprogram.BaseEvent) {
      const month = e.currentTarget.dataset.month as string;
      this.setData({ currentMonth: month });
      this.filterGroupedByMonth(month);
    },

    onAllTap(this: AudioPageInstance) {
      // 点击 ALL 按钮，清空 currentMonth
      this.setData({ currentMonth: "" });
      this.filterGroupedByMonth("");
    },

    /** 根据当前月份筛选 groupedAudios */
    filterGroupedByMonth(this: AudioPageInstance, month: string) {
      const { groupedAudios } = this.data;
      if (!month || month === "") {
        // 显示所有月份
        this.setData({ filteredGroupedAudios: groupedAudios });
      } else {
        // 只显示匹配的月份
        const filtered = groupedAudios.filter(
          (group) => group.yearMonth && group.yearMonth.endsWith(month)
        );
        this.setData({ filteredGroupedAudios: filtered });
      }
    },

    /** 初始化年份范围（当前年份前后5年） */
    initYearRange(this: AudioPageInstance) {
      const currentYear = new Date().getFullYear();
      const yearRange: number[] = [];
      for (let y = currentYear - 5; y <= currentYear + 5; y++) {
        yearRange.push(y);
      }
      const yearIndex = yearRange.indexOf(currentYear);
      this.setData({ yearRange, yearIndex: yearIndex >= 0 ? yearIndex : 5 });
    },

    /** 打开/关闭年份弹窗 */
    onToggleYearPicker(this: AudioPageInstance) {
      const { showYearPicker, currentYear, yearRange } = this.data;
      if (!showYearPicker) {
        const idx = yearRange.indexOf(currentYear);
        this.setData({
          showYearPicker: true,
          tempYear: currentYear,
          yearIndex: idx >= 0 ? idx : 0,
        });
      } else {
        this.setData({ showYearPicker: false });
      }
    },

    onCloseYearPicker(this: AudioPageInstance) {
      this.setData({ showYearPicker: false });
    },

    /** 滚动年份 */
    onYearScroll(this: AudioPageInstance, e: WechatMiniprogram.CustomEvent) {
      const val = e.detail.value as number[];
      const { yearRange } = this.data;
      this.setData({ yearIndex: val[0], tempYear: yearRange[val[0]] });
    },

    /** 确认年份 */
    async onConfirmYear(this: AudioPageInstance) {
      const { tempYear, artistId } = this.data;
      this.setData({ currentYear: tempYear, showYearPicker: false });
      // 根据新年份重新加载数据
      await this.loadAudiosFromServer(artistId);
    },

    _formatYearMonth(this: AudioPageInstance, yearMonth: string): string {
      if (!yearMonth || yearMonth.length !== 6) return yearMonth;
      const y = yearMonth.slice(0, 4);
      const m = Number(yearMonth.slice(4, 6));
      return `${y}年${String(m).padStart(2, "0")}月`;
    },
  /** 返回上一页（DevTools 兼容） */
  onGoBack(this: AudioPageInstance) {
    safeNavigateBack();
  },

    // ========== 登录相关方法 ==========

    /** 底部引导点击 → 打开登录弹窗 */
    onGuestFooterLogin(this: AudioPageInstance) {
      this.setData({ showLoginPopup: true });
    },

    /** 登录弹窗回调：登录成功 */
    async onLoginSuccess(this: AudioPageInstance) {
      this.setData({
        isLoggedIn: true,
        showLoginPopup: false,
        _guestLimit: false,
      });
      const artistId = this.data.artistId;
      await this.loadAudiosFromServer(artistId);
    },

    /** 登录弹窗回调：取消 */
    onLoginCancel(this: AudioPageInstance) {
      this.setData({ showLoginPopup: false });
    },
}));
