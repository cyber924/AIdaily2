export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  UNSPLASH_ACCESS_KEY?: string;
  APP_TIMEZONE?: string;
}
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store"}});
const now=()=>new Date().toISOString();
const id=()=>crypto.randomUUID();
const safeText=(v:unknown,max=5000)=>String(v??"").trim().slice(0,max);
const categories=["시사","경제","IT","산업","금융","정치","사회","라이프","과학","문화"];
function decode(s:string){return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">");}
function parseRss(xml:string,category:string){
 const out:{title:string,url:string,publishedAt:string,category:string}[]=[];
 for(const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)){
  const block=m[1];const get=(tag:string)=>decode(new RegExp("<"+tag+"(?:\\s[^>]*)?>([\\s\\S]*?)<\/"+tag+">","i").exec(block)?.[1]?.trim()||"");
  const title=get("title").replace(/\s+-\s+[^-]+$/,"");const url=get("link");const date=new Date(get("pubDate"));
  if(title&&/^https?:\/\//i.test(url)&&!isNaN(date.getTime()))out.push({title,url,publishedAt:date.toISOString(),category});
 }
 return out;
}
async function collectNews(){
 const feeds=[["시사","NATION"],["경제","BUSINESS"],["IT","TECHNOLOGY"],["과학","SCIENCE"],["건강","HEALTH"]];
 const all=await Promise.all(feeds.map(async([category,topic])=>{
  const res=await fetch("https://news.google.com/rss/headlines/section/topic/"+topic+"?hl=ko&gl=KR&ceid=KR:ko",{headers:{"user-agent":"AIdaily2/1.0"},signal:AbortSignal.timeout(12000)});
  if(!res.ok)throw new Error("Google 뉴스 피드 오류: "+category);
  return parseRss(await res.text(),category);
 }));
 return all.flat().sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
}
async function gemini(env:Env,prompt:string){
 if(!env.GEMINI_API_KEY)throw new Error("GEMINI_API_KEY Worker secret이 등록되지 않았습니다.");
 const model=env.GEMINI_MODEL||"gemini-3.8-flash";
 const response=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+model+":generateContent",{method:"POST",headers:{"content-type":"application/json","x-goog-api-key":env.GEMINI_API_KEY},body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{temperature:0.45,maxOutputTokens:8192,responseMimeType:"application/json"}}),signal:AbortSignal.timeout(60000)});
 const body:any=await response.json();if(!response.ok)throw new Error("Gemini API "+response.status+": "+(body?.error?.message||"호출 실패"));
 const candidate=body?.candidates?.[0];if(!candidate)throw new Error("Gemini 응답에 생성 결과가 없습니다: "+(body?.promptFeedback?.blockReason||"응답 차단 또는 빈 응답"));
 const text=candidate?.content?.parts?.map((p:any)=>p.text||"").join("\\n")||"";
 if(!text.trim())throw new Error("Gemini가 빈 응답을 반환했습니다. finishReason="+(candidate.finishReason||"unknown"));
 return text;
}
function imageQuery(category:string,title:string){
 const map:Record<string,string>={시사:"world news parliament city",경제:"finance stock market business",IT:"artificial intelligence technology computer",산업:"modern industry factory",금융:"finance banking investment",정치:"government parliament",사회:"city people community",라이프:"lifestyle daily life",과학:"science laboratory research",문화:"art culture museum"};
 return (map[category]||"editorial news photography")+" "+title.slice(0,50);
}
async function unsplash(env:Env,category:string,title:string){
 if(env.UNSPLASH_ACCESS_KEY){
  const url=new URL("https://api.unsplash.com/search/photos");url.searchParams.set("query",imageQuery(category,title));url.searchParams.set("orientation","landscape");url.searchParams.set("per_page","8");
  const r=await fetch(url,{headers:{Authorization:"Client-ID "+env.UNSPLASH_ACCESS_KEY},signal:AbortSignal.timeout(12000)});
  if(r.ok){const d:any=await r.json();const p=d.results?.[0];if(p)return {url:p.urls?.regular||p.urls?.small,alt:p.alt_description||title,credit:"Photo by "+(p.user?.name||"Unsplash")+" on Unsplash"};}
 }
 const fallback:Record<string,string>={시사:"photo-1529107386315-e1a2ed48a620",경제:"photo-1460925895917-afdab827c52f",IT:"photo-1518770660439-4636190af475",산업:"photo-1581091226825-a6a2a5aee158",금융:"photo-1611974789855-9c2a0a7236a3",정치:"photo-1529107386315-e1a2ed48a620",사회:"photo-1511632765486-a01980e01a18",라이프:"photo-1490645935967-10de6ba17061",과학:"photo-1532094349884-543bc11b234d",문화:"photo-1513364776144-60967b0f800f"};
 const photo=fallback[category]||"photo-1451187580459-43490279c0fa";
 return {url:"https://images.unsplash.com/"+photo+"?auto=format&fit=crop&w=1400&q=82",alt:title,credit:"Unsplash (editorial image)"};
}
async function createBriefing(env:Env,category?:string,topic?:string){
 const candidates=await collectNews();const chosen=candidates.filter(x=>!category||x.category===category).slice(0,category?3:8);
 if(!chosen.length)throw new Error("선택한 분야의 최신 뉴스가 없습니다.");
 const saved=await env.DB.prepare("SELECT source_url FROM articles WHERE source_url != '' ORDER BY created_at DESC LIMIT 300").all<any>();
 const known=new Set((saved.results||[]).map((x:any)=>x.source_url));
 const fresh=chosen.filter(x=>!known.has(x.url)).slice(0,category?1:5);
 if(!fresh.length)throw new Error("새로운 뉴스가 없습니다. 기존 기사를 중복 발행하지 않았습니다.");
 const prompt="당신은 한국어 전문 뉴스 브리핑 편집장이다. 아래 기사 원문 제목과 링크를 근거로 각 기사를 독립된 브리핑으로 작성한다. 사실을 창작하지 말고 확인되지 않은 수치와 인용을 만들지 않는다. 각 항목은 제목, 2~3문장 요약, 맥락과 영향 분석을 포함한다. 응답은 JSON 배열만 반환한다. 각 객체 형식: {title,summary,content}. content는 500~800자.\n"+JSON.stringify(fresh);
 const raw=await gemini(env,prompt);const clean=raw.replace(/^\s*```(?:json)?/i,"").replace(/```\s*$/,"").trim();
 const jsonStart=clean.indexOf("[");const jsonEnd=clean.lastIndexOf("]");
 if(jsonStart<0||jsonEnd<jsonStart)throw new Error("Gemini 응답이 JSON 배열 형식이 아닙니다. 응답 일부: "+clean.slice(0,180));
 let parsed:any;try{parsed=JSON.parse(clean.slice(jsonStart,jsonEnd+1));}catch{throw new Error("Gemini JSON 응답을 해석하지 못했습니다. 다시 생성해 주세요.");}
 if(!Array.isArray(parsed)||!parsed.length)throw new Error("Gemini가 유효한 브리핑 목록을 반환하지 않았습니다.");
 const created=[];
 for(let i=0;i<fresh.length;i++){
  const src=fresh[i],a=parsed[i];if(!a?.title||!a?.content)continue;
  const image=await unsplash(env,src.category,a.title);const articleId=id();const stamp=now();
  await env.DB.prepare("INSERT INTO articles(id,title,summary,content,category,source_title,source_url,image_url,image_alt,image_credit,status,created_at,published_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?, 'published',?,?,?)")
   .bind(articleId,safeText(a.title,240),safeText(a.summary,700),safeText(a.content,8000),src.category,src.title,src.url,image.url,image.alt,image.credit,stamp,stamp,stamp).run();
  await env.DB.prepare("INSERT OR IGNORE INTO news_sources(id,title,url,category,published_at,fetched_at) VALUES(?,?,?,?,?,?)").bind(id(),src.title,src.url,src.category,src.publishedAt,stamp).run();
  created.push({id:articleId,title:a.title,category:src.category,imageUrl:image.url,sourceUrl:src.url});
 }
 await env.DB.prepare("INSERT INTO generation_runs(id,action,status,detail,created_at) VALUES(?,?,?,?,?)").bind(id(),"news-briefing","success",created.length+" articles",now()).run();
 return created;
}
async function publishDue(env:Env){
 const due=await env.DB.prepare("SELECT * FROM publish_queue WHERE status='queued' AND scheduled_at<=? ORDER BY scheduled_at LIMIT 5").bind(now()).all<any>();
 const results=[];
 for(const q of due.results||[]){
  const claimed=await env.DB.prepare("UPDATE publish_queue SET status='processing',updated_at=? WHERE id=? AND status='queued'").bind(now(),q.id).run();
  if(!claimed.meta.changes)continue;
  try{
   const result=await createBriefing(env,q.category,q.topic);const article=result[0];
   await env.DB.prepare("UPDATE publish_queue SET status='published',article_id=?,error='',updated_at=? WHERE id=?").bind(article.id,now(),q.id).run();results.push({id:q.id,status:"published",article});
  }catch(e){await env.DB.prepare("UPDATE publish_queue SET status='failed',error=?,updated_at=? WHERE id=?").bind(safeText((e as Error).message,1000),now(),q.id).run();results.push({id:q.id,status:"failed",error:(e as Error).message});}
 }
 return results;
}
async function handle(request:Request,env:Env){
 const url=new URL(request.url),path=url.pathname;
 if(path==="/api/health")return json({ok:true,service:"AIdaily2",database:"D1",aiConfigured:!!env.GEMINI_API_KEY,model:env.GEMINI_MODEL||"gemini-3.8-flash",login:"deferred-development-mode"});
 if(path==="/api/articles"&&request.method==="GET"){
  const category=url.searchParams.get("category");const status=url.searchParams.get("status")||"published";const limit=Math.min(100,Math.max(1,Number(url.searchParams.get("limit")||30)));
  const result=category?await env.DB.prepare("SELECT * FROM articles WHERE status=? AND category=? ORDER BY published_at DESC LIMIT ?").bind(status,category,limit).all():await env.DB.prepare("SELECT * FROM articles WHERE status=? ORDER BY published_at DESC LIMIT ?").bind(status,limit).all();
  return json(result.results);
 }
 if(path==="/api/articles"&&request.method==="POST"){
  const b:any=await request.json();const articleId=id(),stamp=now();await env.DB.prepare("INSERT INTO articles(id,title,summary,content,category,image_url,image_alt,image_credit,status,created_at,published_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(articleId,safeText(b.title,240),safeText(b.summary,700),safeText(b.content,12000),safeText(b.category,40)||"시사",safeText(b.image_url,2000),safeText(b.image_alt,500),safeText(b.image_credit,500),b.status==="draft"?"draft":"published",stamp,b.status==="draft"?null:stamp,stamp).run();return json({ok:true,id:articleId});
 }
 if(path==="/api/images"&&request.method==="GET"){
  const query=safeText(url.searchParams.get("query"),180);if(!env.UNSPLASH_ACCESS_KEY)return json({error:"이미지 검색을 사용하려면 UNSPLASH_ACCESS_KEY Worker secret을 등록하세요."},400);
  const u=new URL("https://api.unsplash.com/search/photos");u.searchParams.set("query",query);u.searchParams.set("orientation","landscape");u.searchParams.set("per_page","12");
  const r=await fetch(u,{headers:{Authorization:"Client-ID "+env.UNSPLASH_ACCESS_KEY}});const d:any=await r.json();if(!r.ok)return json({error:d?.errors?.[0]||"Unsplash 검색 실패"},502);
  return json((d.results||[]).map((p:any)=>({url:p.urls?.regular,alt:p.alt_description||query,credit:"Photo by "+(p.user?.name||"Unsplash")+" on Unsplash",link:p.links?.html})));
 }
 if(path.startsWith("/api/articles/")&&request.method==="PUT"){
  const articleId=path.split("/").pop();const b:any=await request.json();const stamp=now();
  await env.DB.prepare("UPDATE articles SET title=?,summary=?,content=?,category=?,image_url=?,image_alt=?,image_credit=?,status=?,published_at=CASE WHEN ?='published' THEN COALESCE(published_at,?) ELSE published_at END,updated_at=? WHERE id=?")
   .bind(safeText(b.title,240),safeText(b.summary,700),safeText(b.content,12000),safeText(b.category,40),safeText(b.image_url,2000),safeText(b.image_alt,500),safeText(b.image_credit,500),b.status==="draft"?"draft":"published",b.status==="draft"?"draft":"published",stamp,stamp,articleId).run();
  return json({ok:true});
 }
 if(path.startsWith("/api/articles/")&&request.method==="DELETE"){const articleId=path.split("/").pop();await env.DB.prepare("UPDATE articles SET status='archived',updated_at=? WHERE id=?").bind(now(),articleId).run();return json({ok:true});}
 if(path==="/api/news"&&request.method==="GET"){const items=await collectNews();return json(items.slice(0,50));}
 if(path==="/api/generate"&&request.method==="POST"){const b:any=await request.json();const created=await createBriefing(env,safeText(b.category,40)||undefined,safeText(b.topic,300)||undefined);return json({ok:true,articles:created});}
 if(path==="/api/agent"&&request.method==="POST"){
  const b:any=await request.json();const command=safeText(b.command,1000);if(!command)return json({error:"명령을 입력하세요."},400);
  if(/예약/.test(command)){const m=command.match(/(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2})/);if(!m)return json({error:"예약 시간은 YYYY-MM-DD HH:mm 형식으로 말해주세요."},400);const dt=new Date(m[1].replace(" ","T")+":00+09:00");if(isNaN(dt.getTime()))return json({error:"예약 시간이 올바르지 않습니다."},400);const qid=id(),stamp=now();await env.DB.prepare("INSERT INTO publish_queue(id,topic,category,scheduled_at,status,created_at,updated_at) VALUES(?,?,?,?, 'queued',?,?)").bind(qid,command,categories.find(c=>command.includes(c))||"시사",dt.toISOString(),stamp,stamp).run();return json({ok:true,message:"예약 대기열에 등록했습니다.",id:qid});}
  if(/뉴스|브리핑|발행|작성|만들어|생성/.test(command)){const cat=categories.find(c=>command.includes(c));const result=await createBriefing(env,cat);return json({ok:true,message:result.length+"건의 브리핑을 생성하고 발행했습니다.",articles:result});}

  return json({ok:true,message:"명령을 이해했습니다. '오늘 IT 뉴스 브리핑 발행해줘' 또는 '2026-11-28 09:00 시사 뉴스 예약해줘'처럼 요청해 주세요."});
 }
 if(path==="/api/queue"&&request.method==="GET"){await publishDue(env);const r=await env.DB.prepare("SELECT * FROM publish_queue ORDER BY created_at DESC LIMIT 50").all();return json(r.results);}
 if(path==="/api/queue"&&request.method==="POST"){const b:any=await request.json();const dt=new Date(safeText(b.scheduled_at));if(isNaN(dt.getTime())||dt.getTime()<=Date.now())return json({error:"미래 시간을 선택하세요."},400);const qid=id(),stamp=now();await env.DB.prepare("INSERT INTO publish_queue(id,topic,category,scheduled_at,status,created_at,updated_at) VALUES(?,?,?,?, 'queued',?,?)").bind(safeText(b.topic,300)||"오늘의 뉴스 브리핑",safeText(b.category,40)||"시사",dt.toISOString(),stamp,stamp).run();return json({ok:true,id:qid});}
 if(path.startsWith("/api/queue/")&&request.method==="DELETE"){await env.DB.prepare("UPDATE publish_queue SET status='cancelled',updated_at=? WHERE id=? AND status='queued'").bind(now(),path.split("/").pop()).run();return json({ok:true});}
 if(path==="/api/publish-due"&&request.method==="POST")return json({results:await publishDue(env)});
 return env.ASSETS.fetch(request);
}
export default {fetch(request:Request,env:Env){return handle(request,env).catch(e=>json({error:(e as Error).message||"요청 처리 실패"},500));}} satisfies ExportedHandler<Env>;