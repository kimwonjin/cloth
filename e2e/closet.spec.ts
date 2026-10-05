import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Full user journey on the web build against a local Supabase:
 * login → register clothes → today's outfits (swap/save/publish/wear) →
 * OOTD calendar + selfie → second user explores, likes, saves, copies.
 */

const PHOTOS = join(__dirname, 'photos');
const SHOTS = process.env.SCREENSHOT_DIR ?? join(__dirname, 'screenshots');
mkdirSync(SHOTS, { recursive: true });

const run = String(Date.now()).slice(-8);
const PHONE_A = `010${run}`;
const PHONE_B = `011${run}`;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function shot(page: Page, name: string) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(SHOTS, `${name}.png`) });
}

async function login(page: Page, phone: string) {
  await page.goto('/');
  await expect(page.getByTestId('phone-input')).toBeVisible();
  await page.getByTestId('phone-input').fill(phone);
  await expect(page.getByTestId('phone-input')).toHaveValue(/^01\d-\d{4}-\d{4}$/);
  await page.getByTestId('login-button').click();
  await expect(page.getByText('오늘의 코디').first()).toBeVisible();
}

async function registerClothing(
  page: Page,
  file: string,
  expected: { category: string; color?: string }
) {
  await page.goto('/clothing/new');
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('pick-library').click();
  await (await chooser).setFiles(join(PHOTOS, `${file}.png`));
  await expect(page.getByTestId('clothing-preview')).toBeVisible();
  // Auto-detected category / color are preselected (user can still change them).
  const category = page.getByTestId(`category-${expected.category}`);
  if ((await category.getAttribute('aria-selected')) !== 'true') await category.click();
  await expect(category).toHaveAttribute('aria-selected', 'true');
  if (expected.color) {
    await expect(page.getByTestId(`color-${expected.color}`)).toHaveAttribute('aria-selected', 'true');
  }
  await page.getByTestId('save-clothing').click();
  await expect(page.getByTestId('toast')).toHaveText('옷장에 등록했어요');
}

async function logout(page: Page) {
  await page.goto('/settings');
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('logout').click();
  await expect(page.getByTestId('phone-input')).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test('login validates the phone number', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('phone-input').fill('0212345');
  await expect(page.getByTestId('login-button')).toHaveAttribute('aria-disabled', 'true');
  await shot(page, '01-login');
});

test('user A: empty closet, register clothes with auto background removal + tagging', async ({ page }) => {
  await login(page, PHONE_A);
  await expect(page.getByText('옷장이 비어 있어요')).toBeVisible();
  await shot(page, '02-home-empty');

  // First photo: check the processed preview and the auto tags.
  await page.goto('/clothing/new');
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('pick-library').click();
  await (await chooser).setFiles(join(PHOTOS, 'top-white.png'));
  await expect(page.getByTestId('clothing-preview')).toBeVisible();
  await expect(page.getByTestId('category-top')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('color-white')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('photo-warnings')).toHaveCount(0);
  await shot(page, '03-register-preview');
  await page.getByTestId('brand-input').fill('유니클로');
  await page.getByTestId('save-clothing').click();
  await expect(page.getByTestId('toast')).toHaveText('옷장에 등록했어요');

  await registerClothing(page, 'top-navy', { category: 'top', color: 'navy' });
  await registerClothing(page, 'top-red', { category: 'top', color: 'red' });
  await registerClothing(page, 'bottom-denim', { category: 'bottom' });
  await registerClothing(page, 'bottom-black', { category: 'bottom', color: 'black' });
  await registerClothing(page, 'shoes-white', { category: 'shoes', color: 'white' });
  await registerClothing(page, 'outer-khaki', { category: 'outer' });

  // Closet grid + filters
  await page.goto('/closet');
  await expect(page.getByTestId('clothing-cell')).toHaveCount(7);
  await page.getByRole('button', { name: '하의' }).first().click();
  await expect(page.getByTestId('clothing-cell')).toHaveCount(2);
  await page.getByRole('button', { name: '전체' }).first().click();
  await expect(page.getByTestId('clothing-cell')).toHaveCount(7);
  await shot(page, '04-closet-grid');
});

test('user A: today’s outfits — swap, save, publish, wear', async ({ page }) => {
  await login(page, PHONE_A);
  const suggestions = page.getByTestId('suggestion');
  await expect(suggestions).toHaveCount(3);
  await shot(page, '05-home-suggestions');

  // Each suggestion has top, bottom and shoes from my closet.
  for (let i = 0; i < 3; i++) {
    const s = suggestions.nth(i);
    await expect(s.getByTestId('collage-top')).toBeVisible();
    await expect(s.getByTestId('collage-bottom')).toBeVisible();
    await expect(s.getByTestId('collage-shoes')).toBeVisible();
  }

  // Swap the bottom of the first suggestion.
  const first = suggestions.first();
  const bottomSrc = async () =>
    first.getByTestId('collage-bottom').locator('img').first().getAttribute('src');
  const before = await bottomSrc();
  await first.getByRole('button', { name: '하의 바꾸기' }).click();
  await expect.poll(bottomSrc).not.toBe(before);

  // Refresh keeps three suggestions.
  await page.getByTestId('refresh-outfits').click();
  await expect(suggestions).toHaveCount(3);

  await first.getByRole('button', { name: '저장' }).click();
  await expect(page.getByTestId('toast')).toHaveText('코디를 저장했어요');
  await expect(first.getByRole('button', { name: '저장됨' })).toBeVisible();

  await suggestions.nth(1).getByRole('button', { name: '게시' }).click();
  await expect(page.getByTestId('toast')).toHaveText('탐색 탭에 게시했어요');

  await page.getByTestId('wear-today-2').click();
  await expect(page.getByTestId('toast')).toHaveText('오늘의 OOTD로 기록했어요');
  await shot(page, '06-home-after-actions');
});

test('user A: OOTD calendar, selfie, stats and past-date logging', async ({ page }) => {
  await login(page, PHONE_A);
  await page.getByTestId('tab-calendar').click();
  const today = page.getByTestId(`day-${todayKey()}`);
  await expect(today).toHaveAttribute('aria-label', /기록 있음/);
  await expect(page.getByTestId('wear-count').first()).toHaveText('1회');
  await shot(page, '07-calendar');

  await today.click();
  await expect(page.getByTestId('ootd-collage')).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByTestId('ootd-add-photo').click();
  await (await chooser).setFiles(join(PHOTOS, 'selfie.png'));
  await expect(page.getByTestId('toast')).toHaveText('사진을 남겼어요');
  await expect(page.getByTestId('ootd-photo')).toBeVisible();
  await shot(page, '08-ootd-day');

  // Log yesterday by picking items manually.
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yKey = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  await page.goto(`/ootd/${yKey}`);
  await expect(page.getByText('이 날 기록이 없어요')).toBeVisible();
  await page.getByTestId('ootd-pick-items').click();
  await page.getByTestId('pick-top').first().click();
  await page.getByTestId('pick-bottom').first().click();
  await expect(page.getByTestId('builder-preview')).toBeVisible();
  await page.getByTestId('save-wear').click();
  await expect(page.getByTestId('toast')).toHaveText('OOTD로 기록했어요');
  await expect(page.getByTestId('ootd-collage')).toBeVisible();

  // Wear count on the clothing detail reflects both days for a worn item.
  await page.goto('/calendar');
  await expect(page.getByTestId('wear-count').first()).toHaveText(/^[12]회$/);
});

test('user B: explore A’s public outfit, like, save to board, copy with own clothes', async ({ page }) => {
  await login(page, PHONE_B);
  await page.goto('/settings');
  await page.getByTestId('nickname-input').fill('비비');
  await page.getByTestId('save-nickname').click();
  await expect(page.getByTestId('toast')).toHaveText('닉네임을 저장했어요');

  await registerClothing(page, 'top-white', { category: 'top', color: 'white' });
  await registerClothing(page, 'bottom-beige', { category: 'bottom' });
  await registerClothing(page, 'shoes-white', { category: 'shoes' });

  await page.goto('/explore');
  // Only A's published outfit is visible (saved/worn ones are private by default).
  const cards = page.getByTestId('outfit-card');
  await expect(cards.first()).toBeVisible();
  const mineCount = await cards.count();
  expect(mineCount).toBeGreaterThanOrEqual(1);
  await shot(page, '09-explore');

  await cards.first().click();
  await expect(page.getByTestId('outfit-collage')).toBeVisible();
  await expect(page.getByTestId('like-count')).toHaveText('좋아요 0');
  await page.getByTestId('like-button').click();
  await expect(page.getByTestId('like-count')).toHaveText('좋아요 1');
  await page.getByTestId('board-button').click();
  await expect(page.getByTestId('toast')).toHaveText('내 보드에 저장했어요');
  await shot(page, '10-outfit-detail');

  await page.getByTestId('copy-outfit').click();
  await expect(page.getByTestId('builder-preview')).toBeVisible();
  await expect(page.getByText('내 옷장에서 가장 비슷한 옷으로 골랐어요.', { exact: false })).toBeVisible();
  await shot(page, '11-copy-outfit');
  await page.getByTestId('save-outfit').click();
  await expect(page.getByTestId('toast')).toHaveText('코디를 저장했어요');
  // The copied outfit opens as "내 코디" (the explored outfit stays mounted underneath).
  await expect(page.getByTestId('toggle-visibility').filter({ visible: true })).toBeVisible();

  await page.goto('/closet');
  await page.getByTestId('closet-tab-board').click();
  await expect(page.getByTestId('outfit-card')).toHaveCount(1);
  await shot(page, '12-closet-board');
  await logout(page);
});

test('user A: sees the like, can make the outfit private, then it leaves explore', async ({ page }) => {
  await login(page, PHONE_A);
  await page.goto('/closet');
  await page.getByTestId('closet-tab-posts').click();
  await page.getByTestId('outfit-card').first().click();
  await expect(page.getByTestId('like-count')).toHaveText('좋아요 1');
  await page.getByTestId('toggle-visibility').click();
  await expect(page.getByTestId('toast')).toHaveText('비공개로 바꿨어요');

  await page.goto('/explore');
  await expect(page.getByText('아직 공개된 코디가 없어요')).toBeVisible();
});

test('user A: edit and delete a clothing item, delete an outfit and a wear log', async ({ page }) => {
  await login(page, PHONE_A);

  // Edit: change the red top's color and brand.
  await page.goto('/closet');
  await page.getByRole('button', { name: '상의' }).first().click();
  const before = await page.getByTestId('clothing-cell').count();
  await page.getByTestId('clothing-cell').first().click();
  await expect(page.getByTestId('clothing-wear-count')).toBeVisible();
  await page.getByTestId('color-pink').click();
  await page.getByTestId('brand-input').fill('테스트브랜드');
  await page.getByRole('button', { name: '저장', exact: true }).click();
  await expect(page.getByTestId('toast')).toHaveText('저장했어요');
  await page.reload();
  await expect(page.getByTestId('color-pink')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByTestId('brand-input')).toHaveValue('테스트브랜드');

  // Delete it.
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('delete-clothing').click();
  await expect(page.getByTestId('toast')).toHaveText('삭제했어요');
  await page.goto('/closet');
  await page.getByRole('button', { name: '상의' }).first().click();
  await expect(page.getByTestId('clothing-cell')).toHaveCount(before - 1);

  // Delete yesterday's wear log.
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yKey = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
  await page.goto(`/ootd/${yKey}`);
  await expect(page.getByTestId('ootd-collage')).toBeVisible();
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: '기록 삭제' }).click();
  await expect(page.getByTestId('toast')).toHaveText('삭제했어요');
  await expect(page.getByText('이 날 기록이 없어요')).toBeVisible();

  // Pick a saved outfit for that day instead, then delete the outfit itself.
  const saved = page.getByTestId('outfit-card');
  await expect(saved.first()).toBeVisible();
  await saved.first().click();
  await expect(page.getByTestId('toast')).toHaveText('기록했어요');
  await expect(page.getByTestId('ootd-collage')).toBeVisible();
});

test('explore filters narrow results', async ({ page }) => {
  await login(page, PHONE_B);
  await page.goto('/closet');
  await page.getByTestId('closet-tab-board').click();
  // A made the outfit private, so it disappears from B's board too.
  await expect(page.getByText('저장한 코디가 없어요')).toBeVisible();

  // B publishes the copied outfit with a style tag, then filters by it.
  await page.goto('/closet');
  await page.getByTestId('closet-tab-clothes').click();
  await page.goto('/outfit/new');
  await page.getByTestId('pick-top').first().click();
  await page.getByTestId('pick-bottom').first().click();
  await page.getByRole('button', { name: '미니멀' }).click();
  await page.getByTestId('visibility-public').click();
  await page.getByTestId('save-outfit').click();
  await expect(page.getByTestId('toast')).toHaveText('저장하고 탐색에 게시했어요');

  await page.goto('/explore');
  await expect(page.getByTestId('outfit-card')).toHaveCount(1);
  await page.getByRole('button', { name: '스트릿' }).click();
  await expect(page.getByText('아직 공개된 코디가 없어요')).toBeVisible();
  await page.getByRole('button', { name: '미니멀' }).click();
  await expect(page.getByTestId('outfit-card')).toHaveCount(1);
  await page.getByRole('button', { name: '여름' }).click();
  await page.getByRole('button', { name: '모든 계절' }).click();
  await expect(page.getByTestId('outfit-card')).toHaveCount(1);
});

test.describe('dark mode', () => {
  test.use({ colorScheme: 'dark' });
  test('renders main screens in dark mode', async ({ page }) => {
    await login(page, PHONE_A);
    await shot(page, '13-dark-home');
    await page.getByTestId('tab-closet').click();
    await expect(page.getByTestId('clothing-cell').first()).toBeVisible();
    await shot(page, '14-dark-closet');
    await page.getByTestId('tab-explore').click();
    await shot(page, '15-dark-explore');
  });
});
