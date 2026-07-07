// pages/cards/cards.ts
import { withTheme } from "../../behaviors/theme";
import { fetchPhotoCardCategories, fetchPhotoCards } from "../../services/api";
import { isModuleEnabled } from "../../utils/util";
import { getThumbFullUrl, getImageUrl, formatDateDot } from "../../utils/util";
import { safeNavigateBack } from "../../utils/nav";

const app = getApp<IAppOption>();

interface CategoryItem {
  id: number;
  name: string;
  parentId: number | null;
  children?: CategoryItem[];
}

/** 页面实例类型，用于方法内 this 注解 */
type CardsPageInstance = WechatMiniprogram.Page.Instance<
  Record<string, unknown> & {
    categories: CategoryItem[];
    loading: boolean;
    firstRowTags: CategoryItem[];
    selectedId: number | null;
    isAllSelected: boolean;
    secondRowChildren: CategoryItem[];
    selectedSecondId: number | null;
    artistId: string;
    cards: any[];
    page: number;
    pageSize: number;
    hasMore: boolean;
    loadingMore: boolean;
    statusBarHeight: number;
    navBarHeight: number;
    tagBarHeight: number;
  },
  Record<string, any>
>;

Page(
  withTheme({
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
      artistId: "" as string,
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
      /** 模块是否启用（控制整个页面是否展示） */
      moduleEnabled: true,
    },

    /** 页面加载：获取导航栏高度并加载数据 */
    onLoad(this: CardsPageInstance) {
      const artistId = (app.globalData.selectedCharId || "haoyiran") as string;
      const { statusBarHeight } = (wx as any).getWindowInfo?.() ?? {
        statusBarHeight: 20,
      };
      const navBarHeight = statusBarHeight + 44;
      this.setData({ artistId, statusBarHeight, navBarHeight });

      // 检查 photoCards 模块是否启用（cached_modules 存在且包含 "photoCards"）
      if (!isModuleEnabled("photoCards")) {
        console.warn("[cards] photoCards 模块未启用，隐藏页面");
        this.setData({ moduleEnabled: false });
        return;
      }

      this.loadCategories();
    },

    async loadCategories(this: CardsPageInstance) {
      this.setData({ loading: true });
      try {
        const res = await fetchPhotoCardCategories();
        const tree = res || [];

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

    /** 根据当前选中状态构建 categoryId 并加载小卡（重置分页） */
    async loadCards(this: CardsPageInstance, reset = true) {
      if (reset) {
        this.setData({ page: 1, hasMore: true });
      }
      const {
        isAllSelected,
        selectedId,
        selectedSecondId,
        artistId,
        page,
        pageSize,
      } = this.data;
      // 树级结构：只传当前选中的单个 categoryId，后端自动展开所有子孙分类
      let categoryId: number | undefined;

      if (isAllSelected) {
        // "全部"不传 categoryId，后端返回全量数据
        categoryId = undefined;
      } else if (selectedSecondId) {
        categoryId = selectedSecondId;
      } else if (selectedId) {
        categoryId = selectedId;
      }

      try {
        const res: any = await fetchPhotoCards({
          categoryId,
          artistId,
          page,
          pageSize,
        });
        const list = Array.isArray(res) ? res : res?.list || [];
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
    async onScrollToLower(this: CardsPageInstance) {
      if (!this.data.hasMore || this.data.loadingMore) return;
      this.setData({ loadingMore: true, page: this.data.page + 1 });
      await this.loadCards(false);
      this.setData({ loadingMore: false });
    },

    /** 点击第一行 tag */
    onFirstRowTap(this: CardsPageInstance, e: WechatMiniprogram.TouchEvent) {
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
    onSecondRowTap(this: CardsPageInstance, e: WechatMiniprogram.TouchEvent) {
      const { id } = e.currentTarget.dataset;
      this.setData({ selectedSecondId: id });
      this.loadCards();
    },

    findNodeById(
      this: CardsPageInstance,
      id: number,
      list: CategoryItem[]
    ): CategoryItem | undefined {
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
    onCardTap(this: CardsPageInstance, e: WechatMiniprogram.TouchEvent) {
      const { index } = e.currentTarget.dataset;
      const card = this.data.cards[index];
      if (!card) return;

      // 根据 categoryId 从分类树中映射分类名称，避免详情页再调接口
      const categoryNode = card.categoryId
        ? this.findNodeById(card.categoryId, this.data.categories)
        : undefined;

      // 从 cached_artists 中匹配 artistId 得到艺人名称
      const artists: any[] = wx.getStorageSync("cached_artists") || [];
      const artistNode = artists.find((a) => a.artistId === this.data.artistId);
 

      // 存储到本地（用唯一 key），附带分类名称和艺人名称
      wx.setStorageSync(`card_${card.id}`, {
        ...card,
        category: categoryNode?.name ?? "",
        coverImage: categoryNode?.coverImage ?? "",
        artist: artistNode?.name ?? "",
      });

      wx.navigateTo({
        url: `/pages/card-detail/card-detail?id=${card.id}`,
      });
    },

    /** 返回上一页（DevTools 兼容） */
    onGoBack(this: CardsPageInstance) {
      safeNavigateBack();
    },
  })
);
