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

  const memoryStore = new Map();
  const manualKey = C.SAVE_KEY;
  const checkpointKey = manualKey + ':checkpoint';
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

  function readRaw(key) {
    if (canUseStorage()) {
      try {
        return global.localStorage.getItem(key);
      } catch (err) {
        return null;
      }
    }
    return memoryStore.get(key) || null;
  }

  function writeRaw(key, value) {
    if (canUseStorage()) {
      try {
        global.localStorage.setItem(key, value);
        return true;
      } catch (err) {
        return false;
      }
    }
    memoryStore.set(key,value);
    return true;
  }

  function removeRaw(key) {
    if (canUseStorage()) {
      try {
        global.localStorage.removeItem(key);
      } catch (err) {
        return false;
      }
    } else {
      memoryStore.delete(key);
    }
    return true;
  }

  function validateSnapshot(snapshot) {
    const campaign=new MyGO.Game();
    campaign.restore(snapshot);
    if(snapshot.training)MyGO.Training.Game.fromSnapshot(campaign,snapshot.training);
  }

  function readSlot(key,slot){
    try {
      const raw=readRaw(key);
      if(!raw)return {ok:false,message:'没有找到存档'};
      const payload=JSON.parse(raw);
      if(!payload||payload.version!==C.SAVE_VERSION)return {ok:false,message:'存档版本不兼容'};
      if(!payload.snapshot)return {ok:false,message:'存档内容损坏'};
      validateSnapshot(payload.snapshot);
      return {ok:true,snapshot:payload.snapshot,savedAt:payload.savedAt,slot,message:'读档成功'};
    }catch(err){
      return {ok:false,message:'读取存档失败：'+err.message};
    }
  }

  class SaveManager {
    /** 写入快照。返回 {ok, message, savedAt}。 */
    save(game, options) {
      try {
        const payload = {
          version: C.SAVE_VERSION,
          savedAt: new Date().toISOString(),
          snapshot: game.serialize()
        };
        // Validate the complete written snapshot before replacing either slot.
        validateSnapshot(payload.snapshot);
        const raw = JSON.stringify(payload);
        const key=options?.automatic?checkpointKey:manualKey;
        const previous=readSlot(key,options?.automatic?'automatic':'manual');
        if(previous.ok&&!writeRaw(key+':backup',readRaw(key)))throw new Error('浏览器拒绝写入存档备份');
        if (!writeRaw(key,raw)) throw new Error('浏览器拒绝写入本地存储');
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
    load(slot) {
      if(slot==='backup'){
        const backups=[readSlot(manualKey+':backup','backup'),readSlot(checkpointKey+':backup','backup')];
        return backups.filter(s=>s.ok).sort((a,b)=>String(b.savedAt).localeCompare(String(a.savedAt)))[0]||
          {ok:false,message:'没有可读取的完整备份'};
      }
      const manual=readSlot(manualKey,'manual');
      if(slot==='manual')return manual;
      const checkpoint=readSlot(checkpointKey,'automatic');
      if(slot==='automatic')return checkpoint;
      const latest=[manual,checkpoint].filter(s=>s.ok).sort((a,b)=>String(b.savedAt).localeCompare(String(a.savedAt)))[0];
      if(latest){
        if((!manual.ok&&readRaw(manualKey))||(!checkpoint.ok&&readRaw(checkpointKey))){
          latest.recoveryMessage='部分存档损坏，已选用完整的'+(latest.slot==='manual'?'手动':'自动')+'存档';
        }
        return latest;
      }
      const backup=this.load('backup');
      if(backup.ok)return {...backup,recoveryMessage:'当前存档损坏，已选用完整备份'};
      return readRaw(manualKey)?manual:checkpoint;
    }

    hasSave() {
      return !!(readRaw(manualKey)||readRaw(checkpointKey)||readRaw(manualKey+':backup')||readRaw(checkpointKey+':backup'));
    }

    delete() {
      const results=[manualKey,checkpointKey,manualKey+':backup',checkpointKey+':backup'].map(removeRaw);
      return {ok:results.every(Boolean)};
    }

    get storageType() {
      return canUseStorage() ? 'localStorage' : 'memory';
    }
  }

  MyGO.SaveManager = SaveManager;
})(window);
