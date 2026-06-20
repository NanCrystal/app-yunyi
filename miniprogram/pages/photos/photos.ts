import {
  getPhotos,
  fetchPhotoList,
  fetchPhotoTimeline,
  fetchPhotoTypes,
  fetchPhotoLocations,
  fetchPhotoPlatforms,
} from "../../services/api";
import type { PhotoItem } from "../../utils/types";
import { withTheme } from "../../behaviors/theme";
import { getThumbFullUrl, buildThumbUrl, getImageUrl } from "../../utils/util";
import { isLoggedIn } from "../../utils/auth";
import { safeNavigateBack } from "../../utils/nav";

const app = getApp<IAppOption>();

interface GroupedPhotos {
  month: string;
  yearMonth: string; // "202606" 格式，用于标识和请求
  days: { day: string; items: EnhancedPhotoItem[] }[];
  count: number;
  loaded: boolean; // 该月份是否已加载真实数据
  loading: boolean; // 是否正在加载中
}

/** 扩展 PhotoItem，增加加载状态字段 */
interface EnhancedPhotoItem extends PhotoItem {
  rawUrl: string; // 原图 URL（用于预览）
  thumbUrl: string; // 高质量缩略图 URL
  loaded: boolean; // 是否加载完成
  size?: number; // 文件大小（字节），用于预览中显示
}

interface PhotosData {
  selectedType: number[];
  selectedRegion: number[];
  selectedSystem: number[];
  typeItems: { id: number; name: string }[];
  regionItems: { id: number; name: string }[];
  platformItems: { id: number; name: string }[];
  filteredPhotos: EnhancedPhotoItem[];
  groupedPhotos: GroupedPhotos[];
  checkedPhotoIds: string[];
  showCheckboxMode: boolean;
  previewPhoto: EnhancedPhotoItem | null;
  previewIndex: number;
  showFilter: boolean;
  // 当前选中的艺人 ID
  currentArtistId: string;

  // 拖拽按钮（模拟滚动条）
  showDragBtn: boolean;
  isDragExpanded: boolean;
  currentDragDate: string; // 按住按钮时显示的当前日期
  _scrollbarTransform: string; // transform 值，GPU 加速定位

  // 加载状态
  isLoading: boolean;
  // 网格单元格尺寸（用于骨架屏）
  gridCellSize: number;
  loadedPhotoCount: number;
  totalPhotoCount: number;

  // 自定义导航栏
  statusBarHeight: number;

  // 登录状态
  isLoggedIn: boolean;
  showLoginPopup: boolean;
  _guestLimit: boolean;
}

// 扩展组件实例类型以支持自定义属性
interface PhotosInstance {
  _isDragging?: boolean;
  _dragStartClientY?: number; // 手指起始 Y
  _dragStartScrollTop?: number; // 起始滚动位置
  _scrollView?: any; // ScrollView Node 实例
  _loadingMonths?: Set<string>;
  _allTimelineItems?: { yearMonth: string; count: number }[];
  _scrollThrottleTimer?: ReturnType<typeof setTimeout> | null;
  _contentHeight?: number; // 内容总高度（用于计算滚动条比例）
}

Page(withTheme({
  data: {
    selectedType: [] as number[],
    selectedRegion: [] as number[],
    selectedSystem: [] as number[],
    typeItems: [] as { id: number; name: string }[], // 照片类型
    regionItems: [] as { id: number; name: string }[], //拍摄地点
    platformItems: [] as { id: number; name: string }[], //拍摄平台
    filteredPhotos: [] as EnhancedPhotoItem[],
    groupedPhotos: [] as GroupedPhotos[],
    checkedPhotoIds: [] as string[],
    showCheckboxMode: false,
    previewPhoto: null as EnhancedPhotoItem | null,
    previewIndex: 0,

    showFilter: false,
    // 从全局状态获取当前选中的艺人 ID
    currentArtistId: "",

    // 拖拽按钮（模拟滚动条）
    showDragBtn: false,
    isDragExpanded: false,
    currentDragDate: "",
    _scrollbarTransform: "translateY(0)",

    // 加载状态
    isLoading: false,
    // 网格单元格尺寸（用于骨架屏）
    gridCellSize: 0,
    //当前加载了多少张
    loadedPhotoCount: 0,
    //总共有多少张
    totalPhotoCount: 0,
    // 是否已加载全部数据
    allLoaded: false,

    // 自定义导航栏
    statusBarHeight: 0,

    // 登录状态
    isLoggedIn: isLoggedIn(),
    showLoginPopup: false,
    _guestLimit: false,
  } as PhotosData,

  /** 页面加载：初始化所有数据和组件实例 */
  async onLoad() {
    // 同步登录状态
    this.setData({ isLoggedIn: isLoggedIn() });
    // 获取系统状态栏高度（用于自定义导航栏）
    const { statusBarHeight } = wx.getWindowInfo();
    this.setData({ statusBarHeight });

    // 计算网格单元格尺寸（用于骨架屏）
    this._calcGridCellSize();

    // 获取 scroll-view 实例（用于拖拽时控制滚动）
    const self = this as unknown as PhotosInstance;
    setTimeout(() => {
      self._scrollView = wx
        .createSelectorQuery()
        .in(this)
        .select("#photoScrollView")
        .node()
        .exec((res: any) => {
          if (res && res[0] && res[0].node) {
            self._scrollView = res[0].node;
          }
        });
    }, 100);

    // 从全局状态获取当前选中的艺人 ID
    const artistId = (app.globalData.selectedCharId || "") as string;
    this.setData({
      currentArtistId: artistId,
      isLoading: true,
    });

    // 加载筛选选项
    await this.loadFilterOptions();

    // 调用后端接口加载照片数据
    await this.loadPhotosFromServer(artistId);

    this.setData({ isLoading: false });
  },

  /** 页面卸载：清理资源 */
  onUnload() {
    // 清理工作（如需要）
  },

  /** 返回上一页（DevTools 兼容） */
  onGoBack() {
    safeNavigateBack();
  },

    /** 重置所有缓存状态，强制下次访问时重新拉取数据（用于 reprocess 后刷新） */
    resetCache() {
      const self = this as unknown as PhotosInstance;
      self._allTimelineItems = undefined;
      self._loadingMonths = new Set();
      // 重置已加载月份的标记，触发重新请求
      const groups = this.data.groupedPhotos;
      if (groups && groups.length > 0) {
        const resetGroups = groups.map((g) => ({ ...g, loaded: false, loading: false, days: [] }));
        this.setData({ groupedPhotos: resetGroups });
      }
      this.setData({ filteredPhotos: [] });
    },

    /** 下拉刷新处理：重置缓存并重新加载数据 */
    async onPullDownRefresh() {
      const artistId = (app.globalData.selectedCharId || "") as string;
      this.resetCache();
      this.setData({ isLoading: true, currentArtistId: artistId });
      await this.loadPhotosFromServer(artistId);
      this.setData({ isLoading: false });
      wx.stopPullDownRefresh();
    },

    /** 计算网格单元格尺寸（逻辑像素） */
    _calcGridCellSize() {
      const { windowWidth } = wx.getWindowInfo();
      const padding = 48;
      const gutter = 4;
      const col = 4;
      const cellSize = Math.floor(
        (windowWidth - padding * 2 - gutter * (col - 1)) / col
      );
      this.setData({ gridCellSize: cellSize });
    },

    /**
     * 图片加载完成：精准更新该照片的 loaded 状态
     */
    onImageLoad(e: WechatMiniprogram.CustomEvent) {
      const { monthIdx, dayIdx, photoIdx } = e.currentTarget.dataset;
      const group = this.data.groupedPhotos[monthIdx];
      if (group?.days?.[dayIdx]?.items?.[photoIdx]) {
        this.setData({
          [`groupedPhotos[${monthIdx}].days[${dayIdx}].items[${photoIdx}].loaded`]:
            true,
        });
      }
    },

    /**
     * 图片加载失败：标记为 loaded 隐藏骨架屏
     */
    onImageError(e: WechatMiniprogram.CustomEvent) {
      const { monthIdx, dayIdx, photoIdx } = e.currentTarget.dataset;
      console.warn("[photos] 图片加载失败", e.currentTarget.dataset);
      const group = this.data.groupedPhotos[monthIdx];
      if (group?.days?.[dayIdx]?.items?.[photoIdx]) {
        this.setData({
          [`groupedPhotos[${monthIdx}].days[${dayIdx}].items[${photoIdx}].loaded`]:
            true,
        });
      }
    },
    /**
     * 方案B：按需加载月份（骨架屏 + 懒加载）
     * 1. timeline → 立即渲染骨架屏占位
     * 2. 预加载最近1个月份 → 首屏快速可见
     * 3. onScroll 时按需加载进入视口的月份
     */
    async loadPhotosFromServer(artistId: string) {
      const self = this as unknown as PhotosInstance;
      try {
        // ====== 第一步：获取时间轴（仅 1 次请求）======
        const filterParams = this._buildFilterParams();
        const timelineRes = await fetchPhotoTimeline(
          artistId ? { artistIds: [artistId], ...filterParams } : filterParams
        );
        const timelineItems = (timelineRes || []) as {
          yearMonth: string;
          count: number;
        }[];
        self._allTimelineItems = timelineItems;
        self._loadingMonths = new Set();

        if (timelineItems.length === 0) {
          this.setData({ filteredPhotos: [], groupedPhotos: [] });
          return;
        }

        // ====== 第二步：构建骨架屏分组（立即渲染，用户秒见标题）======
        const { gridCellSize } = this.data;
        const { pixelRatio } = wx.getWindowInfo();
        const physicalSize = Math.round(gridCellSize * pixelRatio) || 200;

        const skeletonGroups: GroupedPhotos[] = timelineItems.map((t) => ({
          month: this._formatYearMonth(t.yearMonth),
          yearMonth: t.yearMonth,
          days: [], // 骨架态无真实数据
          count: t.count,
          loaded: false, // 标记未加载
          loading: false,
        }));

        this.setData({
          groupedPhotos: skeletonGroups,
          filteredPhotos: [],
        });

        // ====== 第三步：预加载最近月份 → 自动链式填充视口 ======
        // loadMonth 成功后会自动调用 _fillViewport() 填充更多月份到当前视口
        if (timelineItems.length > 0) {
          await this.loadMonth(
            timelineItems[0].yearMonth,
            0,
            artistId,
            physicalSize
          );
        }
      } catch (err) {
        console.error("[photos] 从后端加载数据失败:", err);
        this.applyFilters(); // 降级使用本地 mock 数据
      }
    },

    /**
     * 加载单个月份的照片数据
     * @param yearMonth "202606"
     * @param index groupedPhotos 数组中的索引位置
     * @param artistId 当前艺人ID
     * @param physicalSize 缩略图物理像素尺寸
     */
    async loadMonth(
      yearMonth: string,
      index: number,
      artistId: string,
      physicalSize: number
    ) {
      const self = this as unknown as PhotosInstance;

      // 防重复请求
      if (self._loadingMonths?.has(yearMonth)) return;
      const group = this.data.groupedPhotos[index];
      if (!group || group.loaded || group.loading) return;

      // 确保集合已初始化
      if (!self._loadingMonths) self._loadingMonths = new Set();

      // 标记加载中
      self._loadingMonths.add(yearMonth);
      this.setData({
        [`groupedPhotos[${index}].loading`]: true,
      });

      try {
        // 分页加载该月份全部照片
        const allRawPhotos: any[] = [];
        let page = 1;
        const pageSize = 50;
        const filterParams = this._buildFilterParams();
        while (true) {
          const res = await fetchPhotoList({
            yearMonth,
            page,
            pageSize,
            artistIds: artistId ? [artistId] : undefined,
            ...filterParams,
          });
          if (res?.items?.length) {
            allRawPhotos.push(...res.items);
          }
          if (!res?.items || res.items.length < pageSize) break;
          if (res.total != null && allRawPhotos.length >= res.total) break;
          page++;
        }

        // 映射为前端 EnhancedPhotoItem 格式
        const mappedPhotos: EnhancedPhotoItem[] = allRawPhotos.map((p: any) => {
          const rawUrl = getImageUrl(p.url);
          return {
            id: String(p.id),
            url: getThumbFullUrl(p.url),
            rawUrl,
            thumbUrl: buildThumbUrl(rawUrl, physicalSize),
            loaded: false,
            date: p.shootDate
              ? new Date(p.shootDate).toLocaleDateString("zh-CN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "",
            day: p.shootDate
              ? `${new Date(p.shootDate).getMonth() + 1}月${new Date(
                  p.shootDate
                ).getDate()}日`
              : "",
            month: p.shootDate
              ? `${new Date(p.shootDate).getFullYear()}年${String(
                  new Date(p.shootDate).getMonth() + 1
                ).padStart(2, "0")}月`
              : "",
            monthAbbr: p.shootDate
              ? new Date(p.shootDate)
                  .toLocaleDateString("en-US", { month: "short" })
                  .toUpperCase()
              : "",
            title: p.title || p.description || "",
            file_name: p.fileName || "",
            location: p.photoLocation?.name || "",
            tags: [],
            type: p.photoType?.name || "Portrait",
            region: p.photoLocation?.name || ("Shanghai" as any),
            system: p.photoPlatform?.name || ("Phase One" as any),
            size: p.size,
            _shootDate: p.shootDate,
          };
        });

        // 按日分组
        const dayMap: Record<string, EnhancedPhotoItem[]> = {};
        mappedPhotos.forEach((p) => {
          const d = p.day || "未知";
          if (!dayMap[d]) dayMap[d] = [];
          dayMap[d].push(p);
        });

        const days = Object.keys(dayMap)
          .sort((a, b) => b.localeCompare(a))
          .map((day) => ({ day, items: dayMap[day] }));

        // 更新 groupedPhotos 中该月份的数据
        const updateData: Record<string, any> = {
          [`groupedPhotos[${index}].days`]: days,
          [`groupedPhotos[${index}].loaded`]: true,
          [`groupedPhotos[${index}].loading`]: false,
        };

        // 同步追加到 filteredPhotos（预览功能需要）
        const currentFiltered = [...this.data.filteredPhotos];
        // 移除该月份旧数据（如果有的话），再追加新的
        const existingIdxs: number[] = [];
        currentFiltered.forEach((p, i) => {
          if (
            p.month &&
            p.month.includes(yearMonth.slice(0, 4)) &&
            p.month.includes(
              `${Number(yearMonth.slice(4)).toString().padStart(2, "0")}月`
            )
          ) {
            existingIdxs.push(i);
          }
        });
        // 从后往前删除避免索引错乱
        for (let i = existingIdxs.length - 1; i >= 0; i--) {
          currentFiltered.splice(existingIdxs[i], 1);
        }
        currentFiltered.push(...mappedPhotos);

        updateData.filteredPhotos = currentFiltered;

        this.setData(updateData);

        // 检查是否所有月份都已加载完毕
        this._checkAllLoaded();

        // 链式视口填充：当月加载完成后，自动尝试加载下一个可见月份
        this._fillViewport();
      } catch (err) {
        console.error(`[photos] 加载月份 ${yearMonth} 失败:`, err);
        this.setData({
          [`groupedPhotos[${index}].loading`]: false,
        });
      } finally {
        self._loadingMonths?.delete(yearMonth);
      }
    },

    /**
     * "202606" → "2026年06月"
     */
    _formatYearMonth(yearMonth: string): string {
      if (!yearMonth || yearMonth.length !== 6) return yearMonth;
      const y = yearMonth.slice(0, 4);
      const m = Number(yearMonth.slice(4, 6));
      return `${y}年${String(m).padStart(2, "0")}月`;
    },

    /**
     * 加载筛选选项（类型、地点、平台）
     */
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
        console.error("[photos] 加载筛选选项失败:", err);
      }
    },

    onTogglfilterPicker() {
      const newVal = !this.data.showFilter;
      this.setData({ showFilter: newVal });
    },

    /** 切换复选框选择模式（仅显示checkbox，不自动勾选） */
    onToggleCheckboxMode() {
      const newVal = !this.data.showCheckboxMode;
      this.setData({
        showCheckboxMode: newVal,
        // 每次进入/退出都重置为空，不保留选择状态
        checkedPhotoIds: [],
      });
    },

    /** 点击月份复选框：全选/取消全选该月 */
    onMonthCheckTap(e: WechatMiniprogram.BaseEvent) {
      const monthIdx = e.currentTarget.dataset.monthIdx as number;
      const group = this.data.groupedPhotos[monthIdx];
      if (!group?.loaded || !group.days?.length) return;

      // 收集该月份所有照片ID
      const allPhotoIds: string[] = [];
      group.days.forEach((day) => {
        day.items?.forEach((photo) => {
          allPhotoIds.push(photo.id);
        });
      });

      // 判断是否已全选
      const isAllChecked = allPhotoIds.every((id) =>
        this.data.checkedPhotoIds.includes(id)
      );

      let newChecked: string[];
      if (isAllChecked) {
        // 取消全选：移除该月的所有照片
        newChecked = this.data.checkedPhotoIds.filter(
          (id) => !allPhotoIds.includes(id)
        );
      } else {
        // 全选：添加该月的所有照片
        const existingIds = new Set(this.data.checkedPhotoIds);
        allPhotoIds.forEach((id) => existingIds.add(id));
        newChecked = Array.from(existingIds);
      }

      this.setData({ checkedPhotoIds: newChecked });
    },

    /** 点击日期复选框：全选/取消全选该日 */
    onDayCheckTap(e: WechatMiniprogram.BaseEvent) {
      const monthIdx = e.currentTarget.dataset.monthIdx as number;
      const dayIdx = e.currentTarget.dataset.dayIdx as number;
      const group = this.data.groupedPhotos[monthIdx];
      if (!group?.days?.[dayIdx]) return;

      const dayItems = group.days[dayIdx].items || [];
      const dayPhotoIds = dayItems.map((p) => p.id);

      if (dayPhotoIds.length === 0) return;

      const isAllChecked = dayPhotoIds.every((id) =>
        this.data.checkedPhotoIds.includes(id)
      );

      let newChecked: string[];
      if (isAllChecked) {
        newChecked = this.data.checkedPhotoIds.filter(
          (id) => !dayPhotoIds.includes(id)
        );
      } else {
        const existingIds = new Set(this.data.checkedPhotoIds);
        dayPhotoIds.forEach((id) => existingIds.add(id));
        newChecked = Array.from(existingIds);
      }

      this.setData({ checkedPhotoIds: newChecked });
    },

    /** 下载选中的照片 */
    onDownloadSelected() {
      const { checkedPhotoIds, filteredPhotos } = this.data;
      if (checkedPhotoIds.length === 0) {
        wx.showToast({ title: "请先选择照片", icon: "none" });
        return;
      }

      wx.showLoading({ title: "准备下载..." });

      // 获取选中的照片URL
      const selectedPhotos = filteredPhotos.filter((p) =>
        checkedPhotoIds.includes(p.id)
      );

      // 逐个下载（实际项目中可改用批量下载）
      let completed = 0;
      selectedPhotos.forEach((photo) => {
        wx.downloadFile({
          url: photo.rawUrl || photo.url,
          success: (res) => {
            if (res.statusCode === 200) {
              wx.saveImageToPhotosAlbum({
                filePath: res.tempFilePath,
                success: () => {
                  completed++;
                  if (completed === selectedPhotos.length) {
                    wx.hideLoading();
                    wx.showToast({
                      title: `已下载 ${completed} 张`,
                      icon: "success",
                    });
                  }
                },
                fail: () => {
                  completed++;
                  console.warn("[photos] 保存到相册失败", photo.id);
                },
              });
            }
          },
          fail: (err) => {
            console.error("[photos] 下载失败", photo.id, err);
            wx.hideLoading();
            wx.showToast({ title: "下载失败", icon: "none" });
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

    /** 重置单个维度的筛选条件 */
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
    /** 确认筛选：关闭面板并重新加载数据 */
    async onConfirmFilter() {
      this.setData({ showFilter: false, isLoading: true });
      const artistId = this.data.currentArtistId;
      await this.loadPhotosFromServer(artistId);
      this.setData({ isLoading: false });
    },

    /**
     * 构建筛选参数
     */
    _buildFilterParams() {
      const { selectedType, selectedRegion, selectedSystem } = this.data;
      return {
        typeIds: selectedType.length > 0 ? selectedType : undefined,
        locationIds: selectedRegion.length > 0 ? selectedRegion : undefined,
        platformIds: selectedSystem.length > 0 ? selectedSystem : undefined,
      };
    },

    applyFilters() {
      const { selectedType, selectedRegion, selectedSystem } = this.data;
      const allPhotos = getPhotos();

      const filtered = allPhotos.filter((p: PhotoItem) => {
        // 空数组表示"不限"，不进行过滤
        if (selectedType.length > 0 && !selectedType.includes(p.type as any))
          return false;
        if (
          selectedRegion.length > 0 &&
          !selectedRegion.includes(p.region as any)
        )
          return false;
        if (
          selectedSystem.length > 0 &&
          !selectedSystem.includes(p.system as any)
        )
          return false;
        return true;
      });

      // 增强照片数据（添加加载状态字段）
      const { gridCellSize } = this.data;
      const { pixelRatio } = wx.getWindowInfo();
      const physicalSize = Math.round(gridCellSize * pixelRatio) || 200;

      const enhancedFiltered: EnhancedPhotoItem[] = filtered.map(
        (p: PhotoItem) => ({
          ...p,
          rawUrl: getImageUrl(p.url),
          thumbUrl: buildThumbUrl(getImageUrl(p.url), physicalSize),
          loaded: false,
        })
      );

      // 按月分组，再按日分组
      const monthMap: Record<string, Record<string, EnhancedPhotoItem[]>> = {};
      enhancedFiltered.forEach((p: EnhancedPhotoItem) => {
        if (!monthMap[p.month]) monthMap[p.month] = {};
        if (!monthMap[p.month][p.day]) monthMap[p.month][p.day] = [];
        monthMap[p.month][p.day].push(p);
      });

      const groupedPhotos: GroupedPhotos[] = Object.keys(monthMap)
        .sort((a, b) => b.localeCompare(a))
        .map((month) => {
          const days = Object.keys(monthMap[month])
            .sort((a, b) => b.localeCompare(a))
            .map((day) => ({ day, items: monthMap[month][day] }));
          const count = days.reduce((acc, d) => acc + d.items.length, 0);
          // 从月份字符串反推 yearMonth（如 "2026年06月" → "202606"）
          const ymMatch = month.match(/(\d{4})年(\d{2})月/);
          return {
            month,
            yearMonth: ymMatch ? `${ymMatch[1]}${ymMatch[2]}` : month,
            days,
            count,
            loaded: true,
            loading: false,
          };
        });

      this.setData({ filteredPhotos: enhancedFiltered, groupedPhotos });
    },

    onPhotoTap(e: WechatMiniprogram.BaseEvent) {
      const photoId = e.currentTarget.dataset.id as string;
      const filtered = this.data.filteredPhotos;
      const index = filtered.findIndex(
        (p: EnhancedPhotoItem) => p.id === photoId
      );

      if (index >= 0) {
        this.setData({ previewPhoto: filtered[index], previewIndex: index });
      }
    },

    onCheckTap(e: WechatMiniprogram.BaseEvent) {
      (e as any).stopPropagation?.();
      const photoId = e.currentTarget.dataset.id as string;
      const checked = this.data.checkedPhotoIds;
      const newChecked = checked.includes(photoId)
        ? checked.filter((id: string) => id !== photoId)
        : [...checked, photoId];
      this.setData({ checkedPhotoIds: newChecked });
    },

    onClosePreview() {
      this.setData({ previewPhoto: null });
    },

    onViewOriginal() {
      // 组件内部已处理图片切换为原图，无需额外操作
    },

    /** 预览中下载当前图片 */
    onPreviewDownload(e: WechatMiniprogram.CustomEvent) {
      const photo = e.detail?.photo || this.data.previewPhoto;
      if (!photo) return;
      const url = photo.rawUrl || photo.url;
      wx.downloadFile({
        url,
        success: (res) => {
          if (res.statusCode === 200) {
            wx.saveImageToPhotosAlbum({
              filePath: res.tempFilePath,
              success: () => {
                wx.showToast({ title: "已保存", icon: "success" });
              },
              fail: () => {
                wx.showToast({ title: "保存失败", icon: "none" });
              },
            });
          }
        },
        fail: () => {
          wx.showToast({ title: "下载失败", icon: "none" });
        },
      });
    },

    /** 预览中收藏当前图片（占位） */
    onPreviewFavorite() {
      wx.showToast({ title: "已收藏", icon: "success" });
    },

    /** 预览中 swiper 滑动切换 */
    onPreviewSwiperChange(e: WechatMiniprogram.CustomEvent) {
      const current = e.detail.current as number;
      const photo = this.data.filteredPhotos[current];
      if (photo) {
        this.setData({
          previewPhoto: photo,
          previewIndex: current,
        });
      }
    },

    // ========== 拆拽按钮相关方法 ==========

    // scroll-view滚动事件 + 按月懒加载触发（节流 150ms）
    onScroll(e: any) {
      const scrollTop = e.detail.scrollTop;

      // 只要有滚动即显示按钮
      if (scrollTop > 0) {
        this.showDragButton();
      } else {
        this.hideDragButton();
      }

      // 更新当前可见的日期
      this.updateCurrentVisibleDate(scrollTop);

      // 更新按钮位置（模拟滚动条，ratio-based，使用 transform GPU 加速）
      // 拖拽时 scrollTo 会高频触发 onScroll，此处统一处理，无需在 touchmove 中重复调用
      const self = this as unknown as PhotosInstance;
      this._updateScrollbarPosition(scrollTop);

      // 按月懒加载：节流 150ms
      if (self._scrollThrottleTimer) return;
      self._scrollThrottleTimer = setTimeout(() => {
        self._scrollThrottleTimer = null;
        this._lazyLoadVisibleMonths(scrollTop);
      }, 150);
    },

    /**
     * 计算滚动条位置（ratio-based）：btnY = ratio * 可拖拽范围
     * 使用 transform: translateY() 代替 top:，GPU 合成不触发 layout
     */
    _updateScrollbarPosition(scrollTop: number) {
      const { windowHeight } = wx.getWindowInfo();
      const self = this as unknown as PhotosInstance;
      const contentHeight = self._contentHeight || 10000;
      const maxScroll = Math.max(1, contentHeight - windowHeight);
      const btnHeight = 80; // 按钮高度 rpx → 约 40px
      const padding = 20; // 上下留白
      const trackHeight = windowHeight - btnHeight - padding * 2;
      const ratio = scrollTop / maxScroll;
      const translateY = Math.min(
        trackHeight,
        Math.max(0, ratio * trackHeight)
      );

      // 用 transform 替代 top：GPU 合成层，不触发 layout/reflow
      this.setData({
        _scrollbarTransform: `translateY(${translateY}px)`,
      });
    },

    /** 获取内容总高度 */
    _measureContentHeight() {
      const self = this as unknown as PhotosInstance;
      wx.createSelectorQuery()
        .in(this)
        .select(".photos-content")
        .boundingClientRect((rect: any) => {
          if (rect?.height) {
            self._contentHeight = rect.height + 200; // +200 为 count-bar 等额外高度
          }
        })
        .exec();
    },

    /**
     * 链式视口填充：当月加载完成后自动检查并加载后续月份
     * 无需等待用户滚动，逐月链式加载直到填满当前视口
     */
    async _fillViewport() {
      const { groupedPhotos, currentArtistId } = this.data;
      if (!groupedPhotos || groupedPhotos.length === 0) return;

      const { windowHeight } = wx.getWindowInfo();
      const itemH = this.data.gridCellSize;

      // 计算每个月份（含骨架态）的当前位置
      let accumulatedHeight = 0;
      let nextUnloadedIdx = -1;

      for (let i = 0; i < groupedPhotos.length; i++) {
        const group = groupedPhotos[i];
        let height = 72; // 月标题区高度

        if (group.loaded && group.days.length > 0) {
          // 已加载：使用精确高度
          group.days.forEach((d) => {
            height += 44 + Math.ceil(d.items.length / 4) * itemH + 20;
          });
        } else {
          // 骨架态：估算高度（与实际加载后一致）
          const estDays = Math.max(1, Math.ceil(group.count / 10));
          const gridRows = Math.ceil(group.count / 4);
          height += estDays * 44 + gridRows * itemH + estDays * 20;
        }

        const top = accumulatedHeight;
        accumulatedHeight += height;

        // 找到第一个视口内未加载的月份
        if (
          nextUnloadedIdx < 0 &&
          !group.loaded &&
          !group.loading &&
          top < windowHeight
        ) {
          nextUnloadedIdx = i;
        }
      }

      // 加载视口内下一个月，完成后继续链式填充
      if (nextUnloadedIdx >= 0) {
        const { pixelRatio } = wx.getWindowInfo();
        const physicalSize =
          Math.round(this.data.gridCellSize * pixelRatio) || 200;
        await this.loadMonth(
          groupedPhotos[nextUnloadedIdx].yearMonth,
          nextUnloadedIdx,
          currentArtistId,
          physicalSize
        );
        // 继续检查是否还有更多月份需要填充
        this._fillViewport();
      }
    },

    /**
     * 懒加载：精确触发策略
     * 核心原则：只有当【下个月份的顶部】真正进入视口时才触发请求
     * - 不基于固定像素范围（不同月份高度差异大）
     * - 每次最多只触发 1 个月份
     */
    _lazyLoadVisibleMonths(scrollTop: number) {
      const { groupedPhotos, currentArtistId } = this.data;
      if (!groupedPhotos || groupedPhotos.length === 0) return;

      const { windowHeight } = wx.getWindowInfo();
      const itemH = this.data.gridCellSize;

      // ====== 第一步：计算每个月份的精确位置区间 ======
      let accumulatedHeight = 0;
      const positions: { index: number; top: number; bottom: number }[] = [];

      for (let i = 0; i < groupedPhotos.length; i++) {
        const group = groupedPhotos[i];
        const top = accumulatedHeight;
        let height = 72;

        if (group.loaded && group.days.length > 0) {
          group.days.forEach((d) => {
            height += 44 + Math.ceil(d.items.length / 4) * itemH + 20;
          });
        } else {
          const estDays = Math.max(1, Math.ceil(group.count / 10));
          const gridRows = Math.ceil(group.count / 4);
          height += estDays * 44 + gridRows * itemH + estDays * 20;
        }

        positions.push({ index: i, top, bottom: accumulatedHeight + height });
        accumulatedHeight += height;
      }

      // ====== 第二步：遍历视口内月份，按优先级触发 ======
      // 场景A（高优）：视口内有未加载月份 → 直接加载第一个遇到的
      // 场景B（低优）：视口内月份都已加载 → 预加载下一月
      const visBottom = scrollTop + windowHeight;
      let triggered = false;
      let firstLoadedMonthIdx = -1; // 记录第一个已加载的月份索引

      for (let j = 0; j < positions.length && !triggered; j++) {
        const pos = positions[j];
        const group = groupedPhotos[pos.index];

        // 跳过完全在视口上方的月份
        if (pos.bottom <= scrollTop) continue;

        // 已经滚过视口下方了，停止查找
        if (pos.top >= visBottom) break;

        // === 场景A：视口内有未加载月份 → 立即加载 ===
        if (!group.loaded && !group.loading) {
          const { pixelRatio } = wx.getWindowInfo();
          const physicalSize =
            Math.round(this.data.gridCellSize * pixelRatio) || 200;
          this.loadMonth(
            group.yearMonth,
            pos.index,
            currentArtistId,
            physicalSize
          );
          triggered = true;
          break;
        }

        // 记录第一个已加载月份的位置（用于场景B）
        if (firstLoadedMonthIdx < 0 && group.loaded) {
          firstLoadedMonthIdx = pos.index;
        }
      }

      // === 场景B：所有视口内月份都已加载 → 预加载紧邻的下一月 ===
      // 条件：下一月的顶部在视口的下半部分（60%~100%）区域
      if (!triggered && firstLoadedMonthIdx >= 0) {
        const nextPos = positions[firstLoadedMonthIdx + 1];
        const nextGroup = nextPos ? groupedPhotos[nextPos.index] : null;
        const triggerThreshold = scrollTop + windowHeight * 0.6;

        if (
          nextGroup &&
          !nextGroup.loaded &&
          !nextGroup.loading &&
          nextPos.top >= triggerThreshold &&
          nextPos.top <= visBottom
        ) {
          const { pixelRatio } = wx.getWindowInfo();
          const physicalSize =
            Math.round(this.data.gridCellSize * pixelRatio) || 200;
          this.loadMonth(
            nextGroup.yearMonth,
            nextPos.index,
            currentArtistId,
            physicalSize
          );
        }
      }
    },

    // 显示拖拽按钮（不自动消失，只在 scrollTop=0 时隐藏）
    showDragButton() {
      if (!this.data.showDragBtn) {
        this.setData({ showDragBtn: true });
        // 首次显示时测量内容高度
        this._measureContentHeight();
      }
    },

    // 隐藏拖拽按钮（仅滚动到顶部时调用）
    hideDragButton() {
      this.setData({
        showDragBtn: false,
        isDragExpanded: false,
      });
    },

    // 根据滚动位置更新当前显示的日期（用于拖拽按钮展示）
    updateCurrentVisibleDate(scrollTop: number) {
      const { groupedPhotos } = this.data;
      if (!groupedPhotos || groupedPhotos.length === 0) return;

      // 获取系统信息用于计算尺寸
      const { windowWidth } = wx.getWindowInfo();
      const itemHeight = (windowWidth - 96) / 4; // 每张图片高度（4列布局，减去padding）
      const monthHeaderHeight = 56; // 月标题高度
      const dayTitleHeight = 36; // 日标题高度
      let accumulatedHeight = 0;
      let currentDate = "";
      let currentMonth = "";

      for (const group of groupedPhotos) {
        const groupStart = accumulatedHeight;
        // 月标题区域
        accumulatedHeight += monthHeaderHeight + 16;

        for (let dayIdx = 0; dayIdx < group.days.length; dayIdx++) {
          const dayGroup = group.days[dayIdx];
          const photoRowCount = Math.ceil(dayGroup.items.length / 4); // 4列布局
          const dayGroupHeight =
            dayTitleHeight + photoRowCount * itemHeight + 20;

          if (
            scrollTop >= accumulatedHeight &&
            scrollTop < accumulatedHeight + dayGroupHeight
          ) {
            // 找到当前所在的日，组合完整日期（month格式: "2026年05月", day格式: "5月29日" → 去掉day中的月份前缀）
            currentMonth = group.month; // "2026年05月"
            const dayOnly = dayGroup.day.replace(/^\d+月/, ""); // "5月29日" → "29日"
            currentDate = `${currentMonth}${dayOnly}`;
            break;
          }
          accumulatedHeight += dayGroupHeight;
        }

        if (currentDate) break;

        // 如果滚动位置在该月份范围内但还没匹配到具体日期，显示该月第一天
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

      // 兜底：如果没匹配到任何日期，显示最新的日期
      if (!currentDate && groupedPhotos.length > 0) {
        const firstGroup = groupedPhotos[0];
        currentDate = `${firstGroup.month}${
          firstGroup.days[0]?.day || this.data.currentDragDate
        }`;
      }

      if (currentDate && currentDate !== this.data.currentDragDate) {
        this.setData({ currentDragDate: currentDate });
      }
    },

    // 触摸开始 - 展开显示日期，记录起始状态
    onDragTouchStart(e: WechatMiniprogram.TouchEvent) {
      const self = this as unknown as PhotosInstance;
      self._isDragging = true;
      self._dragStartClientY = e.touches[0].clientY;

      // 获取当前 scroll-view 滚动位置（异步但通常很快）
      wx.createSelectorQuery()
        .in(this)
        .select("#photoScrollView")
        .scrollOffset((res: any) => {
          self._dragStartScrollTop = res.scrollTop || 0;
        })
        .exec();

      // 按住时展开显示当前年月日
      this.setData({ isDragExpanded: true });
    },

    // 触摸移动 - 同步滚动页面（使用 Node.scrollTo 原生级别）
    // 注意：不在此处手动更新日期/位置，scrollTo 会自动触发 onScroll 事件统一处理，
    // 避免同一帧内多次 setData 导致的掉帧
    onDragTouchMove(e: WechatMiniprogram.TouchEvent) {
      const self = this as unknown as PhotosInstance;
      if (!self._isDragging || self._dragStartScrollTop == null) return;

      const deltaY = e.touches[0].clientY - (self._dragStartClientY || 0);
      const { windowHeight } = wx.getWindowInfo();
      const contentHeight = self._contentHeight || 10000;

      // 将手指移动距离按比例转换为滚动距离
      const maxScroll = contentHeight - windowHeight;
      const btnHeight = 40; // px
      const padding = 20;
      const trackHeight = windowHeight - btnHeight - padding * 2;
      const scale = Math.max(1, maxScroll / trackHeight);
      const scrollDelta = deltaY * scale;
      const newScrollTop = Math.max(
        0,
        Math.min(maxScroll, self._dragStartScrollTop + scrollDelta)
      );

      // 直接用 ScrollView Node.scrollTo（原生渲染层操作，会触发 onScroll 统一更新 UI）
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

    // 触摸结束 - 收起日期，只显示图标
    onDragTouchEnd() {
      const self = this as unknown as PhotosInstance;
      self._isDragging = false;
      self._dragStartClientY = undefined;
      self._dragStartScrollTop = undefined;
      // 松开即收起年月日
      this.setData({ isDragExpanded: false });
    },

    /** 检查是否所有月份都已加载完毕 */
    _checkAllLoaded() {
      const { groupedPhotos } = this.data;
      if (!groupedPhotos || groupedPhotos.length === 0) return;

      const allLoaded = groupedPhotos.every((g) => g.loaded);
      if (allLoaded !== this.data.allLoaded) {
        this.setData({ allLoaded });
      }
    },

    // ========== 登录相关方法 ==========
    
    /** 底部引导点击 → 打开登录弹窗 */
    onGuestFooterLogin() {
      this.setData({ showLoginPopup: true });
    },

    /** 登录弹窗回调：登录成功 */
    async onLoginSuccess() {
      this.setData({
        isLoggedIn: true,
        showLoginPopup: false,
        _guestLimit: false,
      });
      // 登录后重新加载数据以获取完整列表
      const artistId = this.data.currentArtistId;
      this.setData({ isLoading: true });
      await this.loadPhotosFromServer(artistId);
      this.setData({ isLoading: false });
    },

    /** 登录弹窗回调：取消 */
    onLoginCancel() {
      this.setData({ showLoginPopup: false });
    },
}));
