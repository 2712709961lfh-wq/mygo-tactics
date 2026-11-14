/* ============================================================
 * rng.js — 可存档的确定性随机数生成器（xorshift32）
 * 将 RNG 状态写入存档，读档后战斗随机结果可复现。
 * ============================================================ */
(function (global) {
  'use strict';
  const MyGO = (global.MyGO = global.MyGO || {});

  class RNG {
    constructor(seed) {
      let s = Number(seed);
      if (!Number.isFinite(s)) s = Date.now();
      s >>>= 0;
      this.state = s === 0 ? 0x9e3779b9 : s;
    }

    /** 返回 [0, 1) 的浮点数。 */
    next() {
      let x = this.state >>> 0;
      x ^= x << 13;
      x >>>= 0;
      x ^= x >>> 17;
      x ^= x << 5;
      x >>>= 0;
      this.state = x || 0x9e3779b9;
      return this.state / 0x100000000;
    }

    /** 返回闭区间 [min, max] 的整数。 */
    int(min, max) {
      return Math.floor(this.next() * (max - min + 1)) + min;
    }

    serialize() {
      return this.state >>> 0;
    }

    static restore(state) {
      const rng = new RNG(1);
      const value = Number(state) >>> 0;
      rng.state = value === 0 ? 0x9e3779b9 : value;
      return rng;
    }
  }

  MyGO.RNG = RNG;
})(window);
