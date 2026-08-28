import assert from 'node:assert/strict';
import test from 'node:test';
import { getDynamicSquadChannelNames, isSquadCreationChannel } from '../src/squadManager.js';

test('recognizes the dynamic squad trigger by exact name or configured ID', () => {
  assert.equal(isSquadCreationChannel('➕ · Criar Squad', 'voice-1', 'voice-2'), true);
  assert.equal(isSquadCreationChannel('Outro canal', 'voice-2', 'voice-2'), true);
  assert.equal(isSquadCreationChannel('➕ criar squad', 'voice-1', 'voice-2'), false);
  assert.equal(isSquadCreationChannel('Outro canal', 'voice-1', 'voice-2'), false);
});

test('builds the exact dynamic squad channel names', () => {
  assert.deepEqual(getDynamicSquadChannelNames('Tavo'), {
    voiceName: '🔊 · Squad de Tavo',
    textName: '💬 · squad-de-Tavo',
  });
});