import {getStore} from '@netlify/blobs';
import crypto from 'node:crypto';
const J=(o,c=200)=>new Response(JSON.stringify(o),{status:c,headers:{'content-type':'application/json'}});
const TOKEN=process.env.BOT_TOKEN,WS=process.env.WEBHOOK_SECRET;
const now=()=>Math.floor(Date.now()/1000);
const nm=u=>[u.first_name,u.last_name].filter(Boolean).join(' ')||u.username||'Шахтёр';
function auth(h){if(!h||!TOKEN)return null;const p=new URLSearchParams(h),hash=p.get('hash');p.delete('hash');
  const s=[...p.entries()].map(([k,v])=>k+'='+v).sort().join('\n');
  const sec=crypto.createHmac('sha256','WebAppData').update(TOKEN).digest();
  if(crypto.createHmac('sha256',sec).update(s).digest('hex')!==hash)return null;
  try{return JSON.parse(p.get('user'))}catch(e){return null}}
export default async(req)=>{
  const st=getStore('rudokop'),path=new URL(req.url).pathname.replace(/^\/api/,'');
  // Вебхук бота: ловит /start ref_<id>
  if(path=='/tg'&&req.method=='POST'){
    if(!WS||req.headers.get('x-telegram-bot-api-secret-token')!==WS)return J({},403);
    const up=await req.json(),m=up.message;
    if(m&&m.text&&m.from){const f=m.from,k='u:'+f.id,ex=await st.get(k,{type:'json'}),mm=m.text.match(/^\/start ref_(\d+)/);
      if(!ex){await st.setJSON(k,{name:nm(f),money:0,lvl:0,ts:now()});
        if(mm&&+mm[1]!==f.id){const fk='f:'+mm[1],l=(await st.get(fk,{type:'json'}))||[];if(l.indexOf(f.id)<0)l.push(f.id);await st.setJSON(fk,l)}}}
    return J({ok:1})}
  const u=auth(req.headers.get('x-init-data'));if(!u)return J({error:'auth'},401);
  const k='u:'+u.id;let me=await st.get(k,{type:'json'})||{money:0,lvl:0,ts:now()};me.name=nm(u);
  if(path=='/score'&&req.method=='POST'){let b={};try{b=await req.json()}catch(e){}
    me.money=Math.max(0,Math.floor(+b.money||0));me.lvl=Math.min(20,Math.max(0,+b.lvl||0));await st.setJSON(k,me);return J({ok:1})}
  if(path=='/friends'){const l=(await st.get('f:'+u.id,{type:'json'}))||[];
    const r=await Promise.all(l.map(id=>st.get('u:'+id,{type:'json'})));
    return J({friends:r.filter(Boolean).map(x=>({name:x.name,money:x.money,ts:x.ts}))})}
  if(path=='/leaderboard'){let c=await st.get('lb',{type:'json'});
    if(!c||now()-c.ts>30){const {blobs}=await st.list({prefix:'u:'});
      const rows=(await Promise.all(blobs.map(async b=>{const x=await st.get(b.key,{type:'json'});return x&&{id:b.key.slice(2),name:x.name,money:x.money,lvl:x.lvl}}))).filter(Boolean);
      rows.sort((a,b)=>b.money-a.money);c={ts:now(),rows:rows.slice(0,500)};await st.setJSON('lb',c)}
    const top=c.rows.slice(0,20).map(r=>({name:r.name,money:r.money,lvl:r.lvl,me:r.id==u.id}));
    return J({top,me:{rank:c.rows.filter(r=>r.id!=u.id&&r.money>me.money).length+1,name:me.name,money:me.money,lvl:me.lvl,me:true}})}
  return J({},404)};
export const config={path:'/api/*'};
