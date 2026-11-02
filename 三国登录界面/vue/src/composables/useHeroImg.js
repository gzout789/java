/**
 * 武将立绘统一入口
 * - 列表/牌桌用小图：public/heroes/opt/<武将名>.webp（约 55KB，原图 2MB+ 直接用会白屏很久）
 * - 大图：public/heroes/<武将名>.webp（2026-11-02 起由原 PNG 压缩为 webp，约 150-330KB）
 * - 缺图时不再隐藏整块区域，改成显示水墨占位（姓名字帖），布局不塌不跳
 */

const OPT_DIR = '/heroes/opt/'
const SRC_DIR = '/heroes/'

function slug(name) {
  return encodeURIComponent(name || '')
}

/** 卡片/牌桌用的小图（webp 缩略图） */
export function heroImg(name) {
  return OPT_DIR + slug(name) + '.webp'
}

/** 原尺寸立绘（详情、导出等场景），已统一为 webp */
export function heroFullImg(name) {
  return SRC_DIR + slug(name) + '.webp'
}

/** 图片加载失败：只让图片自身淡出，露出底下的占位字，不影响布局 */
export function onHeroImgError(e) {
  const el = e && e.target
  if (!el) return
  el.style.visibility = 'hidden'
}
