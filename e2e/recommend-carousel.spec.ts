import { test, expect, type Locator, type Page } from '@playwright/test'

/** 通过 preview 深链接直接进入已绑定 A08 桌台的点餐页，跳过首页与欢迎页。 */
async function openMenu(page: Page, options: { reducedMotion?: 'reduce' } = {}) {
  if (options.reducedMotion) await page.emulateMedia({ reducedMotion: options.reducedMotion })
  await page.goto('/?preview=menu')
}

/** 推荐菜轮播区域，以可访问名称定位，避免依赖 DOM 层级。 */
const carouselOf = (page: Page, name = '今日推荐菜') => page.getByRole('region', { name })

/** 轮播页码，如「1 / 5」。 */
const counterOf = (carousel: Locator) => carousel.getByText(/^\d+ \/ \d+$/)

/** 读取当前页码并推导下一张页码（最后一张之后回到第一张，与 goTo 取模一致）。 */
async function currentAndNextPage(carousel: Locator) {
  const current = (await counterOf(carousel).textContent())!.trim()
  const [index, total] = current.split('/').map((part) => Number(part.trim()))
  const next = `${index === total ? 1 : index + 1} / ${total}`
  return { current, next }
}

/**
 * 暂停自动轮播，并等待可能仍在进行的平滑滚动收敛（约 300–500ms）。
 * 否则 scroll 事件会在读取页码后回写 active，导致后续断言拿到过期页码。
 */
async function pauseAutoplay(page: Page, carousel: Locator) {
  await carousel.getByRole('button', { name: '暂停自动轮播' }).click()
  await page.waitForTimeout(700)
}

/**
 * 当前页的卡片按钮。按页码定位而不是固定第 1 张，
 * 避免 hover/focus 时 Playwright 把横向轨道滚回第 1 张、触发 scroll 回写而改变页码。
 */
const activeCardOf = (carousel: Locator, current: string) =>
  carousel.getByRole('group').nth(Number(current.split('/')[0].trim()) - 1).getByRole('button').first()

/** 通过演示控制台切换指定菜品的售罄状态，完成后关闭控制台。 */
async function toggleSoldOutFromConsole(page: Page, dishName: string) {
  await page.getByRole('button', { name: '演示控制台' }).click()
  const consoleDialog = page.getByRole('dialog')
  await consoleDialog.getByRole('button', { name: dishName }).click()
  await consoleDialog.getByRole('button', { name: '完成设置' }).click()
  await expect(consoleDialog).toBeHidden()
}

test.describe('点单页推荐菜轮播', () => {
  test('REC-001: 点餐页展示推荐菜轮播，默认停留在第 1 张并展示全部指示点', async ({ page }) => {
    // 关闭自动轮播，避免断言期间页码变化
    await openMenu(page, { reducedMotion: 'reduce' })
    const carousel = carouselOf(page)
    await expect(carousel).toBeVisible()
    await expect(carousel.getByText('1 / 5')).toBeVisible()
    await expect(carousel.getByRole('group')).toHaveCount(5)
  })

  test('REC-002: 上一张/下一张与指示点可切换推荐菜并同步页码，支持首尾循环', async ({ page }) => {
    await openMenu(page, { reducedMotion: 'reduce' })
    const carousel = carouselOf(page)
    await carousel.getByRole('button', { name: '下一张推荐' }).click()
    await expect(carousel.getByText('2 / 5')).toBeVisible()
    await carousel.getByRole('button', { name: '上一张推荐' }).click()
    await expect(carousel.getByText('1 / 5')).toBeVisible()
    // 循环边界：第 1 张点上一张回到第 5 张，再点下一张回到第 1 张
    await carousel.getByRole('button', { name: '上一张推荐' }).click()
    await expect(carousel.getByText('5 / 5')).toBeVisible()
    await carousel.getByRole('button', { name: '下一张推荐' }).click()
    await expect(carousel.getByText('1 / 5')).toBeVisible()
    // 指示点直达第 4 张
    await carousel.getByRole('button', { name: '查看第 4 张推荐' }).click()
    await expect(carousel.getByText('4 / 5')).toBeVisible()
  })

  test('REC-003: 点击推荐卡片打开菜品规格弹窗，并成功加入本桌购物车', async ({ page }) => {
    await openMenu(page, { reducedMotion: 'reduce' })
    const carousel = carouselOf(page)
    await carousel.getByRole('button', { name: /鎏金番茄鸳鸯锅/ }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: '鎏金番茄鸳鸯锅' })).toBeVisible()
    await expect(dialog.getByRole('button', { name: '加入本桌购物车' })).toBeVisible()
    await dialog.getByRole('button', { name: '加入本桌购物车' }).click()
    await expect(dialog).toBeHidden()
    // preview 预置 1 份菜品，加购后购物车为 2 份，且出现推荐菜
    const cart = page.getByRole('complementary')
    await expect(cart.getByText('共 2 份菜品')).toBeVisible()
    await expect(cart.getByText('鎏金番茄鸳鸯锅')).toBeVisible()
  })

  test('REC-004: 自动轮播可暂停与恢复', async ({ page }) => {
    await openMenu(page)
    const carousel = carouselOf(page)
    await carousel.getByRole('button', { name: '暂停自动轮播' }).click()
    await expect(carousel.getByRole('button', { name: '继续自动轮播' })).toBeVisible()
    await carousel.getByRole('button', { name: '继续自动轮播' }).click()
    await expect(carousel.getByRole('button', { name: '暂停自动轮播' })).toBeVisible()
  })

  test('REC-005: 推荐菜售罄时置灰不可点，恢复售卖后重新可用', async ({ page }) => {
    await openMenu(page, { reducedMotion: 'reduce' })
    const carousel = carouselOf(page)
    const dishCard = carousel.getByRole('button', { name: /鎏金番茄鸳鸯锅/ })
    await expect(dishCard).toBeEnabled()

    await toggleSoldOutFromConsole(page, '鎏金番茄鸳鸯锅')
    await expect(carousel.getByText('今日售罄')).toBeVisible()
    await expect(dishCard).toBeDisabled()

    await toggleSoldOutFromConsole(page, '鎏金番茄鸳鸯锅')
    await expect(carousel.getByText('今日售罄')).toHaveCount(0)
    await expect(dishCard).toBeEnabled()
  })

  test('REC-006: 切换英文后轮播文案同步且当前页保持不变', async ({ page }) => {
    await openMenu(page, { reducedMotion: 'reduce' })
    const carousel = carouselOf(page)
    await carousel.getByRole('button', { name: '下一张推荐' }).click()
    await expect(carousel.getByText('2 / 5')).toBeVisible()

    await page.getByRole('button', { name: '切换语言' }).click()

    const englishCarousel = carouselOf(page, "Today's Picks")
    await expect(englishCarousel).toBeVisible()
    await expect(englishCarousel.getByRole('heading', { name: "Today's Picks" })).toBeVisible()
    await expect(englishCarousel.getByText('2 / 5')).toBeVisible()
    await expect(englishCarousel.getByRole('button', { name: 'Previous recommendation' })).toBeVisible()
    await expect(englishCarousel.getByRole('button', { name: 'Next recommendation' })).toBeVisible()
    await expect(englishCarousel.getByText('Choose options').first()).toBeVisible()
  })

  test('REC-007: 老人模式下自动轮播降速至 6.5 秒', async ({ page }) => {
    await openMenu(page)
    const carousel = carouselOf(page)
    // 先暂停，确保计时从「继续」点击后重新开始，避免页面加载耗时干扰
    await pauseAutoplay(page, carousel)
    await page.getByRole('button', { name: '切换至老人模式' }).click()
    const { current, next } = await currentAndNextPage(carousel)
    await carousel.getByRole('button', { name: '继续自动轮播' }).click()

    // 默认 4.5 秒间隔下 5 秒内必然切换；老人模式 6.5 秒内应保持当前页
    await page.waitForTimeout(5000)
    await expect(carousel.getByText(current)).toBeVisible()
    await expect(carousel.getByText(next)).toBeVisible({ timeout: 5000 })
  })

  test('REC-008: 默认自动轮播按 4.5 秒推进到下一张', async ({ page }) => {
    await openMenu(page)
    const carousel = carouselOf(page)
    // 从「继续」点击起计时，断言 8 秒内（4.5 秒间隔）推进到下一张
    await pauseAutoplay(page, carousel)
    const { next } = await currentAndNextPage(carousel)
    await carousel.getByRole('button', { name: '继续自动轮播' }).click()
    await expect(carousel.getByText(next)).toBeVisible({ timeout: 8000 })
  })

  test('REC-009: 切换分类与搜索时推荐轮播保持展示', async ({ page }) => {
    await openMenu(page, { reducedMotion: 'reduce' })
    const carousel = carouselOf(page)
    await page.getByRole('button', { name: '锅底' }).click()
    await expect(carousel).toBeVisible()
    await expect(carousel.getByText('1 / 5')).toBeVisible()
    await page.getByPlaceholder('搜索锅底、菜品或饮品').fill('牛肉')
    await expect(carousel).toBeVisible()
    await expect(carousel.getByText('1 / 5')).toBeVisible()
  })

  test('REC-010: 移动端 390×844 下轮播可见且页面无横向溢出', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openMenu(page, { reducedMotion: 'reduce' })
    const carousel = carouselOf(page)
    await expect(carousel).toBeVisible()
    await expect(carousel.getByRole('button', { name: '下一张推荐' })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })

  test('REC-011: 标签页隐藏时暂停自动轮播，恢复可见后继续', async ({ page }) => {
    // Playwright 无法真实切换标签页，用可写 getter 模拟 document.hidden 并派发 visibilitychange
    await page.addInitScript(() => {
      let hidden = false
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hidden ? 'hidden' : 'visible') })
      ;(window as unknown as { __setTabHidden: (value: boolean) => void }).__setTabHidden = (value) => {
        hidden = value
        document.dispatchEvent(new Event('visibilitychange'))
      }
    })
    await openMenu(page)
    const carousel = carouselOf(page)
    await pauseAutoplay(page, carousel)
    await page.evaluate(() => (window as unknown as { __setTabHidden: (value: boolean) => void }).__setTabHidden(true))
    const { current, next } = await currentAndNextPage(carousel)
    await carousel.getByRole('button', { name: '继续自动轮播' }).click()

    // 隐藏状态下超过一个自动播放周期仍不应推进
    await page.waitForTimeout(5200)
    await expect(carousel.getByText(current)).toBeVisible()

    await page.evaluate(() => (window as unknown as { __setTabHidden: (value: boolean) => void }).__setTabHidden(false))
    await expect(carousel.getByText(next)).toBeVisible({ timeout: 8000 })
  })

  test('REC-012: 指针悬停轮播时暂停自动轮播，移出后恢复', async ({ page }) => {
    await openMenu(page)
    const carousel = carouselOf(page)
    await pauseAutoplay(page, carousel)
    const { current, next } = await currentAndNextPage(carousel)
    await carousel.getByRole('button', { name: '继续自动轮播' }).click()

    // 指针进入当前页卡片后悬停，超过一个自动播放周期仍不应推进
    await activeCardOf(carousel, current).hover()
    await page.waitForTimeout(5200)
    await expect(carousel.getByText(current)).toBeVisible()

    await page.mouse.move(0, 0)
    await expect(carousel.getByText(next)).toBeVisible({ timeout: 8000 })
  })

  test('REC-013: 键盘焦点进入轮播时暂停自动轮播，焦点移出后恢复', async ({ page }) => {
    await openMenu(page)
    const carousel = carouselOf(page)
    await pauseAutoplay(page, carousel)
    const { current, next } = await currentAndNextPage(carousel)
    await carousel.getByRole('button', { name: '继续自动轮播' }).click()

    // 聚焦当前页卡片（焦点进入轨道），超过一个自动播放周期仍不应推进
    await activeCardOf(carousel, current).focus()
    await page.waitForTimeout(5200)
    await expect(carousel.getByText(current)).toBeVisible()

    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
    await expect(carousel.getByText(next)).toBeVisible({ timeout: 8000 })
  })

  test('REC-014: 环境不支持 matchMedia 时按未开启减少动效处理，自动播放可用', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'matchMedia', { configurable: true, value: undefined })
    })
    await openMenu(page)
    const carousel = carouselOf(page)
    await expect(carousel.getByRole('button', { name: '暂停自动轮播' })).toBeVisible()
    await expect(carousel.getByRole('button', { name: '下一张推荐' })).toBeVisible()
  })

  test('NFR-001: 系统开启「减少动态效果」时不自动轮播，且不展示暂停按钮', async ({ page }) => {
    await openMenu(page, { reducedMotion: 'reduce' })
    const carousel = carouselOf(page)
    await expect(carousel.getByRole('button', { name: '暂停自动轮播' })).toHaveCount(0)
    await expect(carousel.getByRole('button', { name: '下一张推荐' })).toBeVisible()
  })
})
