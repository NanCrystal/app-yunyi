import {
  fetchVideoList,
  fetchVideoTimeline,
  fetchPhotoTypes,
  fetchPhotoLocations,
  fetchPhotoPlatforms,
} from "../../services/api";
import { themeBehavior } from "../../behaviors/theme";
import { getImageUrl, getThumbFullUrl } from "../../utils/util";

const app = getApp<IAppOption>();

interface GroupedVideos {
  month: string;
  yearMonth: string;
  days: { day: string; items: EnhancedVideoItem[] }[];
  count: number;
  loaded: boolean;
  loading: boolean;
}

/** 扩展视频条目，增加加载状态字段 */
interface EnhancedVideoItem {
  id: string;
  playUrl: string;
  coverUrl: string;
  hasCover: boolean;
  loaded: boolean;
  date: string;
  day: string;
  month: string;
  monthAbbr: string;
  title: string;
  file_name: string;
  location: string;
  tags: string[];
  type: string;
  region: string;
  system: string;
  _shootDate?: string;
  duration?: string;
}

interface VideosData {
  selectedType: number[];
  selectedRegion: number[];
  selectedSystem: number[];
  typeItems: { id: number; name: string }[];
  regionItems: { id: number; name: string }[];
  platformItems: { id: number; name: string }[];
  filteredVideos: EnhancedVideoItem[];
  groupedVideos: GroupedVideos[];
  checkedVideoIds: string[];
  showCheckboxMode: boolean;
  previewVideo: EnhancedVideoItem | null;
  previewIndex: number;
  showFilter: boolean;
  currentArtistId: string;

  showDragBtn: boolean;
  isDragExpanded: boolean;
  currentDragDate: string;
  _scrollbarTransform: string;

  isLoading: boolean;
  gridCellSize: number;
  allLoaded: boolean;

  statusBarHeight: number;
}

interface VideosInstance {
  _isDragging?: boolean;
  _dragStartClientY?: number;
  _dragStartScrollTop?: number;
  _scrollView?: any;
  _loadingMonths?: Set<string>;
  _allTimelineItems?: { yearMonth: string; count: number }[];
  _scrollThrottleTimer?: ReturnType<typeof setTimeout> | null;
  _contentHeight?: number;
}

Component({
  behaviors: [themeBehavior],

  data: {
    selectedType: [] as number[],
    selectedRegion: [] as number[],
    selectedSystem: [] as number[],
    typeItems: [] as { id: number; name: string }[],
    regionItems: [] as { id: number; name: string }[],
    platformItems: [] as { id: number; name: string }[],
    filteredVideos: [] as EnhancedVideoItem[],
    groupedVideos: [] as GroupedVideos[],
    checkedVideoIds: [] as string[],
    showCheckboxMode: false,
    previewVideo: null as EnhancedVideoItem | null,
    previewIndex: 0,

    showFilter: false,
    currentArtistId: "",

    showDragBtn: false,
    isDragExpanded: false,
    _scrollbarTransform: "translateY(0)",

    isLoading: false,
    gridCellSize: 0,
    allLoaded: false,

    statusBarHeight: 0,
  } as VideosData,

  lifetimes: {
    async attached() {
      const { statusBarHeight } = wx.getSystemInfoSync();
      this.setData({ statusBarHeight });

      this._calcGridCellSize();

      const self = this as unknown as VideosInstance;
      setTimeout(() => {
        self._scrollView = wx
          .createSelectorQuery()
          .in(this)
          .select("#videoScrollView")
          .node()
          .exec((res: any) => {
            if (res && res[0] && res[0].node) {
              self._scrollView = res[0].node;
            }
          });
      }, 100);

      const artistId = (app.globalData.selectedCharId || "") as string;
      this.setData({
        currentArtistId: artistId,
        isLoading: true,
      });

      // 加载筛选选项
      await this.loadFilterOptions();

      await this.loadVideosFromServer(artistId);

      this.setData({ isLoading: false });
    },
    detached() {},
  },

  methods: {
    onGoBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack();
      } else {
        wx.reLaunch({ url: "/pages/home/home" });
      }
    },

    _calcGridCellSize() {
      const { windowWidth } = wx.getSystemInfoSync();
      const padding = 48;
      const gutter = 4;
      const col = 4;
      const cellSize = Math.floor(
        (windowWidth - padding * 2 - gutter * (col - 1)) / col
      );
      this.setData({ gridCellSize: cellSize });
    },

    onImageLoad(e: WechatMiniprogram.CustomEvent) {
      const { monthIdx, dayIdx, videoIdx } = e.currentTarget.dataset;
      const group = this.data.groupedVideos[monthIdx];
      if (group?.days?.[dayIdx]?.items?.[videoIdx]) {
        this.setData({
          [`groupedVideos[${monthIdx}].days[${dayIdx}].items[${videoIdx}].loaded`]:
            true,
        });
      }
    },

    onImageError(e: WechatMiniprogram.CustomEvent) {
      const { monthIdx, dayIdx, videoIdx } = e.currentTarget.dataset;
      console.warn("[videos] 封面图加载失败", e.currentTarget.dataset);
      const group = this.data.groupedVideos[monthIdx];
      if (group?.days?.[dayIdx]?.items?.[videoIdx]) {
        this.setData({
          [`groupedVideos[${monthIdx}].days[${dayIdx}].items[${videoIdx}].loaded`]:
            true,
        });
      }
    },

    async loadVideosFromServer(artistId: string) {
      const self = this as unknown as VideosInstance;
      try {
        const filterParams = this._buildFilterParams();
        const timelineRes = await fetchVideoTimeline(
          artistId ? { artistIds: [artistId], ...filterParams } : filterParams
        );
        const timelineItems = (timelineRes || []) as {
          yearMonth: string;
          count: number;
        }[];
        self._allTimelineItems = timelineItems;
        self._loadingMonths = new Set();

        if (timelineItems.length === 0) {
          this.setData({ filteredVideos: [], groupedVideos: [] });
          return;
        }

        const skeletonGroups: GroupedVideos[] = timelineItems.map((t) => ({
          month: this._formatYearMonth(t.yearMonth),
          yearMonth: t.yearMonth,
          days: [],
          count: t.count,
          loaded: false,
          loading: false,
        }));

        this.setData({
          groupedVideos: skeletonGroups,
          filteredVideos: [],
        });

        if (timelineItems.length > 0) {
          await this.loadMonth(timelineItems[0].yearMonth, 0, artistId);
        }
      } catch (err) {
        console.error("[videos] 从后端加载数据失败:", err);
      }
    },

    async loadMonth(yearMonth: string, index: number, artistId: string) {
      const self = this as unknown as VideosInstance;

      if (self._loadingMonths?.has(yearMonth)) return;
      const group = this.data.groupedVideos[index];
      if (!group || group.loaded || group.loading) return;

      if (!self._loadingMonths) self._loadingMonths = new Set();

      self._loadingMonths.add(yearMonth);
      this.setData({
        [`groupedVideos[${index}].loading`]: true,
      });

      try {
        const allRawVideos: any[] = [];
        let page = 1;
        const pageSize = 50;
        const filterParams = this._buildFilterParams();
        while (true) {
          const res = await fetchVideoList({
            yearMonth,
            page,
            pageSize,
            artistIds: artistId ? [artistId] : undefined,
            ...filterParams,
          });
          if (res?.items?.length) {
            allRawVideos.push(...res.items);
          }
          if (!res?.items || res.items.length < pageSize) break;
          if (res.total != null && allRawVideos.length >= res.total) break;
          page++;
        }

        const mappedVideos: EnhancedVideoItem[] = allRawVideos.map((v: any) => {
          const rawCoverUrl = v.coverUrl ? getThumbFullUrl(v.coverUrl) : "";
          return {
            id: String(v.id),
            playUrl: getImageUrl(v.playUrl) || "",
            coverUrl: rawCoverUrl,
            hasCover: !!rawCoverUrl,
            loaded: false,
            date: v.shootDate
              ? new Date(v.shootDate).toLocaleDateString("zh-CN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "",
            day: v.shootDate
              ? `${new Date(v.shootDate).getMonth() + 1}月${new Date(
                  v.shootDate
                ).getDate()}日`
              : "",
            month: v.shootDate
              ? `${new Date(v.shootDate).getFullYear()}年${String(
                  new Date(v.shootDate).getMonth() + 1
                ).padStart(2, "0")}月`
              : "",
            monthAbbr: v.shootDate
              ? new Date(v.shootDate)
                  .toLocaleDateString("en-US", { month: "short" })
                  .toUpperCase()
              : "",
            title: v.title || v.description || "",
            file_name: v.fileName || "",
            location: v.videoLocation?.name || "",
            tags: [],
            type: v.videoType?.name || "Video",
            region: v.videoLocation?.name || ("Shanghai" as any),
            system: v.tagPlatform?.name || ("Platform" as any),
            _shootDate: v.shootDate,
            duration: v.duration || "",
          };
        });

        const dayMap: Record<string, EnhancedVideoItem[]> = {};
        mappedVideos.forEach((v) => {
          const d = v.day || "未知";
          if (!dayMap[d]) dayMap[d] = [];
          dayMap[d].push(v);
        });

        const days = Object.keys(dayMap)
          .sort((a, b) => b.localeCompare(a))
          .map((day) => ({ day, items: dayMap[day] }));

        const updateData: Record<string, any> = {
          [`groupedVideos[${index}].days`]: days,
          [`groupedVideos[${index}].loaded`]: true,
          [`groupedVideos[${index}].loading`]: false,
        };

        const currentFiltered = [...this.data.filteredVideos];
        const existingIdxs: number[] = [];
        currentFiltered.forEach((v, i) => {
          if (
            v.month &&
            v.month.includes(yearMonth.slice(0, 4)) &&
            v.month.includes(
              `${Number(yearMonth.slice(4)).toString().padStart(2, "0")}月`
            )
          ) {
            existingIdxs.push(i);
          }
        });
        for (let i = existingIdxs.length - 1; i >= 0; i--) {
          currentFiltered.splice(existingIdxs[i], 1);
        }
        currentFiltered.push(...mappedVideos);

        updateData.filteredVideos = currentFiltered;

        this.setData(updateData);

        this._checkAllLoaded();
      } catch (err) {
        console.error(`[videos] 加载月份 ${yearMonth} 失败:`, err);
        this.setData({
          [`groupedVideos[${index}].loading`]: false,
        });
      } finally {
        self._loadingMonths?.delete(yearMonth);
      }
    },

    _formatYearMonth(yearMonth: string): string {
      if (!yearMonth || yearMonth.length !== 6) return yearMonth;
      const y = yearMonth.slice(0, 4);
      const m = Number(yearMonth.slice(4, 6));
      return `${y}年${String(m).padStart(2, "0")}月`;
    },

    async loadFilterOptions() {
      try {
        const [types, locations, platforms] = await Promise.all([
          fetchPhotoTypes(),
          fetchPhotoLocations(),
          fetchPhotoPlatforms(),
        ]);
        this.setData({
          typeItems: types || [],
          regionItems: locations || [],
          platformItems: platforms || [],
        });
      } catch (err) {
        console.error("[videos] 加载筛选选项失败:", err);
      }
    },

    onTogglfilterPicker() {
      const newVal = !this.data.showFilter;
      this.setData({ showFilter: newVal });
    },

    onToggleCheckboxMode() {
      const newVal = !this.data.showCheckboxMode;
      this.setData({
        showCheckboxMode: newVal,
        checkedVideoIds: [],
      });
    },

    onMonthCheckTap(e: WechatMiniprogram.BaseEvent) {
      const monthIdx = e.currentTarget.dataset.monthIdx as number;
      const group = this.data.groupedVideos[monthIdx];
      if (!group?.loaded || !group.days?.length) return;

      const allVideoIds: string[] = [];
      group.days.forEach((day) => {
        day.items?.forEach((video) => {
          allVideoIds.push(video.id);
        });
      });

      const isAllChecked = allVideoIds.every((id) =>
        this.data.checkedVideoIds.includes(id)
      );

      let newChecked: string[];
      if (isAllChecked) {
        newChecked = this.data.checkedVideoIds.filter(
          (id) => !allVideoIds.includes(id)
        );
      } else {
        const existingIds = new Set(this.data.checkedVideoIds);
        allVideoIds.forEach((id) => existingIds.add(id));
        newChecked = Array.from(existingIds);
      }

      this.setData({ checkedVideoIds: newChecked });
    },

    onDayCheckTap(e: WechatMiniprogram.BaseEvent) {
      const monthIdx = e.currentTarget.dataset.monthIdx as number;
      const dayIdx = e.currentTarget.dataset.dayIdx as number;
      const group = this.data.groupedVideos[monthIdx];
      if (!group?.days?.[dayIdx]) return;

      const dayItems = group.days[dayIdx].items || [];
      const dayVideoIds = dayItems.map((v) => v.id);

      if (dayVideoIds.length === 0) return;

      const isAllChecked = dayVideoIds.every((id) =>
        this.data.checkedVideoIds.includes(id)
      );

      let newChecked: string[];
      if (isAllChecked) {
        newChecked = this.data.checkedVideoIds.filter(
          (id) => !dayVideoIds.includes(id)
        );
      } else {
        const existingIds = new Set(this.data.checkedVideoIds);
        dayVideoIds.forEach((id) => existingIds.add(id));
        newChecked = Array.from(existingIds);
      }

      this.setData({ checkedVideoIds: newChecked });
    },

    onDownloadSelected() {
      const { checkedVideoIds, filteredVideos } = this.data;
      if (checkedVideoIds.length === 0) {
        wx.showToast({ title: "请先选择视频", icon: "none" });
        return;
      }

      wx.showLoading({ title: "准备下载..." });

      const selectedVideos = filteredVideos.filter((v) =>
        checkedVideoIds.includes(v.id)
      );

      let completed = 0;
      selectedVideos.forEach((video) => {
        if (!video.playUrl) {
          completed++;
          if (completed === selectedVideos.length) {
            wx.hideLoading();
            wx.showToast({ title: `部分视频无下载链接`, icon: "none" });
          }
          return;
        }
        wx.downloadFile({
          url: video.playUrl,
          success: (res) => {
            if (res.statusCode === 200) {
              wx.saveVideoToPhotosAlbum({
                filePath: res.tempFilePath,
                success: () => {
                  completed++;
                  if (completed === selectedVideos.length) {
                    wx.hideLoading();
                    wx.showToast({
                      title: `已下载 ${completed} 个`,
                      icon: "success",
                    });
                  }
                },
                fail: () => {
                  completed++;
                  console.warn("[videos] 保存到相册失败", video.id);
                },
              });
            }
          },
          fail: () => {
            completed++;
            console.error("[videos] 下载失败", video.id);
            if (completed === selectedVideos.length) {
              wx.hideLoading();
              wx.showToast({ title: "下载失败", icon: "none" });
            }
          },
        });
      });
    },

    onCloseFilter() {
      this.setData({ showFilter: false });
    },
    preventMove() {},
    preventBubble() {},
    onTypeChange(e: WechatMiniprogram.CustomEvent) {
      const value = e.currentTarget.dataset.value as number;
      const selected = [...this.data.selectedType];
      const idx = selected.indexOf(value);
      if (idx >= 0) {
        selected.splice(idx, 1);
      } else {
        selected.push(value);
      }
      this.setData({ selectedType: selected });
    },

    onRegionChange(e: WechatMiniprogram.CustomEvent) {
      const value = e.currentTarget.dataset.value as number;
      const selected = [...this.data.selectedRegion];
      const idx = selected.indexOf(value);
      if (idx >= 0) {
        selected.splice(idx, 1);
      } else {
        selected.push(value);
      }
      this.setData({ selectedRegion: selected });
    },

    onSystemChange(e: WechatMiniprogram.CustomEvent) {
      const value = e.currentTarget.dataset.value as number;
      const selected = [...this.data.selectedSystem];
      const idx = selected.indexOf(value);
      if (idx >= 0) {
        selected.splice(idx, 1);
      } else {
        selected.push(value);
      }
      this.setData({ selectedSystem: selected });
    },

    onResetFilter(e: WechatMiniprogram.TouchEvent) {
      const type = e.currentTarget.dataset.type as "type" | "region" | "system";
      const updateData: Record<string, any> = {};
      if (type === "type") updateData.selectedType = [];
      else if (type === "region") updateData.selectedRegion = [];
      else if (type === "system") updateData.selectedSystem = [];
      this.setData(updateData);
    },
    onResetFilterAll() {
      this.setData({
        selectedType: [],
        selectedRegion: [],
        selectedSystem: [],
      });
    },
    async onConfirmFilter() {
      this.setData({ showFilter: false, isLoading: true });
      const artistId = this.data.currentArtistId;
      await this.loadVideosFromServer(artistId);
      this.setData({ isLoading: false });
    },

    _buildFilterParams() {
      const { selectedType, selectedRegion, selectedSystem } = this.data;
      return {
        typeIds: selectedType.length > 0 ? selectedType : undefined,
        locationIds: selectedRegion.length > 0 ? selectedRegion : undefined,
        platformIds: selectedSystem.length > 0 ? selectedSystem : undefined,
      };
    },

    /** 点击视频项 → 全屏预览播放 */
    onVideoTap(e: WechatMiniprogram.BaseEvent) {
      const videoId = e.currentTarget.dataset.id as string;
      const filtered = this.data.filteredVideos;
      const index = filtered.findIndex(
        (v: EnhancedVideoItem) => v.id === videoId
      );
      console.log("onVideoTap", videoId, filtered, index);
      if (index >= 0) {
        this.setData({ previewVideo: filtered[index], previewIndex: index });
      }
    },

    onCheckTap(e: WechatMiniprogram.BaseEvent) {
      (e as any).stopPropagation?.();
      const videoId = e.currentTarget.dataset.id as string;
      const checked = this.data.checkedVideoIds;
      const newChecked = checked.includes(videoId)
        ? checked.filter((id: string) => id !== videoId)
        : [...checked, videoId];
      this.setData({ checkedVideoIds: newChecked });
    },

    onClosePreview() {
      this.setData({ previewVideo: null });
    },

    onPrevPreview() {
      const { previewIndex, filteredVideos } = this.data;
      const newIndex =
        previewIndex > 0 ? previewIndex - 1 : filteredVideos.length - 1;
      this.setData({
        previewVideo: filteredVideos[newIndex],
        previewIndex: newIndex,
      });
    },

    onNextPreview() {
      const { previewIndex, filteredVideos } = this.data;
      const newIndex =
        previewIndex < filteredVideos.length - 1 ? previewIndex + 1 : 0;
      this.setData({
        previewVideo: filteredVideos[newIndex],
        previewIndex: newIndex,
      });
    },

    onScroll(e: any) {
      const scrollTop = e.detail.scrollTop;

      if (scrollTop > 0) {
        this.showDragButton();
      } else {
        this.hideDragButton();
      }

      this.updateCurrentVisibleDate(scrollTop);

      const self = this as unknown as VideosInstance;
      this._updateScrollbarPosition(scrollTop);

      if (self._scrollThrottleTimer) return;
      self._scrollThrottleTimer = setTimeout(() => {
        self._scrollThrottleTimer = null;
        this._lazyLoadVisibleMonths(scrollTop);
      }, 150);
    },

    _updateScrollbarPosition(scrollTop: number) {
      const { windowHeight } = wx.getSystemInfoSync();
      const self = this as unknown as VideosInstance;
      const contentHeight = self._contentHeight || 10000;
      const maxScroll = Math.max(1, contentHeight - windowHeight);
      const btnHeight = 80;
      const padding = 20;
      const trackHeight = windowHeight - btnHeight - padding * 2;
      const ratio = scrollTop / maxScroll;
      const translateY = Math.min(
        trackHeight,
        Math.max(0, ratio * trackHeight)
      );

      this.setData({
        _scrollbarTransform: `translateY(${translateY}px)`,
      });
    },

    _measureContentHeight() {
      const self = this as unknown as VideosInstance;
      wx.createSelectorQuery()
        .in(this)
        .select(".photos-content")
        .boundingClientRect((rect: any) => {
          if (rect?.height) {
            self._contentHeight = rect.height + 200;
          }
        })
        .exec();
    },

    _lazyLoadVisibleMonths(scrollTop: number) {
      const { groupedVideos, currentArtistId } = this.data;
      if (!groupedVideos || groupedVideos.length === 0) return;

      const { windowHeight } = wx.getSystemInfoSync();
      const itemH = this.data.gridCellSize;

      let accumulatedHeight = 0;
      const positions: { index: number; top: number; bottom: number }[] = [];

      for (let i = 0; i < groupedVideos.length; i++) {
        const group = groupedVideos[i];
        const top = accumulatedHeight;
        let height = 72;

        if (group.loaded && group.days.length > 0) {
          group.days.forEach((d) => {
            height += 44 + Math.ceil(d.items.length / 4) * itemH + 20;
          });
        } else {
          const estDays = Math.max(1, Math.ceil(group.count / 10));
          height += estDays * (44 + itemH) + Math.ceil(group.count / 4) * itemH;
        }

        positions.push({ index: i, top, bottom: accumulatedHeight + height });
        accumulatedHeight += height;
      }

      const visBottom = scrollTop + windowHeight;
      let triggered = false;
      let firstLoadedMonthIdx = -1;

      for (let j = 0; j < positions.length && !triggered; j++) {
        const pos = positions[j];
        const group = groupedVideos[pos.index];

        if (pos.bottom <= scrollTop) continue;
        if (pos.top >= visBottom) break;

        if (!group.loaded && !group.loading) {
          this.loadMonth(group.yearMonth, pos.index, currentArtistId);
          triggered = true;
          break;
        }

        if (firstLoadedMonthIdx < 0 && group.loaded) {
          firstLoadedMonthIdx = pos.index;
        }
      }

      if (!triggered && firstLoadedMonthIdx >= 0) {
        const nextPos = positions[firstLoadedMonthIdx + 1];
        const nextGroup = nextPos ? groupedVideos[nextPos.index] : null;
        const triggerThreshold = scrollTop + windowHeight * 0.6;

        if (
          nextGroup &&
          !nextGroup.loaded &&
          !nextGroup.loading &&
          nextPos.top >= triggerThreshold &&
          nextPos.top <= visBottom
        ) {
          this.loadMonth(
            nextGroup.yearMonth,
            firstLoadedMonthIdx + 1,
            currentArtistId
          );
        }
      }
    },

    showDragButton() {
      if (!this.data.showDragBtn) {
        this.setData({ showDragBtn: true });
        this._measureContentHeight();
      }
    },

    hideDragButton() {
      this.setData({
        showDragBtn: false,
        isDragExpanded: false,
      });
    },

    updateCurrentVisibleDate(scrollTop: number) {
      const { groupedVideos } = this.data;
      if (!groupedVideos || groupedVideos.length === 0) return;

      const systemInfo = wx.getWindowInfo();
      const itemHeight = (systemInfo.windowWidth - 96) / 4;
      const monthHeaderHeight = 56;
      const dayTitleHeight = 36;
      let accumulatedHeight = 0;
      let currentDate = "";
      let currentMonth = "";

      for (const group of groupedVideos) {
        const groupStart = accumulatedHeight;
        accumulatedHeight += monthHeaderHeight + 16;

        for (let dayIdx = 0; dayIdx < group.days.length; dayIdx++) {
          const dayGroup = group.days[dayIdx];
          const photoRowCount = Math.ceil(dayGroup.items.length / 4);
          const dayGroupHeight =
            dayTitleHeight + photoRowCount * itemHeight + 20;

          if (
            scrollTop >= accumulatedHeight &&
            scrollTop < accumulatedHeight + dayGroupHeight
          ) {
            currentMonth = group.month;
            const dayOnly = dayGroup.day.replace(/^\d+月/, "");
            currentDate = `${currentMonth}${dayOnly}`;
            break;
          }
          accumulatedHeight += dayGroupHeight;
        }

        if (currentDate) break;

        if (
          scrollTop >= groupStart &&
          scrollTop < accumulatedHeight &&
          !currentDate
        ) {
          currentMonth = group.month;
          const firstDayOnly = (group.days[0]?.day || "").replace(/^\d+月/, "");
          currentDate = `${currentMonth}${firstDayOnly}`;
        }
      }

      if (!currentDate && groupedVideos.length > 0) {
        const firstGroup = groupedVideos[0];
        currentDate = `${firstGroup.month}${
          firstGroup.days[0]?.day || this.data.currentDragDate
        }`;
      }

      if (currentDate && currentDate !== this.data.currentDragDate) {
        this.setData({ currentDragDate: currentDate });
      }
    },

    onDragTouchStart(e: WechatMiniprogram.TouchEvent) {
      const self = this as unknown as VideosInstance;
      self._isDragging = true;
      self._dragStartClientY = e.touches[0].clientY;

      wx.createSelectorQuery()
        .in(this)
        .select("#videoScrollView")
        .scrollOffset((res: any) => {
          self._dragStartScrollTop = res.scrollTop || 0;
        })
        .exec();

      this.setData({ isDragExpanded: true });
    },

    onDragTouchMove(e: WechatMiniprogram.TouchEvent) {
      const self = this as unknown as VideosInstance;
      if (!self._isDragging || self._dragStartScrollTop == null) return;

      const deltaY = e.touches[0].clientY - (self._dragStartClientY || 0);
      const { windowHeight } = wx.getSystemInfoSync();
      const contentHeight = self._contentHeight || 10000;

      const maxScroll = contentHeight - windowHeight;
      const btnHeight = 40;
      const padding = 20;
      const trackHeight = windowHeight - btnHeight - padding * 2;
      const scale = Math.max(1, maxScroll / trackHeight);
      const scrollDelta = deltaY * scale;
      const newScrollTop = Math.max(
        0,
        Math.min(maxScroll, self._dragStartScrollTop + scrollDelta)
      );

      if (
        self._scrollView &&
        typeof (self._scrollView as any).scrollTo === "function"
      ) {
        (self._scrollView as any).scrollTo({
          top: newScrollTop,
          animated: false,
        });
      }
    },

    onDragTouchEnd() {
      const self = this as unknown as VideosInstance;
      self._isDragging = false;
      self._dragStartClientY = undefined;
      self._dragStartScrollTop = undefined;
      this.setData({ isDragExpanded: false });
    },

    _checkAllLoaded() {
      const { groupedVideos } = this.data;
      if (!groupedVideos || groupedVideos.length === 0) return;

      const allLoaded = groupedVideos.every((g) => g.loaded);
      if (allLoaded !== this.data.allLoaded) {
        this.setData({ allLoaded });
      }
    },
  },
});
