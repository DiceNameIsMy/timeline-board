import test from 'node:test';
import assert from 'node:assert/strict';
import { keyboardCommand } from '../src/keyboard.js';

const context = { editorOpen: false, dialogOpen: false, typing: false, inTimeline: false, hasEntry: false };
const command = (key, state = {}, event = {}) => keyboardCommand({ key, ...event }, { ...context, ...state });

test('adding, selection, outlook navigation and help have discoverable commands', () => {
  for (const [key, expected] of [['n', 'add'], ['N', 'add'], ['j', 'select-next'], ['k', 'select-previous'], ['1', 'zoom-1'], ['3', 'zoom-3'], ['6', 'zoom-6'], ['PageUp', 'previous'], ['PageDown', 'next'], ['t', 'today'], ['?', 'help']]) {
    assert.equal(command(key), expected);
  }
});

test('shortcuts do not steal typing, browser modifiers, composition or modal keys', () => {
  for (const key of ['n', 'j', '1', 't', 'PageDown', '?']) {
    assert.equal(command(key, { typing: true }), null);
    assert.equal(command(key, { dialogOpen: true }), null);
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey', 'isComposing', 'defaultPrevented']) assert.equal(command(key, {}, { [modifier]: true }), null);
  }
  assert.equal(command('n', {}, { repeat: true }), null);
});

test('arrows are scoped to the timeline and completion requires a focused entry', () => {
  assert.equal(command('ArrowLeft'), null);
  assert.equal(command('ArrowLeft', { inTimeline: true }), 'scroll-left');
  assert.equal(command('ArrowDown', { inTimeline: true }), 'select-next');
  assert.equal(command('x'), null);
  assert.equal(command('x', { hasEntry: true }), 'complete');
});

test('Ctrl or Cmd Enter saves in the editor; ordinary input and repeated saves stay native', () => {
  for (const modifier of ['ctrlKey', 'metaKey']) {
    assert.equal(command('Enter', { editorOpen: true, typing: true }, { [modifier]: true }), 'save');
    assert.equal(command('Enter', { editorOpen: true }, { [modifier]: true, repeat: true }), null);
  }
  assert.equal(command('Enter', { editorOpen: true }), null);
  assert.equal(command('n', { editorOpen: true }), null);
});
