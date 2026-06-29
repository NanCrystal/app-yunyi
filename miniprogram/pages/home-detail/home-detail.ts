// pages/home-detail/home-detail.ts
import { fetchArticleDetail } from "../../services/api";
import { getThumbFullUrl, formatDateChinese } from "../../utils/util";

Page({
  data: {
    article: null as any,
  },

  onLoad(options: any) {
    const id = options?.id;
    if (id) {
      this.loadArticleDetail(Number(id));
    }
  },

  loadArticleDetail(id: number) {
    fetchArticleDetail(id)
      .then((detail: any) => {
        // 换行/空格分割正文为段落
        const paragraphs = (detail.content || "")
          .split(/\n+/)
          .map((s: string) => s.trim())
          .filter(Boolean);

        this.setData({
          article: {
            ...detail,
            cover: getThumbFullUrl(detail.cover),
            createdAt: formatDateChinese(detail.createdAt),
            paragraphs,
          },
        });
      })
      .catch(() => {
        console.error("获取文章详情失败");
      });
  },
});
