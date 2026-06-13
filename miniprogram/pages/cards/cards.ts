// pages/cards/cards.ts
import { themeBehavior } from "../../behaviors/theme";
import { fetchPhotoCardCategories, fetchPhotoCards } from "../../services/api";
import { getThumbFullUrl, getImageUrl, formatDateDot } from "../../utils/util";

const app = getApp<IAppOption>();

interface CategoryItem {
  id: number;
  name: string;
  parentId: number | null;
  children?: CategoryItem[];
}

Component({
  behaviors: [themeBehavior],

  properties: {},

  data: {
    categories: [] as CategoryItem[],
    loading: false,
    /** 第一行：[全部] + 二级节点 */
    firstRowTags: [] as CategoryItem[],
    /** 选中的 tag id（第一行） */
    selectedId: null as number | null,
    /** 是否选中了"全部" */
    isAllSelected: true,
    /** 第二行：选中节点的三级子级 */
    secondRowChildren: [] as CategoryItem[],
    /** 第二行选中的 id */
    selectedSecondId: null as number | null,
    /** 当前艺人 ID */
    artistId: '' as string,
    /** 小卡列表 */
    cards: [] as any[],
    /** 当前页码 */
    page: 1,
    /** 每页条数 */
    pageSize: 18,
    /** 是否还有更多 */
    hasMore: true,
    /** 加载更多中 */
    loadingMore: false,
    /** 状态栏高度 */
    statusBarHeight: 20,
    /** 导航栏总高度（状态栏 + 标题栏） */
    navBarHeight: 64,
    /** 固定标签栏高度（动态更新：单行/双行） */
    tagBarHeight: 52,
  },

  lifetimes: {
    attached() {
      const artistId = (app.globalData.selectedCharId || 'haoyiran') as string;
      const { statusBarHeight } = (wx as any).getWindowInfo?.() ?? { statusBarHeight: 20 };
      const navBarHeight = statusBarHeight + 44;
      this.setData({ artistId, statusBarHeight, navBarHeight });
      this.loadCategories();
    },
  },

  methods: {
    async loadCategories() {
      this.setData({ loading: true });
      try {
        const res = await fetchPhotoCardCategories();
        const list = res || [];

        function buildChildren(parentId: number, allList: CategoryItem[]): CategoryItem[] {
          return allList
            .filter((item) => item.parentId === parentId)
            .map((child) => ({
              ...child,
              children: buildChildren(child.id, allList),
            }));
        }

        const tree = list
          .filter((item) => item.parentId === null)
          .map((root) => ({
            ...root,
            children: buildChildren(root.id, list),
          }));

        // 第一行展平：所有根节点的二级子级
        const firstRow: CategoryItem[] = [];
        for (const root of tree) {
          firstRow.push(...(root.children || []));
        }

        this.setData({
          categories: tree,
          firstRowTags: firstRow,
        });

        // 分类加载完成后加载小卡
        this.loadCards();
      } catch (err) {
        console.error("加载小卡分类失败", err);
      } finally {
        this.setData({ loading: false });
      }
    },

    /** 收集树结构中所有叶子节点（无 children 或 children 为空）的 id */
    collectLeafIds(list: CategoryItem[]): number[] {
      const ids: number[] = [];
      for (const item of list) {
        if (!item.children || item.children.length === 0) {
          ids.push(item.id);
        } else {
          ids.push(...this.collectLeafIds(item.children));
        }
      }
      return ids;
    },

    /** 根据当前选中状态构建 categoryIds 并加载小卡（重置分页） */
    async loadCards(reset = true) {
      if (reset) {
        this.setData({ page: 1, hasMore: true });
      }
      const { isAllSelected, selectedId, selectedSecondId, artistId, categories, page, pageSize } = this.data;
      let categoryIds: number[] | undefined;

      if (isAllSelected) {
        categoryIds = this.collectLeafIds(categories);
      } else if (selectedSecondId) {
        categoryIds = [selectedSecondId];
      } else if (selectedId) {
        const node = this.findNodeById(selectedId, categories);
        if (node && node.children?.length) {
          categoryIds = this.collectLeafIds(node.children);
        } else {
          categoryIds = [selectedId];
        }
      }

      try {
        const res: any = await fetchPhotoCards({
          categoryIds,
          artistId,
          page,
          pageSize,
        });
        const list = Array.isArray(res) ? res : (res?.list || []);
        const total = res?.total ?? list.length;
        const newCards = (list || []).map((item: any) => ({
          ...item,
          _frontImage: getThumbFullUrl(item.frontImage),
          _releaseDate: formatDateDot(item.releaseDate),
          // 预览用原图（不带缩略参数）
          _previewUrl: getImageUrl(item.frontImage),
        }));
        const cards = reset ? newCards : [...this.data.cards, ...newCards];
        this.setData({
          cards,
          hasMore: cards.length < total,
        });
      } catch (err) {
        console.error("加载小卡列表失败", err);
        if (reset) this.setData({ cards: [] });
      }
    },

    /** 滚动到底部触发加载更多 */
    async onScrollToLower() {
      if (!this.data.hasMore || this.data.loadingMore) return;
      this.setData({ loadingMore: true, page: this.data.page + 1 });
      await this.loadCards(false);
      this.setData({ loadingMore: false });
    },

    /** 点击第一行 tag */
    onFirstRowTap(e: WechatMiniprogram.TouchEvent) {
      const { id, hasChildren } = e.currentTarget.dataset;
      if (id === "all") {
        // 点击"全部"
        this.setData({
          isAllSelected: true,
          selectedId: null,
          secondRowChildren: [],
          selectedSecondId: null,
          tagBarHeight: 52,
        });
      } else if (hasChildren) {
        // 有子节点的二级 → 显示第二行（三级）
        const node = this.findNodeById(id, this.data.categories);
        this.setData({
          isAllSelected: false,
          selectedId: id,
          secondRowChildren: node?.children || [],
          selectedSecondId: null,
          tagBarHeight: 96,
        });
      } else {
        // 无子节点的叶子 → 直接选中
        this.setData({
          isAllSelected: false,
          selectedId: id,
          secondRowChildren: [],
          selectedSecondId: null,
          tagBarHeight: 52,
        });
      }
      this.loadCards();
    },

    /** 点击第二行 tag（三级） */
    onSecondRowTap(e: WechatMiniprogram.TouchEvent) {
      const { id } = e.currentTarget.dataset;
      this.setData({ selectedSecondId: id });
      this.loadCards();
    },

    findNodeById(id: number, list: CategoryItem[]): CategoryItem | undefined {
      for (const item of list) {
        if (item.id === id) return item;
        if (item.children?.length) {
          const found = this.findNodeById(id, item.children);
          if (found) return found;
        }
      }
      return undefined;
    },

    /** 点击小卡预览 */
    onCardTap(e: WechatMiniprogram.TouchEvent) {
      const { index } = e.currentTarget.dataset;
      const card = this.data.cards[index];
      if (!card?._previewUrl) return;
      wx.previewImage({
        current: card._previewUrl,
        urls: [card._previewUrl],
        ...(card.orientation === 'landscape' ? { isLandscape: true as any } : {}),
      });
    },

    /** 返回上一页 */
    onGoBack() {
      wx.navigateBack({
        fail: () => wx.reLaunch({ url: '/pages/home/home' }),
      });
    },
  },
});
