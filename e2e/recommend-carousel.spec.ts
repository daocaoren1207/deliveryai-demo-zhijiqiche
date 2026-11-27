import { test, expect, type Page } from '@playwright/test'

/** 通过 preview 深链接直接进入已绑定 A08 桌台的点餐页，跳过首页与欢迎页。 */
async function openMenu(page: Page, options: { reducedMotion?: 'reduce' } = {}) {
  if (options.reducedMotion) await page.emulateMedia({ reducedMotion: options.reducedMotion })
  await page.goto('/?preview=menu')
}

/** 推荐菜轮播区域，以可访问名称定位，避免依赖 DOM 层级。 */
const carouselOf = (page: Page) => page.getByRole('region', { name: '今日推荐菜' })

test.describe('点单页推荐菜轮播', () => {
  test('REC-001: 点餐页展示推荐菜轮播，默认停留在第 1 张并展示全部指示点', async ({ page }) => {
    // 关闭自动轮播，避免断言期间页码变化
    await openMenu(page, { reducedMotion: 'reduce' })
    const carousel = carouselOf(page)
    await expect(carousel).toBeVisible()
    await expect(carousel.getByText('1 / 5')).toBeVisible()
    await expect(carousel.getByRole('group')).toHaveCount(5)
  })

  test('REC-002: 上一张/下一张按钮可切换推荐菜并同步页码', async ({ page }) => {
    await openMenu(page, { reducedMotion: 'reduce' })
    const carousel = carouselOf(page)
    await carousel.getByRole('button', { name: '下一张推荐' }).click()
    await expect(carousel.getByText('2 / 5')).toBeVisible()
    await carousel.getByRole('button', { name: '上一张推荐' }).click()
    await expect(carousel.getByText('1 / 5')).toBeVisible()
  })

  test('REC-003: 点击推荐卡片打开菜品规格弹窗，可复用既有加购流程', async ({ page }) => {
    await openMenu(page, { reducedMotion: 'reduce' })
    const carousel = carouselOf(page)
    await carousel.getByRole('button', { name: /鎏金番茄鸳鸯锅/ }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: '鎏金番茄鸳鸯锅' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: '加入本桌购物车' })).toBeVisible()
  })

  test('REC-004: 自动轮播可暂停与恢复', async ({ page }) => {
    await openMenu(page)
    const carousel = carouselOf(page)
    await carousel.getByRole('button', { name: '暂停自动轮播' }).click()
    await expect(carousel.getByRole('button', { name: '继续自动轮播' })).toBeVisible()
    await carousel.getByRole('button', { name: '继续自动轮播' }).click()
    await expect(carousel.getByRole('button', { name: '暂停自动轮播' })).toBeVisible()
  })

  test('NFR-001: 系统开启「减少动态效果」时不自动轮播，且不展示暂停按钮', async ({ page }) => {
    await openMenu(page, { reducedMotion: 'reduce' })
    const carousel = carouselOf(page)
    await expect(carousel.getByRole('button', { name: '暂停自动轮播' })).toHaveCount(0)
    await expect(carousel.getByRole('button', { name: '下一张推荐' })).toBeVisible()
  })
})
