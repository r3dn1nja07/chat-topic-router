const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function fixture(){
  const nodes=new Map();let ready;let clipboard='';let request;let failure=false;let denied=false;
  function node(){return{children:[],textContent:'',value:'',disabled:false,listeners:{},addEventListener(k,fn){this.listeners[k]=fn},append(...items){this.children.push(...items)},replaceChildren(){this.children=[]},set innerHTML(value){throw Error('Unsafe HTML insertion')}}}
  const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)};
  const storage={centralBrainPairingKey:'b'.repeat(64)};
  const context=vm.createContext({document:{addEventListener(event,fn){ready=fn},getElementById:get,createElement:node},chrome:{storage:{local:{get:async()=>storage,set:async d=>Object.assign(storage,d),remove:async k=>delete storage[k]}}},navigator:{clipboard:{writeText:async text=>{if(denied)throw Error('Clipboard blocked');clipboard=text}}},AbortSignal,fetch:async(url,options)=>{request={url,options};if(failure)throw Error('Local bridge unavailable');return{ok:true,json:async()=>({results:[{source:'safe.md',line:7,excerpt:'<script>untrusted fixture</script>'}],saved:true,path:'Chat Inbox/Router Captures/test.md'})}},button(label,fn){return{label,click:fn}},flash(n,text){n.textContent=text}});
  vm.runInContext(fs.readFileSync('brain.js','utf8'),context);ready();
  return{get,storage,context,clipboard:()=>clipboard,request:()=>request,fail:()=>{failure=true},denyClipboard:()=>{denied=true}};
}
test('search renders text safely and copy includes the source citation',async()=>{
  const f=fixture();f.get('brain-query').value='fixture';await f.get('brain-search-form').listeners.submit({preventDefault(){}});
  const result=f.get('brain-results').children[0];assert.equal(result.children[1].textContent,'<script>untrusted fixture</script>');
  await result.children[2].click();assert.match(f.clipboard(),/source: safe.md:7/);
});
test('unavailable bridge gives visible search error',async()=>{
  const f=fixture();f.fail();f.get('brain-query').value='fixture';await f.get('brain-search-form').listeners.submit({preventDefault(){}});
  assert.equal(f.get('brain-status').textContent,'Local bridge unavailable');
});
test('failed capture re-enables its button and excludes source URL from payload',async()=>{
  const f=fixture();f.fail();const button={disabled:false};f.context.fixtureItem={id:'test',project:'Test',title:'Test',selectedText:'Harmless fixture',sourceUrl:'https://private.invalid'};f.context.fixtureButton=button;
  await vm.runInContext('saveToBrain(fixtureItem, fixtureButton)',f.context);assert.equal(button.disabled,false);assert.ok(!f.request().options.body.includes('private.invalid'));
});
test('disconnect removes stored pairing key',async()=>{
  const f=fixture();await f.get('brain-disconnect').listeners.click();assert.equal(f.storage.centralBrainPairingKey,undefined);
});
test('clipboard denial is handled with visible feedback',async()=>{
  const f=fixture();f.get('brain-query').value='fixture';await f.get('brain-search-form').listeners.submit({preventDefault(){}});f.denyClipboard();
  await assert.doesNotReject(f.get('brain-results').children[0].children[2].click());
  assert.match(f.get('brain-status').textContent,/Copy blocked/);
  assert.match(f.get('brain-status').textContent,/select the text/);
  assert.equal(f.clipboard(),'');
});
