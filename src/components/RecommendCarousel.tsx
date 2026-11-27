import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Flame, Pause, Play, Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { money } from '@/lib/utils'
import type { Product } from '@/types'

interface RecommendCarouselProps {
  products: Product[]
  soldOut: string[]
  /** 老人模式下放慢自动轮播，给阅读留出更多时间 */
  elderly?: boolean
  onSelect: (product: Product) => void
}

const AUTO_PLAY_INTERVAL = 4500
const AUTO_PLAY_INTERVAL_ELDERLY = 6500

/**
 * 点单页推荐菜轮播。
 * - 基于原生横向滚动 + scroll-snap，天然支持触摸滑动，不引入额外依赖。
 * - 自动轮播在悬停、聚焦、显式暂停、老人模式与「减少动态效果」偏好下停用/降速。
 * - 复用菜品规格弹窗（onSelect），加购流程与列表卡片保持一致。
 */
export function RecommendCarousel({ products, soldOut, elderly = false, onSelect }: RecommendCarouselProps) {
  const { t } = useTranslation()
  const trackRef = useRef<HTMLDivElement>(null)
  const slideRefs = useRef<Array<HTMLDivElement | null>>([])
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || !document.hidden)
  const reducedMotion = usePrefersReducedMotion()
  const total = products.length
  const interval = elderly ? AUTO_PLAY_INTERVAL_ELDERLY : AUTO_PLAY_INTERVAL

  useEffect(() => {
    const handleVisibility = () => setPageVisible(!document.hidden)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  const goTo = useCallback((index: number) => {
    if (total === 0) return
    const next = ((index % total) + total) % total
    setActive(next)
    const track = trackRef.current
    const slide = slideRefs.current[next]
    if (!track || !slide) return
    track.scrollTo({ left: slide.offsetLeft - track.offsetLeft, behavior: reducedMotion ? 'auto' : 'smooth' })
  }, [reducedMotion, total])

  const autoPlay = pageVisible && !paused && !hovered && !focused && !reducedMotion && total > 1

  useEffect(() => {
    if (!autoPlay) return
    const timer = window.setTimeout(() => goTo(active + 1), interval)
    return () => window.clearTimeout(timer)
  }, [active, autoPlay, goTo, interval])

  // 手动滑动后同步当前页，使指示点与上一张/下一张按钮跟随
  const handleScroll = useCallback(() => {
    const track = trackRef.current
    if (!track) return
    let nearest = 0
    let minDistance = Number.POSITIVE_INFINITY
    slideRefs.current.forEach((slide, index) => {
      if (!slide) return
      const distance = Math.abs(slide.offsetLeft - track.offsetLeft - track.scrollLeft)
      if (distance < minDistance) {
        minDistance = distance
        nearest = index
      }
    })
    setActive(nearest)
  }, [])

  if (total === 0) return null

  const showPause = !reducedMotion && total > 1

  return (
    <section role="region" aria-roledescription="carousel" aria-label={t('menu.recommend.title')} className="mt-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="flex items-center gap-2 text-xs font-bold text-chili-500"><Sparkles size={14} />{t('menu.recommend.badge')}</span>
          <h2 className="mt-1 text-xl font-extrabold text-charcoal-900">{t('menu.recommend.title')}</h2>
          <p className="mt-1 text-xs text-charcoal-500">{t('menu.recommend.hint')}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="mr-1 text-xs font-bold tabular-nums text-charcoal-500">{active + 1} / {total}</span>
          {showPause && (
            <Button variant="outline" size="icon" onClick={() => setPaused((value) => !value)} aria-label={paused ? t('menu.recommend.play') : t('menu.recommend.pause')} className="h-9 w-9">
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={() => goTo(active - 1)} aria-label={t('menu.recommend.prev')} className="h-9 w-9"><ChevronLeft size={17} /></Button>
          <Button variant="outline" size="icon" onClick={() => goTo(active + 1)} aria-label={t('menu.recommend.next')} className="h-9 w-9"><ChevronRight size={17} /></Button>
        </div>
      </div>

      <div
        ref={trackRef}
        onScroll={handleScroll}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false)
        }}
        className="scrollbar-none relative mt-3 flex snap-x snap-mandatory overflow-x-auto"
      >
        {products.map((product, index) => {
          const unavailable = soldOut.includes(product.id)
          return (
            <div
              key={product.id}
              ref={(node) => { slideRefs.current[index] = node }}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} / ${total}`}
              className="w-full shrink-0 snap-start"
            >
              <button
                type="button"
                onClick={() => onSelect(product)}
                disabled={unavailable}
                className="group block w-full overflow-hidden rounded-3xl border border-charcoal-900/5 bg-white text-left shadow-card transition hover:-translate-y-1 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                <div className="flex flex-col sm:flex-row">
                  <div className="relative h-40 shrink-0 overflow-hidden sm:h-52 sm:w-[46%]">
                    <img src={product.image} alt={t(product.name)} className={`h-full w-full object-cover transition duration-500 group-hover:scale-105 ${unavailable ? 'grayscale' : ''}`} />
                    <div className="absolute inset-0 bg-gradient-to-t from-charcoal-900/60 to-transparent sm:bg-gradient-to-r" />
                    {product.badge && <span className="absolute left-3 top-3 rounded-full bg-amber-400 px-3 py-1 text-xs font-extrabold text-charcoal-900">{t(product.badge)}</span>}
                    {unavailable && <span className="absolute inset-0 flex items-center justify-center bg-white/55 text-lg font-extrabold text-charcoal-900 backdrop-blur-sm">{t('menu.sold_out')}</span>}
                  </div>
                  <div className="flex flex-1 flex-col justify-between gap-4 p-4 sm:p-5">
                    <div>
                      <span className="flex items-center gap-1.5 text-xs font-bold text-chili-500"><Flame size={13} />{t('menu.recommend.badge')}</span>
                      <p className="mt-1.5 text-xl font-extrabold text-charcoal-900">{t(product.name)}</p>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-charcoal-500">{t(product.description)}</p>
                      {product.orderedCount ? <span className="mt-2 inline-flex rounded-full bg-chili-50 px-2.5 py-1 text-xs font-bold text-chili-600">{t('menu.ordered_table', { count: product.orderedCount })}</span> : null}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-2xl font-extrabold text-chili-500">{money(product.price)} <small className="text-xs font-medium text-charcoal-500">{t('menu.from')}</small></p>
                      <span className="inline-flex h-10 items-center gap-1.5 rounded-full bg-chili-500 px-4 text-sm font-bold text-white shadow-md transition group-hover:bg-chili-600"><Plus size={16} />{t('menu.recommend.select')}</span>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-center gap-2">
        {products.map((product, index) => (
          <button
            key={product.id}
            type="button"
            onClick={() => goTo(index)}
            aria-label={t('menu.recommend.go_to', { index: index + 1 })}
            aria-current={active === index ? 'true' : undefined}
            className={`h-2 rounded-full transition-all ${active === index ? 'w-6 bg-chili-500' : 'w-2 bg-charcoal-900/15 hover:bg-chili-500/40'}`}
          />
        ))}
      </div>
    </section>
  )
}
