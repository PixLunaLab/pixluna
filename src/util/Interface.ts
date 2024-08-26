export interface Pixivic {
  id: number; // 作品id
  title: string; // 作品标题

  imageUrls: {
    large: string; // 大图
    medium: string; // 中图
    original: string; // 原图
    squareMedium: string; // 小图
  }[],

  tags: {
    name: string; // 标签名
    translatedName: string; // 标签翻译
  }[],

  createDate: string; // 作品创建时间
}

export interface Vilipix {
  original_url: string,
  title: string,
  tags: string,
  picture_id: string,
}

export interface Lolicon {
  pid: number,
  p: number,
  uid: number,
  title: string,
  author: string,
  "r18": false,
  tags: string[],
  ext: number,
  aiType: number,
  uploadDate: number,
  urls: {
    original: string
  }
}

export interface ImageConfusion extends Lolicon {
  imgBase64: string;
}
