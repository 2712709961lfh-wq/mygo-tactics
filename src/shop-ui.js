/* The traveling market shares the catalogue's parchment, leather and item art. */
(function(global){
  'use strict';
  const M=global.MyGO,I=M.Inventory;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const art=e=>global.MYGO_EQUIPMENT_ICONS?.[e.icon]||'assets/equipment/icons/'+e.icon+'.png';
  class ShopScreen{
    constructor(entry){
      this.entry=entry;this.category='all';this.mode='buy';
      this.root=document.createElement('section');this.root.id='shop-screen';this.root.className='equipment-screen shop-screen';this.root.hidden=true;
      this.root.setAttribute('role','dialog');this.root.setAttribute('aria-modal','true');this.root.setAttribute('aria-label','行旅商店');
      document.getElementById('game-shell').appendChild(this.root);
      this.root.addEventListener('click',event=>{
        const b=event.target.closest('button');if(!b)return;
        if(b.hasAttribute('data-shop-close'))return this.close();
        if(b.dataset.shopMode){this.mode=b.dataset.shopMode;this.message='';return this.render();}
        if(b.dataset.shopCategory){this.category=b.dataset.shopCategory;return this.render();}
        try{
          const g=this.entry.ui.game;
          if(b.dataset.shopBuy){
            const id=b.dataset.shopBuy,quantity=Number(this.root.querySelector('[data-quantity="'+id+'"]').value);
            const r=g.buyItem(id,quantity);this.message='已购买 '+I.item(id).name+' ×'+r.quantity+'，花费 '+r.cost+' G，物品已送入运输队。';
          }else if(b.hasAttribute('data-shop-sell')){
            const index=+b.dataset.shopSell,e=I.item(g.convoy[index].id),price=g.sellItem(index);
            this.message='已出售 '+e.name+'，获得 '+price+' G。';
          }else return;
          this.render();this.entry.ui.updateAll();
        }catch(error){this.message=error.message;this.render();}
      });
      this.root.addEventListener('keydown',event=>{
        event.stopPropagation();if(event.key==='Escape'){event.preventDefault();this.close();}
        if(event.key==='Tab'){
          const nodes=[...this.root.querySelectorAll('button,input')].filter(e=>!e.disabled&&e.getClientRects().length),first=nodes[0],last=nodes.at(-1);
          if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
          else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
        }
      });
    }
    open(){
      const ui=this.entry.ui,reason=ui.busy?'正在结算战斗':ui.mode!=='idle'?'请先完成或取消当前行动':ui.game.shopReason();
      if(reason){ui.showToast(reason,'info',2200);return;}
      this.previousFocus=document.activeElement;this.message='';this.root.hidden=false;this.render();this.root.querySelector('[data-shop-close]').focus();
    }
    close(){this.root.hidden=true;if(this.previousFocus?.isConnected)this.previousFocus.focus();}
    render(){
      const g=this.entry.ui.game,categories=[['all','全部商品'],['weapon','武器'],['medicine','药品'],['seal','转职证'],['equipment','辅助装备']];
      const matches=e=>this.category==='all'||e.kind===this.category||e.category===this.category;
      const stock=M.Shop.stock(g),rows=this.mode==='buy'?stock.filter(p=>matches(p.item)):g.convoy.map((slot,index)=>({slot,index,item:I.item(slot.id)})).filter(p=>matches(p.item));
      this.root.innerHTML='<div class="eq-book"><header class="eq-header"><div><div class="eq-kicker">TRAVELING MARKET / PROVISIONS</div><h2>行旅商店 <span>旅途补给</span></h2></div><div class="eq-summary"><b>'+g.gold.toLocaleString()+'</b><span>G · 共享资金<br>第 '+(g.chapterNumber||g.stage)+' 章</span></div><button class="eq-close" data-shop-close>返回 <span>ESC</span></button></header><div class="shop-layout"><aside class="eq-sidebar"><div class="eq-nav-title">货架分类 <span>MARKET</span></div><nav class="eq-categories">'+categories.map(([id,name])=>'<button data-shop-category="'+id+'" aria-pressed="'+(id===this.category)+'">'+name+'</button>').join('')+'</nav><div class="eq-side-note"><span>旅途备忘</span><p>购买送入运输队。<br>每章补充限购库存。<br>章节胜利获得 2,000 G。</p><small>在「同行之人 → 背包」领取。<br>保存游戏以保留交易。</small></div></aside><section class="shop-catalogue"><div class="shop-toolbar"><div class="eq-versions"><button data-shop-mode="buy" aria-pressed="'+(this.mode==='buy')+'">购买</button><button data-shop-mode="sell" aria-pressed="'+(this.mode==='sell')+'">出售运输队物品</button></div><span>运输队 '+g.convoy.length+' / 500'+(g.lootReserve?.length?' · 战利品暂存 '+g.lootReserve.length+' 件，腾位后自动领取':'')+'</span></div><p class="shop-message" role="status" aria-live="polite">'+esc(this.message||'第一章：铁制与训练武器；第二章：钢制；第三章：银制与必杀；第四章：魔法与特殊武器。未解锁商品会标明开放章节。')+'</p><div class="shop-list">'+rows.map(p=>{
        const e=p.item;
        if(this.mode==='sell'){
          const product=M.Shop.get(e.id),price=product?Math.floor(product.price/2*(e.uses===null?1:p.slot.uses/e.uses)):0;
          return '<article class="shop-row"><img src="'+art(e)+'" alt=""><div class="shop-copy"><h3>'+esc(e.name)+'</h3><p>'+esc(e.effect)+'</p><small>'+(e.uses===null?'辅助装备':'剩余 '+p.slot.uses+' / '+e.uses)+' · 售价按剩余次数折算</small></div><strong>'+price+' G</strong><button data-shop-sell="'+p.index+'"'+(!price?' disabled':'')+'>出售</button></article>';
        }
        const disabled=p.locked||p.remaining===0||g.gold<p.price||g.convoy.length>=500;
        return '<article class="shop-row'+(p.locked?' is-locked':'')+'"><img src="'+art(e)+'" alt=""><div class="shop-copy"><h3>'+esc(e.name)+' <small>'+esc(e.en)+'</small></h3><p>'+esc(e.effect)+'</p><small>'+(p.locked?'第 '+p.stage+' 章开放':p.remaining===null?'不限量':'本章剩余 '+p.remaining+' 件')+(e.uses===null?'':' · 每件 '+e.uses+' 次')+'</small></div><strong>'+p.price+' G</strong><label class="shop-quantity">数量<input aria-label="'+esc(e.name)+'购买数量" data-quantity="'+e.id+'" type="number" min="1" max="'+Math.max(1,Math.min(99,p.remaining??99,Math.floor(g.gold/p.price),500-g.convoy.length))+'" step="1" value="1"'+(disabled?' disabled':'')+'></label><button data-shop-buy="'+e.id+'"'+(disabled?' disabled':'')+'>'+(p.locked?'未解锁':p.remaining===0?'已售罄':g.gold<p.price?'资金不足':'购买')+'</button></article>';
      }).join('')+(rows.length?'':'<p class="loadout-empty">此分类暂无物品。</p>')+'</div></section></div><footer class="eq-footer"><span>商品分阶段开放 · 原作机制参照，本作四章进度安排</span><span>限购、金币、转职与学法术均随存档保留</span></footer></div>';
    }
  }
  M.ShopScreen=ShopScreen;
  const EP=M.EntryScreen.prototype,bind=EP.bind,onKeyDown=EP.onKeyDown;
  EP.bind=function(){
    bind.call(this);this.shop=new ShopScreen(this);
    const menu=document.querySelector('.entry-menu');
    if(menu){const b=document.createElement('button');b.type='button';b.className='entry-option';b.dataset.entryAction='shop';
      b.innerHTML='<span class="entry-index">G</span><span class="entry-option-copy"><strong>行旅商店</strong><em>TRAVELING MARKET</em><small>购入武器、药品与转职证</small></span><span class="entry-arrow">→</span>';
      b.onclick=()=>this.shop.open();menu.insertBefore(b,menu.querySelector('[data-entry-action="equipment"]'));
      menu.querySelectorAll('.entry-index').forEach((index,n)=>index.textContent=String(n+1).padStart(2,'0'));}
    const equipment=document.getElementById('equipment-btn');
    if(equipment){const b=document.createElement('button');b.type='button';b.id='shop-btn';b.className='icon-btn';b.textContent='商店';b.onclick=()=>{
      if(this.ui.chapterOpen||!this.ui.dom.overlayRoot.hidden){this.ui.showToast('请先关闭当前弹窗。','info',1800);return;}this.shop.open();
    };equipment.after(b);}
  };
  EP.onKeyDown=function(event){if(this.shop&&!this.shop.root.hidden){
    if(event.key==='Escape'){this.shop.close();event.preventDefault();event.stopPropagation();}
    return;
  }return onKeyDown.call(this,event);};
  const UP=M.UI.prototype,action=UP.renderActionSide;
  UP.renderActionSide=function(u){action.call(this,u);
    if(!u.inventory.some(i=>I.item(i.id).kind==='consumable'))return;
    const button=document.createElement('button');button.type='button';button.className='action-btn';button.textContent='使用药品';button.onclick=()=>this.showMedicine(u);this.dom.actionButtons.appendChild(button);
  };
  UP.showMedicine=function(u){
    if(this.busy||u.acted||!this.game.isPlayerPhase())return;
    this.openActionPicker('<div class="modal-kicker">MEDICINE</div><h2 class="modal-title" id="overlay-title">'+esc(u.name)+' · 使用药品</h2><p class="modal-sub">HP '+u.hp+' / '+u.maxHp+' · 使用药品后结束行动。</p><div class="battle-loadout-list">'+u.inventory.map((slot,n)=>{
      const e=I.item(slot.id);if(e.kind!=='consumable')return '';const reason=this.game.medicineReason(u,n);
      return '<button class="battle-loadout-row" data-battle-medicine="'+n+'"'+(reason?' disabled':'')+'><img class="medicine-icon" src="'+art(e)+'" alt=""><span><strong>'+esc(e.name)+'</strong><small>'+esc(reason||e.effect)+'</small></span><b>'+slot.uses+' / '+e.uses+'</b></button>';
    }).join('')+'</div><div class="modal-actions"><button class="modal-btn" data-medicine-cancel>返回行动</button></div>');
    this.actionPickerCard.querySelector('[data-medicine-cancel]').onclick=()=>{this.closeActionPicker();this.enterActionMode();};
    this.actionPickerCard.querySelectorAll('[data-battle-medicine]').forEach(b=>b.onclick=()=>{
      try{const r=this.game.useMedicine(u,+b.dataset.battleMedicine);this.closeActionPicker();this.resetSelection({silent:true});this.updateAll();this.renderer.floatText(r.healed?'+'+r.healed:r.item.name,u.x,u.y,'#bcebd7',11);this.showToast(u.name+'使用了'+r.item.name,'success',2200);}catch(e){this.showToast(e.message,'error');}
    });
  };
})(window);
