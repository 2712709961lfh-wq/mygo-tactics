/* Searchable, read-only equipment reference. No inventory or battle-state writes. */
(function (global) {
  'use strict';
  const MyGO=global.MyGO=global.MyGO||{};
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const rarityNames={regular:'常规装备',forged:'锻造强化',sacred:'神圣装备',relic:'英雄遗产'};
  const statLabels={might:'威力',hit:'命中',crit:'必杀',weight:'重量',uses:'耐久',range:'射程',protection:'物防',resilience:'魔防'};
  class EquipmentCodex {
    constructor(entry) {
      this.entry=entry;
      this.root=document.getElementById('equipment-screen');
      this.filters={category:'all',search:'',edition:'base',rank:'all',special:'all',sort:'catalogue'};
      this.selectedId='iron_sword';
      this.returnFocus=null;
      this.root.innerHTML=`<div class="eq-book">
        <header class="eq-header"><div><div class="eq-kicker">FIELD NOTES / THE ARMOURY</div><h2 id="eq-heading">器物图鉴 <span>行路之备</span></h2></div>
          <div class="eq-summary"><b>${MyGO.Equipment.items.length}</b><span>件藏品<br>THREE HOUSES</span></div>
          <button type="button" class="eq-close" data-eq-close>返回 <span>ESC</span></button></header>
        <div class="eq-layout"><aside class="eq-sidebar"><div class="eq-nav-title">藏品分类 <span>COLLECTION</span></div><nav class="eq-categories" aria-label="装备分类"></nav>
          <div class="eq-side-note"><span>旅途备忘</span><p>武器决定攻击。<br>盾牌、戒指与法杖<br>提供辅助效果。</p><small>法术属于角色习得能力，<br>与可装备的法杖分开。</small></div></aside>
        <section class="eq-catalogue" aria-label="装备列表"><div class="eq-tools">
          <label class="eq-search"><span>查找藏品</span><input id="eq-search" type="search" placeholder="名称 / English / 特效" autocomplete="off"></label>
          <label><span>版本</span><select data-eq-filter="edition" aria-label="装备版本"><option value="base">普通版</option><option value="all">全部版本</option><option value="forged">强化版＋</option></select></label>
          <label><span>排序</span><select data-eq-filter="sort" aria-label="装备排序"><option value="catalogue">图鉴顺序</option><option value="might">威力从高到低</option><option value="weight">重量从低到高</option><option value="rank">等级从低到高</option></select></label>
          <label><span>等级</span><select data-eq-filter="rank" aria-label="武器等级"><option value="all">全部</option>${['E','D','C','B','A'].map(r=>`<option>${r}</option>`).join('')}</select></label>
          <label><span>特性</span><select data-eq-filter="special" aria-label="装备特性"><option value="all">全部特性</option><option value="magic">魔法武器</option><option value="effective">兵种特效</option><option value="relic">英雄遗产</option></select></label></div>
          <div class="eq-list-heading"><span id="eq-result-count" role="status" aria-live="polite"></span><button type="button" data-eq-reset>重置筛选</button></div>
          <div class="eq-grid" id="eq-grid"></div>
        </section><article class="eq-detail" id="eq-detail" aria-label="装备详情"></article></div>
        <footer class="eq-footer"><span>数值参考《火焰纹章 风花雪月》 · 图标为 CC0 通用示意图</span><span>图鉴预览 · 尚未开放换装</span></footer>
      </div>`;
      this.root.addEventListener('click',event=>{
        const target=event.target.closest('button');if(!target)return;
        if(target.hasAttribute('data-eq-close'))return this.close();
        if(target.hasAttribute('data-eq-reset'))return this.reset();
        if(target.dataset.eqCategory){this.filters.category=target.dataset.eqCategory;this.refresh(true);}
        if(target.dataset.eqItem)this.select(target.dataset.eqItem);
        if(target.dataset.eqVersion){this.selectedId=target.dataset.eqVersion;const next=MyGO.Equipment.get(this.selectedId);if(this.filters.edition!=='all'&&this.filters.edition!==next.edition){this.filters.edition='all';this.syncFilters();}this.refresh(false);}
      });
      this.root.querySelector('#eq-search').addEventListener('input',event=>{this.filters.search=event.target.value;this.refresh(true);});
      this.root.addEventListener('change',event=>{const key=event.target.dataset.eqFilter;if(key){this.filters[key]=event.target.value;this.refresh(true);}});
      this.root.addEventListener('keydown',event=>this.onKeyDown(event));
      this.refresh(false);
    }
    image(item) {return global.MYGO_EQUIPMENT_ICONS?.[item.icon]||'assets/equipment/icons/'+item.icon+'.png';}
    open() {
      this.returnFocus=document.activeElement;
      this.root.hidden=false;
      this.refresh(false);
      this.root.querySelector('[data-eq-close]').focus();
    }
    close() {
      this.root.hidden=true;
      if(this.returnFocus?.isConnected)this.returnFocus.focus();
    }
    syncFilters() {
      this.root.querySelector('#eq-search').value=this.filters.search;
      this.root.querySelectorAll('[data-eq-filter]').forEach(el=>{el.value=this.filters[el.dataset.eqFilter];});
    }
    reset() {this.filters={category:'all',search:'',edition:'base',rank:'all',special:'all',sort:'catalogue'};this.selectedId='iron_sword';this.syncFilters();this.refresh(true);}
    refresh(resetScroll) {
      const active=document.activeElement;
      const focusCategory=active?.dataset.eqCategory;
      const focusVersion=active?.dataset.eqVersion;
      const E=MyGO.Equipment,results=E.query(this.filters);
      if(!results.some(item=>item.id===this.selectedId))this.selectedId=results[0]?.id||null;
      this.root.querySelector('.eq-categories').innerHTML=E.categories.map(c=>`<button type="button" data-eq-category="${c.id}" aria-pressed="${this.filters.category===c.id}"><span>${esc(c.name)}<small>${c.en}</small></span><b>${E.items.filter(item=>(c.id==='all'||item.category===c.id)&&item.edition==='base').length}</b></button>`).join('');
      this.root.querySelector('#eq-result-count').textContent=`${E.categories.find(c=>c.id===this.filters.category).name} · ${results.length} 件${this.filters.edition==='forged'?'强化藏品':''}`;
      const grid=this.root.querySelector('#eq-grid');
      grid.innerHTML=results.length?results.map(item=>`<button type="button" class="eq-card ${item.rarity==='relic'?'is-relic':''}" data-eq-item="${item.id}" aria-pressed="${item.id===this.selectedId}" aria-label="${esc(item.name)} ${esc(item.en)}"><span class="eq-card-no">${String(E.items.indexOf(item)+1).padStart(3,'0')}</span><span class="eq-card-rank">${item.rank||'饰'}</span><img src="${this.image(item)}" alt="" draggable="false"><strong>${esc(item.name)}</strong><small>${esc(item.en)}</small><span class="eq-card-stats">${item.kind==='weapon'?`威力 <b>${item.might}</b><i>·</i>重量 <b>${item.weight}</b>`:`物防 <b>${item.protection}</b><i>·</i>魔防 <b>${item.resilience}</b>`}</span>${item.edition==='forged'?'<em class="eq-forged-mark">＋</em>':''}</button>`).join(''):`<div class="eq-empty"><span>此页尚无记录</span><p>换个名称，或重置筛选后再看看。</p><button type="button" data-eq-reset>重置筛选</button></div>`;
      if(resetScroll)grid.scrollTop=0;
      this.renderDetail();
      if(focusCategory)this.root.querySelector('[data-eq-category="'+focusCategory+'"]')?.focus();
      if(focusVersion)this.root.querySelector('[data-eq-version="'+this.selectedId+'"]')?.focus();
    }
    select(id) {
      this.selectedId=id;
      this.root.querySelectorAll('[data-eq-item]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.eqItem===id)));
      this.renderDetail();
    }
    renderDetail() {
      const E=MyGO.Equipment,item=E.get(this.selectedId),detail=this.root.querySelector('#eq-detail');
      if(!item){detail.innerHTML='<div class="eq-detail-empty">等待翻开下一页</div>';return;}
      const family=E.family(item.familyId),base=family[0],category=E.categories.find(c=>c.id===item.category);
      const fields=item.kind==='weapon'?['might','hit','crit','weight','uses','range']:['protection','resilience','weight'];
      const delta=key=>{if(item.edition!=='forged')return '';if(key==='range'&&item.range!==base.range)return `<small class="eq-delta">原${esc(base.range)}</small>`;if(typeof item[key]!=='number')return '';const value=item[key]-base[key];return value?`<small class="eq-delta ${key==='weight'&&value<0?'good':''}">${value>0?'+':''}${value}</small>`:'';};
      detail.innerHTML=`<div class="eq-detail-scroll"><div class="eq-detail-overline"><span>${category.en} / ${item.kind==='weapon'?'WEAPON':'EQUIPMENT'}</span><b>${rarityNames[item.rarity]}</b></div>
        <div class="eq-art ${item.rarity==='relic'?'is-relic':''}"><span class="eq-art-watermark">${esc(category.name)}</span><img src="${this.image(item)}" alt="${esc(item.name)}装备示意图" draggable="false"><span class="eq-art-label">PLATE ${String(E.items.indexOf(item)+1).padStart(3,'0')}</span></div>
        <div class="eq-detail-title"><div><h3>${esc(item.name)}</h3><p>${esc(item.en)}</p></div>${item.rank?`<span class="eq-rank">等级 <b>${item.rank}</b></span>`:'<span class="eq-rank">辅助<br>装备</span>'}</div>
        <div class="eq-tags">${item.tags.map(t=>`<span>${esc(t)}</span>`).join('')}<span>${item.kind==='equipment'?'装备栏':item.damageType==='magic'?'魔法伤害':'物理伤害'}</span></div>
        ${family.length>1?`<div class="eq-versions" aria-label="普通与强化版本">${family.map(v=>`<button type="button" data-eq-version="${v.id}" aria-pressed="${item.id===v.id}">${v.edition==='base'?'普通版':'强化版＋'}</button>`).join('')}<span>标注变化值</span></div>`:''}
        <dl class="eq-stats">${fields.map(key=>`<div><dt>${statLabels[key]}</dt><dd>${esc(item[key])}${delta(key)}</dd></div>`).join('')}</dl>
        <div class="eq-effect"><h4>装备特性 <span>PROPERTIES</span></h4><p>${esc(item.effect)}</p></div>
        <div class="eq-equipping"><b>${item.kind==='weapon'?'武器栏':'辅助装备栏'}</b><span>${item.kind==='weapon'?'使用要求：'+item.rank+' 级'+category.name+'术。耐久为完整状态的最大次数。':'盾牌、戒指、法杖等属于辅助装备，原作中同一时间装备一件。'}</span></div>
        <div class="eq-source">数值核对 ${E.verifiedAt} · <a href="${item.source}" target="_blank" rel="noopener noreferrer">查看原作来源 ↗</a><small>中文为图鉴译名；插图为通用素材示意。</small></div></div>`;
      detail.scrollTop=0;
    }
    onKeyDown(event) {
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();this.close();return;}
      if(event.key==='Tab'){
        const focusable=Array.from(this.root.querySelectorAll('button,input,select,a[href]')).filter(el=>!el.disabled&&el.getClientRects().length);
        const first=focusable[0],last=focusable[focusable.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
      }
      event.stopPropagation();
    }
  }
  MyGO.EquipmentCodex=EquipmentCodex;
})(window);
