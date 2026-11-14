/* Read-only combined reference; equipment and learned-spell rules stay in their own modules. */
(function(global){
  'use strict';
  const M=global.MyGO,E=M.Equipment,Magic=M.Magic;
  const categories=Object.freeze([...E.categories,...[
    ['magic','魔法','MAGIC'],['black','黑魔法','BLACK MAGIC'],['dark','暗魔法','DARK MAGIC'],['faith','白魔法','WHITE MAGIC']
  ].map(([id,name,en])=>Object.freeze({id,name,en}))]);
  const spells=Magic.items.map(s=>Object.freeze({...s,category:s.school,edition:'base',rarity:'spell',
    icon:'spell_'+s.id,range:s.rangeText.replace('mag/','魔力/'),
    tags:Object.freeze([Magic.schoolName(s),s.support?'辅助魔法':'攻击魔法',...s.effectiveAgainst.map(t=>({flying:'飞行特效',cavalry:'骑马特效',monster:'魔兽特效'}[t]))]),
    effect:s.description+(s.effect==='torch'?' 当前两章全图可见，不开放照明行动。':''),verifiedAt:'2026-11-12'}));
  const items=Object.freeze([...E.items,...spells]);
  const matchesCategory=(item,id)=>!id||id==='all'||(id==='magic'?item.kind==='spell':item.category===id);
  function query(options={}){
    const o=options,q=(o.search||'').trim().toLowerCase(),rank={E:0,D:1,C:2,B:3,A:4,S:5};
    return items.filter(i=>matchesCategory(i,o.category)&&(!o.edition||o.edition==='all'||i.edition===o.edition)&&
      (!o.rank||o.rank==='all'||i.rank===o.rank)&&(o.special!=='relic'||i.rarity==='relic')&&
      (o.special!=='magic'||i.kind==='weapon'&&i.damageType==='magic')&&
      (o.special!=='attack'||i.kind==='spell'&&!i.support)&&(o.special!=='support'||i.kind==='spell'&&i.support)&&
      (o.special!=='effective'||i.tags.some(t=>t.includes('特效')))&&
      (!q||[i.name,i.en,i.effect,...i.tags].join(' ').toLowerCase().includes(q.replace(/\+/g,'＋'))||i.en.toLowerCase().includes(q)))
      .sort((a,b)=>o.sort==='might'?(b.might??-1)-(a.might??-1):o.sort==='weight'?a.weight-b.weight:o.sort==='rank'?(rank[a.rank]??6)-(rank[b.rank]??6):0);
  }
  M.Codex=Object.freeze({categories,items,query,matchesCategory,get:id=>items.find(i=>i.id===id),family:E.family,verifiedAt:E.verifiedAt});
})(window);
