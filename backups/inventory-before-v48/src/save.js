/* ============================================================
 * save.js — localStorage 存档读写
 * 存档只包含会变化的状态；角色与地图模板由 config.js 重建。
 * 在 file:// 环境下若浏览器禁用 localStorage，会降级到内存存储，
 * 页面刷新后消失，但本局内仍可读档。
 * ============================================================ */
(function (global) {
  'use strict';
  const MyGO = (global.MyGO = global.MyGO || {});
  const C = MyGO.CONFIG;

  let memoryStore = null;
  let storageAvailable = null;

  function canUseStorage() {
    if (storageAvailable !== null) return storageAvailable;
    try {
      const testKey = '__mygo_storage_test__';
      global.localStorage.setItem(testKey, '1');
      global.localStorage.removeItem(testKey);
      storageAvailable = true;
    } catch (err) {
      storageAvailable = false;
    }
    return storageAvailable;
  }

  function readRaw() {
    if (canUseStorage()) {
      try {
        return global.localStorage.getItem(C.SAVE_KEY);
      } catch (err) {
        return null;
      }
    }
    return memoryStore;
  }

  function writeRaw(value) {
    if (canUseStorage()) {
      try {
        global.localStorage.setItem(C.SAVE_KEY, value);
        return true;
      } catch (err) {
        return false;
      }
    }
    memoryStore = value;
    return true;
  }

  function removeRaw() {
    if (canUseStorage()) {
      try {
        global.localStorage.removeItem(C.SAVE_KEY);
      } catch (err) {
        /* noop */
      }
    } else {
      memoryStore = null;
    }
  }

  class SaveManager {
    /** 写入快照。返回 {ok, message, savedAt}。 */
    save(game) {
      try {
        const payload = {
          version: C.SAVE_VERSION,
          savedAt: new Date().toISOString(),
          snapshot: game.serialize()
        };
        const raw = JSON.stringify(payload);
        if (!writeRaw(raw)) throw new Error('浏览器拒绝写入本地存储');
        return {
          ok: true,
          message: '存档成功',
          savedAt: payload.savedAt
        };
      } catch (err) {
        return { ok: false, message: '存档失败：' + err.message };
      }
    }

    /** 读取快照。返回 {ok, snapshot, savedAt, message}。 */
    load() {
      try {
        const raw = readRaw();
        if (!raw) return { ok: false, message: '没有找到存档' };
        const payload = JSON.parse(raw);
        if (!payload || payload.version !== C.SAVE_VERSION) {
          return { ok: false, message: '存档版本不兼容' };
        }
        if (!payload.snapshot) return { ok: false, message: '存档内容损坏' };
        return {
          ok: true,
          snapshot: payload.snapshot,
          savedAt: payload.savedAt,
          message: '读档成功'
        };
      } catch (err) {
        return { ok: false, message: '读取存档失败：' + err.message };
      }
    }

    hasSave() {
      return !!readRaw();
    }

    delete() {
      removeRaw();
    }

    get storageType() {
      return canUseStorage() ? 'localStorage' : 'memory';
    }
  }

  MyGO.SaveManager = SaveManager;
})(window);
