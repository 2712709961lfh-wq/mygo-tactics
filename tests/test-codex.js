'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const window={},document={activeElement:null};
for(const name of ['equipment-data','magic-data','codex-data','equipment-ui'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src',name+'.js'),'utf8'),{window,document});
const M=window.MyGO,D=M.Codex;let count=0;
function test(name,fn){fn();count++;console.log('✓ '+name);}
function fixture(filters={}){const nodes=Object.fromEntries(['.eq-categories','#eq-result-count','#eq-grid','#eq-detail'].map(s=>[s,{innerHTML:'',textContent:'',scrollTop:0}]));const ui=Object.create(M.EquipmentCodex.prototype);ui.root={querySelector:s=>nodes[s]};ui.filters={category:'all',edition:'base',...filters};ui.selectedId='fire';return{ui,nodes};}
test('统一图鉴收录130件器物和36种魔法，ID唯一',()=>{assert.equal(D.items.length,166);assert.equal(new Set(D.items.map(i=>i.id)).size,166);assert.equal(D.query({edition:'base'}).length,123);assert.equal(M.Equipment.items.length,130);});
test('魔法总类和三个学派准确分类，不混入法杖',()=>{for(const [category,n] of [['magic',36],['black',14],['dark',8],['faith',14]])assert.equal(D.query({category,edition:'base'}).length,n);assert(D.query({category:'staff'}).every(i=>i.kind==='equipment'));});
test('中英文和效果搜索能查询尚未学会的魔法',()=>{assert.equal(D.query({search:'Fire'})[0].id,'fire');assert.equal(D.query({search:'圣疗'}).length,3);assert.equal(D.query({search:'ThOrOn'})[0].id,'thoron');assert(D.query({search:'无视魔防'}).some(i=>i.id==='luna'));assert.equal(D.query({search:'不存在'}).length,0);});
test('攻击辅助和等级组合筛选正确，强化版不伪造魔法',()=>{assert(D.query({category:'faith',special:'support'}).every(i=>i.support));assert(D.query({category:'magic',special:'attack'}).every(i=>!i.support));assert.equal(D.query({category:'black',rank:'A'}).length,1);assert.equal(D.query({category:'magic',edition:'forged'}).length,0);assert(D.query({special:'magic'}).every(i=>i.kind==='weapon'));});
test('魔法排序不改变源数据，查询数据不可修改',()=>{const before=D.items.map(i=>i.id).join(',');assert.equal(D.query({category:'magic',sort:'might'})[0].id,'recover');assert.equal(D.query({category:'magic',special:'attack',sort:'might'})[0].id,'hades');assert.equal(D.items.map(i=>i.id).join(','),before);assert.throws(()=>D.get('fire').tags.push('test'),{name:'TypeError'});assert.equal(M.Magic.get('physic').rangeText,'mag/2');});
test('图鉴复用真实魔法数值并为每个法术配置独立图标',()=>{for(const s of M.Magic.items){const i=D.get(s.id);for(const key of ['might','hit','crit','weight','uses','rank','source'])assert.equal(i[key],s[key]);assert(fs.existsSync(path.join(__dirname,'../assets/equipment/icons',i.icon+'.png')));}});
test('全部166条记录图标路径、文件内容和解码像素均不重复，素材可追溯',()=>{
  const crypto=require('node:crypto'),root=path.join(__dirname,'..');
  const icons=JSON.parse(fs.readFileSync(path.join(root,'assets/equipment/icon-manifest.json'),'utf8'));
  const assignments=JSON.parse(fs.readFileSync(path.join(root,'assets/equipment/icon-assignments.json'),'utf8'));
  const sources=JSON.parse(fs.readFileSync(path.join(root,'assets/equipment/manifest.json'),'utf8'));
  const hashes=[],pixels=[],sourceIds=[];
  assert.equal(icons.length,D.items.length);assert.equal(Object.keys(assignments).length,D.items.length);
  assert.equal(new Set(D.items.map(i=>i.icon)).size,D.items.length);
  for(const i of D.items){
    const record=icons.find(r=>r.icon===i.icon);assert(record,i.id);
    assert(sources.some(s=>s.id===record.sourceId&&s.license==='CC0-1.0'),i.id);
    const bytes=fs.readFileSync(path.join(root,'assets/equipment/icons',i.icon+'.png'));
    const hash=crypto.createHash('sha256').update(bytes).digest('hex');
    assert.equal(hash,record.sha256,i.id);hashes.push(hash);pixels.push(record.pixelSha256);sourceIds.push(record.sourceId);
    assert.equal(record.width,256);assert.equal(record.height,256);
  }
  assert.equal(new Set(hashes).size,D.items.length);assert.equal(new Set(pixels).size,D.items.length);
  assert.equal(new Set(sourceIds).size,D.items.length);
});
test('火焰详情显示全部数值、每章次数和习得限制',()=>{const {ui,nodes}=fixture();ui.renderDetail();const html=nodes['#eq-detail'].innerHTML;for(const text of ['火焰','Fire','威力','命中','必杀','重量','每章次数','射程','角色只可施放已学魔法','下一章恢复','魔法效果'])assert(html.includes(text),text);assert(!html.includes('武器栏'));assert(!html.includes('data-eq-version'));});
test('辅助魔法详情正确标识效果与动态射程',()=>{const {ui,nodes}=fixture();ui.selectedId='physic';ui.renderDetail();const html=nodes['#eq-detail'].innerHTML;for(const text of ['远程圣疗','辅助效果','魔力/2','向下取整','治疗量','2026-11-12'])assert(html.includes(text),text);assert(!html.includes('魔法伤害'));});
test('魔法列表、学派计数与空结果正常渲染',()=>{const {ui,nodes}=fixture({category:'magic'});ui.refresh(true);assert(nodes['#eq-result-count'].textContent.includes('36 条记录'));assert.equal((nodes['#eq-grid'].innerHTML.match(/data-eq-item=/g)||[]).length,36);assert(nodes['.eq-categories'].innerHTML.includes('data-eq-category="faith"'));ui.filters.search='不存在';ui.refresh(true);assert(nodes['#eq-grid'].innerHTML.includes('此页尚无记录'));assert(nodes['#eq-detail'].innerHTML.includes('等待翻开下一页'));});
test('普通器物详情保留强化版本、耐久和装备特性',()=>{const {ui,nodes}=fixture();ui.selectedId='iron_sword';ui.renderDetail();const html=nodes['#eq-detail'].innerHTML;for(const text of ['铁剑','耐久','武器栏','装备特性','data-eq-version="iron_sword_plus"'])assert(html.includes(text),text);});
console.log('Codex: '+count+' cases passed.');
