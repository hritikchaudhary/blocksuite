import { EDITOR_WIDTH } from '@blocksuite/global/config';
import { expect } from '@playwright/test';

import {
  activeNoteInEdgeless,
  addNote,
  assertMouseMode,
  changeEdgelessNoteBackground,
  countBlock,
  getNoteRect,
  initThreeNotes,
  locatorComponentToolbar,
  locatorEdgelessToolButton,
  selectNoteInEdgeless,
  setMouseMode,
  switchEditorMode,
  triggerComponentToolbarAction,
} from '../utils/actions/edgeless.js';
import {
  click,
  clickBlockById,
  copyByKeyboard,
  dragBetweenCoords,
  dragBlockToPoint,
  dragHandleFromBlockToBlockBottomById,
  enterPlaygroundRoom,
  focusRichText,
  initEmptyEdgelessState,
  initThreeParagraphs,
  pasteByKeyboard,
  pressArrowDown,
  pressArrowUp,
  pressEnter,
  redoByClick,
  type,
  undoByClick,
  waitForVirgoStateUpdated,
  waitNextFrame,
} from '../utils/actions/index.js';
import {
  assertBlockCount,
  assertEdgelessHoverRect,
  assertEdgelessNonSelectedRect,
  assertEdgelessNoteBackground,
  assertEdgelessSelectedRect,
  assertNativeSelectionRangeCount,
  assertNoteXYWH,
  assertRectEqual,
  assertRichTexts,
  assertSelection,
} from '../utils/asserts.js';
import { test } from '../utils/playwright.js';

const CENTER_X = 450;
const CENTER_Y = 300;

test('can drag selected non-active note', async ({ page }) => {
  await enterPlaygroundRoom(page);
  await initEmptyEdgelessState(page);
  await focusRichText(page);
  await type(page, 'hello');
  await assertRichTexts(page, ['hello']);

  await switchEditorMode(page);
  await assertNoteXYWH(page, [0, 0, EDITOR_WIDTH, 80]);

  // selected, non-active
  await page.mouse.click(CENTER_X, CENTER_Y);
  await dragBetweenCoords(
    page,
    { x: CENTER_X, y: CENTER_Y },
    { x: CENTER_X, y: CENTER_Y + 100 }
  );
  await assertNoteXYWH(page, [0, 100, EDITOR_WIDTH, 80]);
});

test('resize note in edgeless mode', async ({ page }) => {
  await enterPlaygroundRoom(page);
  const ids = await initEmptyEdgelessState(page);
  await activeNoteInEdgeless(page, ids.noteId);
  await waitForVirgoStateUpdated(page);
  await type(page, 'hello');
  await assertRichTexts(page, ['hello']);

  await switchEditorMode(page);
  await page.mouse.move(100, 100); // FIXME: no update until mousemove

  expect(ids.noteId).toBe('2'); // 0 for page, 1 for surface
  await selectNoteInEdgeless(page, ids.noteId);

  const initRect = await getNoteRect(page, ids);
  const leftHandle = page.locator('[aria-label="handle-left"]');
  const box = await leftHandle.boundingBox();
  if (box === null) throw new Error();

  await dragBetweenCoords(
    page,
    { x: box.x + 5, y: box.y + 5 },
    { x: box.x + 105, y: box.y + 5 }
  );
  const draggedRect = await getNoteRect(page, ids);
  assertRectEqual(draggedRect, {
    x: initRect.x + 100,
    y: initRect.y,
    w: initRect.w - 100,
    h: initRect.h,
  });

  await switchEditorMode(page);
  await switchEditorMode(page);
  const newRect = await getNoteRect(page, ids);
  assertRectEqual(newRect, draggedRect);
});

test('add Note', async ({ page }) => {
  await enterPlaygroundRoom(page);
  await initEmptyEdgelessState(page);

  await switchEditorMode(page);
  await setMouseMode(page, 'note');

  await addNote(page, 'hello', 30, 40);

  await assertMouseMode(page, 'default');
  await assertRichTexts(page, ['', 'hello']);
  await assertEdgelessSelectedRect(page, [0, 0, 448, 80]);
});

test('add empty Note', async ({ page }) => {
  await enterPlaygroundRoom(page);
  await initEmptyEdgelessState(page);

  await switchEditorMode(page);
  await setMouseMode(page, 'note');

  // add note at 30,40
  await page.mouse.click(30, 40);
  await waitForVirgoStateUpdated(page);
  await pressEnter(page);
  // should wait for virgo update and resizeObserver callback
  await waitNextFrame(page);

  // assert add note success
  await page.mouse.move(30, 40);
  await assertEdgelessSelectedRect(page, [0, 0, 448, 112]);

  // click out of note
  await page.mouse.click(0, 200);

  // assert empty note is removed
  await page.mouse.move(30, 40);
  await assertEdgelessNonSelectedRect(page);
});

test('always keep at least 1 note block', async ({ page }) => {
  await enterPlaygroundRoom(page);
  await initEmptyEdgelessState(page);

  await switchEditorMode(page);
  await setMouseMode(page, 'default');

  // clicking in default mode will try to remove empty note block
  await page.mouse.click(0, 0);

  const notes = await page.locator('affine-note').all();
  expect(notes.length).toEqual(1);
});

test('edgeless arrow up/down', async ({ page }) => {
  await enterPlaygroundRoom(page);
  const ids = await initEmptyEdgelessState(page);

  await activeNoteInEdgeless(page, ids.noteId);
  await waitForVirgoStateUpdated(page);

  await type(page, 'hello');
  await pressEnter(page);
  await type(page, 'world');
  await pressEnter(page);
  await type(page, 'foo');

  await switchEditorMode(page);

  await activeNoteInEdgeless(page, ids.noteId);
  await waitForVirgoStateUpdated(page);
  // 0 for page, 1 for surface, 2 for note, 3 for paragraph
  expect(ids.paragraphId).toBe('3');
  await clickBlockById(page, ids.paragraphId);

  await pressArrowDown(page);
  await assertSelection(page, 1, 4, 0);

  await pressArrowUp(page);
  await assertSelection(page, 0, 4, 0);

  await pressArrowUp(page);
  await assertSelection(page, 0, 4, 0);
});

test('dragging un-selected note', async ({ page }) => {
  await enterPlaygroundRoom(page);
  await initEmptyEdgelessState(page);
  await focusRichText(page);
  await type(page, 'hello');
  await assertRichTexts(page, ['hello']);

  await switchEditorMode(page);

  const noteBox = await page
    .locator('.affine-edgeless-block-child')
    .boundingBox();
  if (!noteBox) {
    throw new Error('Missing edgeless affine-note');
  }
  await page.mouse.move(noteBox.x + 5, noteBox.y + 5);
  await assertEdgelessHoverRect(page, [
    noteBox.x,
    noteBox.y,
    noteBox.width,
    noteBox.height,
  ]);

  await dragBetweenCoords(
    page,
    { x: noteBox.x + 5, y: noteBox.y + 5 },
    { x: noteBox.x + 25, y: noteBox.y + 25 },
    { steps: 10 }
  );

  await page.mouse.move(noteBox.x + 25, noteBox.y + 25);
  await assertEdgelessHoverRect(page, [
    noteBox.x + 20,
    noteBox.y + 20,
    noteBox.width,
    noteBox.height,
  ]);
});

test('drag handle should be shown when a note is actived in default mode or hidden in other modes', async ({
  page,
}) => {
  await enterPlaygroundRoom(page);
  await initEmptyEdgelessState(page);
  await focusRichText(page);
  await type(page, 'hello');
  await assertRichTexts(page, ['hello']);

  await switchEditorMode(page);
  const noteBox = await page
    .locator('.affine-edgeless-block-child')
    .boundingBox();
  if (!noteBox) {
    throw new Error('Missing edgeless affine-note');
  }

  const [x, y] = [noteBox.x + 26, noteBox.y + noteBox.height / 2];

  await page.mouse.move(x, y);
  await expect(page.locator('affine-drag-handle')).toBeHidden();
  await page.mouse.dblclick(x, y);
  await page.mouse.move(x, y);
  await expect(page.locator('affine-drag-handle')).toBeVisible();

  await page.mouse.move(0, 0);
  await setMouseMode(page, 'shape');
  await page.mouse.move(x, y);
  await expect(page.locator('affine-drag-handle')).toBeHidden();

  await page.mouse.move(0, 0);
  await setMouseMode(page, 'default');
  await page.mouse.move(x, y);
  await expect(page.locator('affine-drag-handle')).toBeVisible();
});

test('drag handle should work inside one note', async ({ page }) => {
  await enterPlaygroundRoom(page);
  await initEmptyEdgelessState(page);
  await initThreeParagraphs(page);

  await switchEditorMode(page);

  await page.mouse.dblclick(CENTER_X, CENTER_Y);
  await dragHandleFromBlockToBlockBottomById(page, '3', '5');
  await waitNextFrame(page);
  await expect(page.locator('affine-drag-handle')).toBeHidden();
  await assertRichTexts(page, ['456', '789', '123']);
});

test('drag handle should work across multiple notes', async ({ page }) => {
  await enterPlaygroundRoom(page);
  await initEmptyEdgelessState(page);
  await initThreeParagraphs(page);
  await assertRichTexts(page, ['123', '456', '789']);

  await switchEditorMode(page);

  await setMouseMode(page, 'note');

  await page.mouse.click(30, 40);
  await waitForVirgoStateUpdated(page);

  // 7
  await type(page, '000');

  await page.mouse.dblclick(CENTER_X, CENTER_Y);
  await dragHandleFromBlockToBlockBottomById(page, '3', '7');
  await expect(page.locator('affine-drag-handle')).toBeHidden();
  await waitNextFrame(page);
  await assertRichTexts(page, ['456', '789', '000', '123']);

  await page.mouse.dblclick(30, 40);
  await dragHandleFromBlockToBlockBottomById(page, '7', '4');
  await waitNextFrame(page);
  await expect(page.locator('affine-drag-handle')).toBeHidden();
  await assertRichTexts(page, ['456', '000', '789', '123']);

  await expect(page.locator('affine-selected-blocks > *')).toHaveCount(0);
});

test('drag handle should add new note when dragged outside note', async ({
  page,
}) => {
  await enterPlaygroundRoom(page);
  await initEmptyEdgelessState(page);
  await initThreeParagraphs(page);
  await assertRichTexts(page, ['123', '456', '789']);

  await switchEditorMode(page);

  await expect(page.locator('.affine-edgeless-block-child')).toHaveCount(1);

  await page.mouse.dblclick(CENTER_X, CENTER_Y);
  await dragBlockToPoint(page, '3', { x: 30, y: 40 });
  await waitNextFrame(page);
  await expect(page.locator('affine-drag-handle')).toBeHidden();
  await assertRichTexts(page, ['123', '456', '789']);

  await expect(page.locator('.affine-edgeless-block-child')).toHaveCount(2);
  await expect(page.locator('affine-selected-blocks > *')).toHaveCount(0);
});

test('format quick bar should show up when double-clicking on text', async ({
  page,
}) => {
  await enterPlaygroundRoom(page);
  await initEmptyEdgelessState(page);
  await initThreeParagraphs(page);
  await switchEditorMode(page);

  await page.mouse.dblclick(CENTER_X, CENTER_Y);
  await waitNextFrame(page);

  await page
    .locator('.affine-rich-text')
    .nth(1)
    .dblclick({
      position: { x: 10, y: 10 },
    });
  await page.waitForTimeout(200);
  const formatQuickBar = page.locator('.format-quick-bar');
  await expect(formatQuickBar).toBeVisible();
});

test('when editing text in edgeless, should hide component toolbar', async ({
  page,
}) => {
  await enterPlaygroundRoom(page);
  const ids = await initEmptyEdgelessState(page);
  await initThreeParagraphs(page);
  await switchEditorMode(page);

  await selectNoteInEdgeless(page, ids.noteId);

  const toolbar = locatorComponentToolbar(page);
  await expect(toolbar).toBeVisible();

  await page.mouse.click(0, 0);
  await activeNoteInEdgeless(page, ids.noteId);
  await expect(toolbar).toBeHidden();
});

test('double click toolbar zoom button, should not add text', async ({
  page,
}) => {
  await enterPlaygroundRoom(page);
  await initEmptyEdgelessState(page);
  await switchEditorMode(page);

  const zoomOutButton = locatorEdgelessToolButton(page, 'zoomOut', false);
  await zoomOutButton.dblclick();
  await assertEdgelessNonSelectedRect(page);
});

test('change note color', async ({ page }) => {
  await enterPlaygroundRoom(page);
  const ids = await initEmptyEdgelessState(page);
  await initThreeParagraphs(page);
  await switchEditorMode(page);

  await assertEdgelessNoteBackground(
    page,
    ids.noteId,
    '--affine-background-secondary-color'
  );

  await selectNoteInEdgeless(page, ids.noteId);
  await triggerComponentToolbarAction(page, 'changeNoteColor');
  const color = '--affine-tag-blue';
  await changeEdgelessNoteBackground(page, color);
  await assertEdgelessNoteBackground(page, ids.noteId, color);
});

test('cursor for active and inactive state', async ({ page }) => {
  await enterPlaygroundRoom(page);
  await initEmptyEdgelessState(page);
  await focusRichText(page);
  await type(page, 'hello');
  await pressEnter(page);
  await pressEnter(page);
  await assertRichTexts(page, ['hello', '', '']);

  // inactive
  await switchEditorMode(page);
  await undoByClick(page);
  await waitNextFrame(page);

  await redoByClick(page);
  await waitNextFrame(page);

  // active
  await page.mouse.dblclick(CENTER_X, CENTER_Y);
  await waitNextFrame(page);
  await assertNativeSelectionRangeCount(page, 1);

  await undoByClick(page);
  await waitNextFrame(page);
  await assertNativeSelectionRangeCount(page, 1);
});

test('continuous undo and redo (note blcok add operation) should work', async ({
  page,
}) => {
  await enterPlaygroundRoom(page);
  await initEmptyEdgelessState(page);
  await focusRichText(page);
  await type(page, 'hello');
  await switchEditorMode(page);
  await page.pause();
  await click(page, { x: 60, y: 270 });
  await copyByKeyboard(page);

  let count = await countBlock(page, 'affine-note');
  expect(count).toBe(1);

  await page.mouse.move(100, 100);
  await pasteByKeyboard(page, false);
  await waitNextFrame(page, 1000);

  await page.mouse.move(200, 200);
  await pasteByKeyboard(page, false);
  await waitNextFrame(page, 1000);

  await page.mouse.move(300, 300);
  await pasteByKeyboard(page, false);
  await waitNextFrame(page, 1000);

  count = await countBlock(page, 'affine-note');
  expect(count).toBe(4);

  await undoByClick(page);
  count = await countBlock(page, 'affine-note');
  expect(count).toBe(3);

  await undoByClick(page);
  count = await countBlock(page, 'affine-note');
  expect(count).toBe(2);

  await redoByClick(page);
  count = await countBlock(page, 'affine-note');
  expect(count).toBe(3);

  await redoByClick(page);
  count = await countBlock(page, 'affine-note');
  expect(count).toBe(4);
});

test('manage note index and hidden status', async ({ page }) => {
  await enterPlaygroundRoom(page);
  await initEmptyEdgelessState(page);
  await switchEditorMode(page);
  await initThreeNotes(page);

  // unset select state and remove empty note from `initEmptyEdgelessState`
  await page.mouse.click(10, 100);
  assertBlockCount(page, 'note', 3);
  await waitNextFrame(page);

  // select note-1
  await selectNoteInEdgeless(page, '4');
  expect(await page.locator('.note-status').innerText()).toBe('1');

  // select note-2
  await selectNoteInEdgeless(page, '6');
  expect(await page.locator('.note-status').innerText()).toBe('2');

  // select note-3
  await selectNoteInEdgeless(page, '8');
  expect(await page.locator('.note-status').innerText()).toBe('3');

  // hide note-3
  await page.locator('.note-status-button').click();
  expect(await page.locator('.note-status').count()).toBe(0);
  // reappear note-3
  await page.locator('.note-status-button').click();
  // index of note-3 still be 3
  expect(await page.locator('.note-status').innerText()).toBe('3');

  // select note-2 and hide
  await selectNoteInEdgeless(page, '6');
  await page.locator('.note-status-button').click();
  expect(await page.locator('.note-status').count()).toBe(0);

  // index of note-1 still 1
  await selectNoteInEdgeless(page, '4');
  expect(await page.locator('.note-status').innerText()).toBe('1');

  // index of note-3 will be 2
  await selectNoteInEdgeless(page, '8');
  expect(await page.locator('.note-status').innerText()).toBe('2');

  // switch to editor mode, note-2 will be hidden
  await switchEditorMode(page);
  expect(await page.locator('affine-note[data-block-id="6"]').count()).toBe(0);

  // switch to edgeless mode, note-2 will be visible
  await switchEditorMode(page);
  expect(await page.locator('affine-note[data-block-id="6"]').count()).toBe(1);

  // select note-2 and reappear
  await selectNoteInEdgeless(page, '6');
  await waitNextFrame(page);
  await page.locator('.note-status-button').click();

  // index of note-1 still 1
  await selectNoteInEdgeless(page, '4');
  expect(await page.locator('.note-status').innerText()).toBe('1');

  // index of note-2 will be 3
  await selectNoteInEdgeless(page, '6');
  expect(await page.locator('.note-status').innerText()).toBe('3');

  // index of note-3 will be 2
  await selectNoteInEdgeless(page, '8');
  expect(await page.locator('.note-status').innerText()).toBe('2');
});
