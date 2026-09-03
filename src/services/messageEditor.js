const pendingEdits = new Map();
const EDIT_WINDOW_MS = 2 * 60 * 1000;

function keyFor(userId, channelId) {
  return `${userId}:${channelId}`;
}

function setPendingEdit(userId, channelId, messageId) {
  pendingEdits.set(keyFor(userId, channelId), {
    messageId,
    expiresAt: Date.now() + EDIT_WINDOW_MS
  });
}

function takePendingEdit(userId, channelId) {
  const key = keyFor(userId, channelId);
  const pending = pendingEdits.get(key);
  if (!pending) return null;

  pendingEdits.delete(key);
  return pending.expiresAt > Date.now() ? pending : null;
}

module.exports = {
  EDIT_WINDOW_MS,
  setPendingEdit,
  takePendingEdit
};
