import { getItineraries } from "../../services/api";
import type { EventItem, EventStatus } from "../../utils/types";
import { themeBehavior } from "../../behaviors/theme";
import { getThumbFullUrl } from "../../utils/util";
interface FilterItem {
  label: string;
  value: string;
}

interface ScheduleData {
  activeFilter: string;
  filterItems: FilterItem[];
  filteredEvents: EventItem[];
  groupedByDate: { date: string; items: EventItem[] }[];
  currentYear: number;
  currentMonth: number;
  months: number[];
  showMonthPicker: boolean;
  showYearPicker: boolean;
  yearRange: number[];
  yearIndex: number;
  tempYear: number;
  loading: boolean;
  skeletonVisible: boolean;
}

Component({
  behaviors: [themeBehavior],

  data: {
    statusBarHeight: 20,
    canGoBack: false,
    activeFilter: "ALL",
    filterItems: [
      { label: "全部", value: "ALL" },
      { label: "进行中", value: "ongoing" },
      { label: "已完成", value: "completed" },
      { label: "未开始", value: "pending" },
    ] as FilterItem[],
    filteredEvents: [] as EventItem[],
    groupedByDate: [] as { date: string; items: EventItem[] }[],

    currentYear: new Date().getFullYear(),
    currentMonth: new Date().getMonth() + 1,
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    showMonthPicker: false,
    showYearPicker: false,
    yearRange: [] as number[],
    yearIndex: 0,
    tempYear: new Date().getFullYear(),
    loading: false,
    skeletonVisible: true,
  } as ScheduleData,

  lifetimes: {
    attached() {
      const { statusBarHeight } = (wx as any).getWindowInfo
        ? (wx as any).getWindowInfo()
        : wx.getSystemInfoSync();
      const pages = getCurrentPages();
      // 判断是否有上一页，决定是否显示返回按钮
      const canGoBack = pages.length > 1;
      this.setData({ 
        statusBarHeight,
        canGoBack 
      });
      this.initYearRange();
      this.fetchItineraries();
    },
  },

  methods: {
    /** 返回上一页或首页 */
    onGoBack() {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        // 有上一页，尝试返回
        wx.navigateBack({ 
          delta: 1,
          fail() {
            // 返回失败，跳转到首页
            wx.reLaunch({ url: '/pages/home/home' });
          }
        });
      } else {
        // 没有上一页，直接跳转首页
        wx.reLaunch({ url: '/pages/home/home' });
      }
    },

    onFilterChange(e: WechatMiniprogram.CustomEvent) {
      const value = e.detail.value as string;
      this.setData({ activeFilter: value });
      this.fetchItineraries();
    },

    /** 获取日程列表 */
    async fetchItineraries() {
      const app = getApp<IAppOption>();
      const artistId = app.globalData.selectedCharId;
      const { activeFilter, currentYear, currentMonth, showMonthPicker } =
        this.data;

      this.setData({ loading: true, skeletonVisible: true });

      // 构建参数
      const params: any = {
        artistId,
        period: showMonthPicker ? "month" : "year",
        date: showMonthPicker
          ? `${currentYear}-${String(currentMonth).padStart(2, "0")}`
          : String(currentYear),
        status: activeFilter,
      };

      try {
        const res = await getItineraries(params);
        const events = this.transformItineraries(res.list || []);
        this.groupAndSetEvents(events);
      } catch (err) {
        console.error("获取日程失败", err);
        this.setData({ filteredEvents: [], groupedByDate: [] });
      } finally {
        // 延迟关闭骨架屏，避免闪烁
        setTimeout(() => {
          this.setData({ loading: false, skeletonVisible: false });
        }, 300);
      }
    },

    /** 将后端数据转换为前端格式 */
    transformItineraries(list: any[]): EventItem[] {
      return list.map((item) => {
        const startDate = item.startTime ? new Date(item.startTime) : null;
        const dateStr = startDate
          ? `${startDate.getFullYear()}.${String(
              startDate.getMonth() + 1
            ).padStart(2, "0")}.${String(startDate.getDate()).padStart(2, "0")}`
          : "";
        const timeStr = startDate
          ? `${String(startDate.getHours()).padStart(2, "0")}:${String(
              startDate.getMinutes()
            ).padStart(2, "0")}`
          : "";
        const status = (item.status || "pending") as EventStatus;
        return {
          id: String(item.id),
          status: status,
          title: item.title || "",
          location: item.location || "",
          date: dateStr,
          time: timeStr,
          imageUrl: getThumbFullUrl(item.poster) || "",
          statusLabel: this.getStatusLabel(status),
        } as EventItem;
      });
    },

    /** 按日期分组并设置数据 */
    groupAndSetEvents(events: EventItem[]) {
      const dateMap: Record<string, EventItem[]> = {};
      console.log("events", events);

      events.forEach((evt) => {
        if (!dateMap[evt.date]) dateMap[evt.date] = [];
        dateMap[evt.date].push(evt);
      });

      const groupedByDate = Object.keys(dateMap)
        .sort((a, b) => b.localeCompare(a))
        .map((date) => ({ date, items: dateMap[date] }));
console.log("groupedByDate", groupedByDate);
console.log("events", events);

      this.setData({ filteredEvents: events, groupedByDate });
    },

    getStatusClass(status: EventStatus): string {
      const map: Record<EventStatus, string> = {
        ongoing: "status--ongoing",
        completed: "status--completed",
        cancelled: "status--cancelled",
        pending: "status--pending",
      };
      return map[status] || "";
    },

    getStatusLabel(status: EventStatus): string {
      const map: Record<EventStatus, string> = {
        ongoing: "进行中",
        completed: "已完成",
        cancelled: "已取消",
        pending: "未开始",
      };
      return map[status] || status;
    },

    /** 初始化年份范围（当前年份前后5年） */
    initYearRange() {
      const currentYear = new Date().getFullYear();
      const yearRange: number[] = [];
      for (let y = currentYear - 5; y <= currentYear + 5; y++) {
        yearRange.push(y);
      }
      const yearIndex = yearRange.indexOf(currentYear);
      this.setData({ yearRange, yearIndex: yearIndex >= 0 ? yearIndex : 5 });
    },

    /** 打开/关闭年份弹窗 */
    onToggleYearPicker() {
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

    onCloseYearPicker() {
      this.setData({ showYearPicker: false });
    },

    /** 滚动年份 */
    onYearScroll(e: WechatMiniprogram.CustomEvent) {
      const val = e.detail.value as number[];
      const { yearRange } = this.data;
      this.setData({ yearIndex: val[0], tempYear: yearRange[val[0]] });
    },

    /** 确认年份 */
    onConfirmYear() {
      const { tempYear, currentYear } = this.data;
      this.setData({ currentYear: tempYear, showYearPicker: false });
      if (tempYear !== currentYear) {
        this.fetchItineraries();
      }
    },

    /** 切换月份选择器显隐 */
    onToggleMonthPicker() {
      const newVal = !this.data.showMonthPicker;
      this.setData({ showMonthPicker: newVal }, () => {
        this.fetchItineraries();
      });
    },

    /** 选择月份 */
    onSelectMonth(e: WechatMiniprogram.CustomEvent) {
      const month = e.currentTarget.dataset.month as number;
      const { currentMonth } = this.data;
      this.setData({ currentMonth: month });
      if (month !== currentMonth) {
        this.fetchItineraries();
      }
    },
  },
});
