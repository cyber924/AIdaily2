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
const b64url=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const fromB64url=(value:string)=>Uint8Array.from(atob(value.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
async function sha256(value:string){return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))));}
async function passwordHash(password:string,salt:string){
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveBits"]);
 const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:fromB64url(salt),iterations:100000,hash:"SHA-256"},key,256);
 return b64url(new Uint8Array(bits));
}
function cookieValue(request:Request,name:string){return (request.headers.get("cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(name+"="))?.slice(name.length+1)||"";}
async function currentUser(request:Request,env:Env){
 const token=cookieValue(request,"aidaily_session");if(!token)return null;
 const row=await env.DB.prepare("SELECT u.id,u.email,u.display_name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?").bind(await sha256(token),now()).first<any>();
 return row||null;
}
async function requireUser(request:Request,env:Env){const user=await currentUser(request,env);return user;}
function sessionCookie(token:string,maxAge:number){return "aidaily_session="+token+"; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age="+maxAge;}

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
 const feeds:[string,string][]=[["시사","NATION"],["정치","NATION"],["사회","NATION"],["경제","BUSINESS"],["금융","BUSINESS"],["산업","BUSINESS"],["IT","TECHNOLOGY"],["과학","SCIENCE"],["라이프","HEALTH"],["문화","ENTERTAINMENT"]];
 const all=await Promise.all(feeds.map(async([category,topic])=>{
  const res=await fetch("https://news.google.com/rss/headlines/section/topic/"+topic+"?hl=ko&gl=KR&ceid=KR:ko",{headers:{"user-agent":"AIdaily2/1.0"},signal:AbortSignal.timeout(12000)});
  if(!res.ok)throw new Error("Google 뉴스 피드 오류: "+category);
  return parseRss(await res.text(),category);
 }));
 const seen=new Set<string>();return all.flat().filter(item=>{if(seen.has(item.url))return false;seen.add(item.url);return true}).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
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
async function createBriefing(env:Env,category?:string,topic?:string,ownerUserId?:string){
 const candidates=await collectNews();const chosen=candidates.filter(x=>!category||x.category===category).slice(0,category?3:8);
 if(!chosen.length)throw new Error("선택한 분야의 최신 뉴스가 없습니다.");
 const saved=await env.DB.prepare("SELECT source_url FROM articles WHERE source_url != '' ORDER BY created_at DESC LIMIT 300").all<any>();
 const known=new Set((saved.results||[]).map((x:any)=>x.source_url));
 const fresh=chosen.filter(x=>!known.has(x.url)).slice(0,category?1:5);
 if(!fresh.length)throw new Error("새로운 뉴스가 없습니다. 기존 기사를 중복 발행하지 않았습니다.");
 const prompt="당신은 한국어 전문 뉴스 브리핑 편집장이다. 아래 Google News 기사 제목과 URL을 바탕으로 사실을 과장하지 않는 전문 브리핑을 작성한다. 원문을 직접 확인하지 못한 세부 사실·수치·인용을 창작하지 말고, 제목에서 확인 가능한 내용과 일반적 맥락을 구분한다. 각 항목은 매력적인 한국어 제목, 2~3문장 요약, 배경·영향·독자가 주목할 점을 포함한 본문으로 구성한다. 본문은 한국어 500~800자. 반드시 JSON 배열만 반환하고 각 객체는 {title,summary,content} 형식을 지킨다. 요청 주제: "+(topic||"오늘의 주요 이슈")+". 기사 데이터: "+JSON.stringify(fresh);
 const raw=await gemini(env,prompt);const clean=raw.replace(/^\s*```(?:json)?/i,"").replace(/```\s*$/,"").trim();
 const jsonStart=clean.indexOf("[");const jsonEnd=clean.lastIndexOf("]");
 if(jsonStart<0||jsonEnd<jsonStart)throw new Error("Gemini 응답이 JSON 배열 형식이 아닙니다. 응답 일부: "+clean.slice(0,180));
 let parsed:any;try{parsed=JSON.parse(clean.slice(jsonStart,jsonEnd+1));}catch{throw new Error("Gemini JSON 응답을 해석하지 못했습니다. 다시 생성해 주세요.");}
 if(!Array.isArray(parsed)||!parsed.length)throw new Error("Gemini가 유효한 브리핑 목록을 반환하지 않았습니다.");
 const created=[];
 for(let i=0;i<fresh.length;i++){
  const src=fresh[i],a=parsed[i];if(!a?.title||!a?.content)continue;
  const image=await unsplash(env,src.category,a.title);const articleId=id();const stamp=now();
  await env.DB.prepare("INSERT INTO articles(id,title,summary,content,category,source_title,source_url,image_url,image_alt,image_credit,status,created_at,published_at,updated_at,owner_user_id) VALUES(?,?,?,?,?,?,?,?,?,?, 'published',?,?,?,?)")
   .bind(articleId,safeText(a.title,240),safeText(a.summary,700),safeText(a.content,8000),src.category,src.title,src.url,image.url,image.alt,image.credit,stamp,stamp,stamp,ownerUserId||null).run();
  await env.DB.prepare("INSERT OR IGNORE INTO news_sources(id,title,url,category,published_at,fetched_at) VALUES(?,?,?,?,?,?)").bind(id(),src.title,src.url,src.category,src.publishedAt,stamp).run();
  created.push({id:articleId,title:a.title,category:src.category,imageUrl:image.url,sourceUrl:src.url});
 }
 await env.DB.prepare("INSERT INTO generation_runs(id,action,status,detail,created_at) VALUES(?,?,?,?,?)").bind(id(),"news-briefing","success",created.length+" articles",now()).run();
 return created;
}

const DAILY_TYPES = ["fortune","diet","exercise","music","history","quiz","shopping","recommendation","weather"] as const;
type DailyType = typeof DAILY_TYPES[number];
const DAILY_LABELS: Record<DailyType,string> = {fortune:"오늘의 운세",diet:"오늘의 식단",exercise:"오늘의 운동",music:"오늘의 음악",history:"오늘의 역사",quiz:"오늘의 O/X 퀴즈",shopping:"스마트 쇼핑",recommendation:"라이프 추천",weather:"오늘의 날씨"};
const DAILY_PROMPTS: Record<DailyType,string> = {
 fortune:"별자리·띠·MBTI 운세. 미래를 사실처럼 단정하지 않는다. JSON {title,summary,zodiacFortune,chineseZodiacFortune,mbtiFortune,advice}",
 diet:"건강한 하루 식단. JSON {title,summary,breakfast:{menu,description,calories},lunch:{menu,description,calories},dinner:{menu,description,calories},nutritionNote}. 의료 처방 금지.",
 exercise:"초중급자 안전 운동 루틴. JSON {title,summary,morning:{name,description,duration},lunch:{name,description,duration},evening:{name,description,duration},safetyNote}. 통증 시 중단 안내.",
 music:"시간대별 음악 큐레이션. JSON {title,summary,morning:{song,artist,mood,description,searchUrl},lunch:{song,artist,mood,description,searchUrl},evening:{song,artist,mood,description,searchUrl}}. 실제 곡 여부를 단정하지 말고 검색 링크 제공.",
 history:"흥미로운 역사 이야기 세 가지. 확인되지 않은 사실 창작 금지. JSON {title,summary,morning:{title,description},lunch:{title,description},evening:{title,description}}",
 quiz:"정확한 상식 O/X 퀴즈. JSON {title,summary,question,answer,explanation}. answer는 O 또는 X.",
 shopping:"허위 가격·재고 없이 상품군과 선택 기준 추천. JSON {title,summary,morning:{item,description,criteria},lunch:{item,description,criteria},evening:{item,description,criteria}}",
 recommendation:"맛집·여행지·숙소 추천 아이디어와 선택 기준. JSON {title,summary,restaurant:{name,description},travelDestination:{name,description},accommodation:{name,description}}",
 weather:"실시간 관측자료 미연결 시 기온·강수량 창작 금지. 날씨 확인 항목과 준비 팁. JSON {title,summary,condition,temperature,advice,sourceNote}"
};
function parseDailyJson(raw: string) {
 const start=raw.indexOf("{"),end=raw.lastIndexOf("}");
 if(start<0||end<start) throw new Error("AI 응답을 JSON으로 해석할 수 없습니다.");
 return JSON.parse(raw.slice(start,end+1));
}

async function fetchWeatherBriefing(location:string,date:string){
 const geoUrl=new URL("https://geocoding-api.open-meteo.com/v1/search");
 geoUrl.searchParams.set("name",location||"Seoul");geoUrl.searchParams.set("count","1");geoUrl.searchParams.set("language","ko");geoUrl.searchParams.set("format","json");
 const geoResponse=await fetch(geoUrl.toString(),{signal:AbortSignal.timeout(10000)});
 if(!geoResponse.ok)throw new Error("날씨 위치 검색에 실패했습니다.");
 const geo:any=await geoResponse.json(),place=geo.results&&geo.results[0];
 if(!place)throw new Error("지역을 찾지 못했습니다. 프로필에 영문 도시명을 입력해 주세요.");
 const weatherUrl=new URL("https://api.open-meteo.com/v1/forecast");
 weatherUrl.searchParams.set("latitude",String(place.latitude));weatherUrl.searchParams.set("longitude",String(place.longitude));
 weatherUrl.searchParams.set("daily","weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
 weatherUrl.searchParams.set("timezone",envTimeZoneForWeather());weatherUrl.searchParams.set("forecast_days","1");
 const weatherResponse=await fetch(weatherUrl.toString(),{signal:AbortSignal.timeout(10000)});
 if(!weatherResponse.ok)throw new Error("실시간 날씨 정보를 불러오지 못했습니다.");
 const data:any=await weatherResponse.json(),daily=data.daily||{},code=Number(daily.weather_code?.[0]);
 const labels:Record<number,string>={0:"맑음",1:"대체로 맑음",2:"부분적으로 흐림",3:"흐림",45:"안개",48:"짙은 안개",51:"약한 이슬비",53:"이슬비",55:"강한 이슬비",61:"약한 비",63:"비",65:"강한 비",71:"약한 눈",73:"눈",75:"강한 눈",80:"소나기",81:"강한 소나기",82:"매우 강한 소나기",95:"뇌우",96:"우박 동반 뇌우",99:"강한 우박 동반 뇌우"};
 const min=daily.temperature_2m_min?.[0],max=daily.temperature_2m_max?.[0],rain=daily.precipitation_probability_max?.[0];
 const condition=labels[code]||"변화 가능 날씨";
 const advice=Number(rain)>=50?"우산을 챙기고 방수 신발을 고려하세요.":Number(min)<=5?"아침과 밤에는 보온에 신경 쓰세요.":Number(max)>=28?"수분을 충분히 섭취하고 한낮 야외활동을 줄이세요.":"가벼운 겉옷을 준비하면 좋습니다.";
 return {title:place.name+" 오늘의 날씨",summary:date+" 기준 "+condition+" · 최저 "+min+"°C / 최고 "+max+"°C",condition,temperature:{minC:min,maxC:max},precipitationProbability:rain,advice,source:"Open-Meteo",sourceUrl:"https://open-meteo.com/",location:place.name};
}
function envTimeZoneForWeather(){return "Asia/Seoul";}

async function createDaily(env: Env,user: any,type: DailyType,preferences: string) {
 const date=new Intl.DateTimeFormat("en-CA",{timeZone:env.APP_TIMEZONE || "Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const cached=async()=>env.DB.prepare("SELECT * FROM daily_contents WHERE owner_key=? AND content_type=? AND content_date=?").bind(user.id,type,date).first<any>();
 const old=await cached();
 if(old)return {item:{...old,content:JSON.parse(old.content_json)},reused:true};
 const lockKey=user.id+":"+type+":"+date,stamp=now(),staleBefore=new Date(Date.now()-15*60*1000).toISOString();
 const lock=await env.DB.prepare("INSERT INTO daily_generation_locks(lock_key,created_at) VALUES(?,?) ON CONFLICT(lock_key) DO UPDATE SET created_at=excluded.created_at WHERE daily_generation_locks.created_at<?").bind(lockKey,stamp,staleBefore).run();
 if(!lock.meta.changes){
  const afterWait=await cached();
  if(afterWait)return {item:{...afterWait,content:JSON.parse(afterWait.content_json)},reused:true};
  throw new Error("같은 콘텐츠를 생성하고 있습니다. 잠시 후 다시 확인해 주세요.");
 }
 try {
  const profile=await env.DB.prepare("SELECT * FROM user_profiles WHERE user_id=?").bind(user.id).first<any>();
  const prompt="한국어 데일리 매거진 에디터로서 "+date+" 콘텐츠 작성. "+DAILY_PROMPTS[type]+"\n사용자 선호: "+safeText(preferences,1200)+"\n프로필: "+JSON.stringify(profile || {})+"\nJSON 객체만 반환.";
  const content=type==="weather"?await fetchWeatherBriefing(safeText(profile?.location,80)||"Seoul",date):parseDailyJson(await gemini(env,prompt));
  if(type==="quiz" && !["O","X"].includes(content.answer))throw new Error("퀴즈 정답 형식 오류");
  const contentId=id(),title=safeText(content.title,180)||DAILY_LABELS[type],summary=safeText(content.summary,600),contentJson=JSON.stringify(content);
  await env.DB.prepare("INSERT INTO daily_contents(id,owner_key,content_type,content_date,title,summary,content_json,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(contentId,user.id,type,date,title,summary,contentJson,stamp).run();
  await env.DB.prepare("INSERT INTO generation_runs(id,action,status,detail,created_at) VALUES(?,?,?,?,?)").bind(id(),"daily-"+type,"success",user.id+":"+date,stamp).run();
  return {item:{id:contentId,owner_key:user.id,content_type:type,content_date:date,title,summary,content_json:contentJson,content,created_at:stamp},reused:false};
 } finally {
  await env.DB.prepare("DELETE FROM daily_generation_locks WHERE lock_key=?").bind(lockKey).run();
 }
}

async function publishDue(env:Env){
 const due=await env.DB.prepare("SELECT * FROM publish_queue WHERE status='queued' AND scheduled_at<=? ORDER BY scheduled_at LIMIT 5").bind(now()).all<any>();
 const results=[];
 for(const q of due.results||[]){
  const claimed=await env.DB.prepare("UPDATE publish_queue SET status='processing',updated_at=? WHERE id=? AND status='queued'").bind(now(),q.id).run();
  if(!claimed.meta.changes)continue;
  try{
   const result=await createBriefing(env,q.category,q.topic,q.owner_user_id||undefined);const article=result[0];
   await env.DB.prepare("UPDATE publish_queue SET status='published',article_id=?,error='',updated_at=? WHERE id=?").bind(article.id,now(),q.id).run();results.push({id:q.id,status:"published",article});
  }catch(e){await env.DB.prepare("UPDATE publish_queue SET status='failed',error=?,updated_at=? WHERE id=?").bind(safeText((e as Error).message,1000),now(),q.id).run();results.push({id:q.id,status:"failed",error:(e as Error).message});}
 }
 return results;
}
async function handle(request:Request,env:Env){
 const url=new URL(request.url),path=url.pathname;
 if(path==="/api/auth/me"&&request.method==="GET"){const user=await currentUser(request,env);return json({authenticated:!!user,user:user?{id:user.id,email:user.email,displayName:user.display_name}:null});}
 if(path==="/api/auth/register"&&request.method==="POST"){
  const b:any=await request.json();const email=safeText(b.email,254).toLowerCase();const displayName=safeText(b.displayName,60);const password=String(b.password||"");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json({error:"올바른 이메일 주소를 입력하세요."},400);
  if(password.length<8||password.length>72)return json({error:"비밀번호는 8~72자로 입력하세요."},400);
  if(displayName.length<2)return json({error:"이름은 2자 이상 입력하세요."},400);
  const exists=await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
  if(exists)return json({error:"이미 가입된 이메일입니다. 로그인해 주세요."},409);
  const userId=id(),salt=b64url(crypto.getRandomValues(new Uint8Array(16))),hash=await passwordHash(password,salt),stamp=now();
  await env.DB.prepare("INSERT INTO users(id,email,display_name,password_hash,password_salt,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").bind(userId,email,displayName,hash,salt,stamp,stamp).run();
  const token=b64url(crypto.getRandomValues(new Uint8Array(32))),expires=new Date(Date.now()+30*86400000).toISOString();
  await env.DB.prepare("INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)").bind(id(),userId,await sha256(token),expires,stamp).run();
  return new Response(JSON.stringify({ok:true,user:{id:userId,email,displayName}}),{headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","set-cookie":sessionCookie(token,30*86400)}});
 }
 if(path==="/api/auth/login"&&request.method==="POST"){
  const b:any=await request.json();const email=safeText(b.email,254).toLowerCase();const password=String(b.password||"");
  const user=await env.DB.prepare("SELECT id,email,display_name,password_hash,password_salt FROM users WHERE email=?").bind(email).first<any>();
  if(!user||!password|| (await passwordHash(password,user.password_salt))!==user.password_hash)return json({error:"이메일 또는 비밀번호를 확인하세요."},401);
  const token=b64url(crypto.getRandomValues(new Uint8Array(32))),stamp=now(),expires=new Date(Date.now()+30*86400000).toISOString();
  await env.DB.prepare("INSERT INTO sessions(id,user_id,token_hash,expires_at,created_at) VALUES(?,?,?,?,?)").bind(id(),user.id,await sha256(token),expires,stamp).run();
  return new Response(JSON.stringify({ok:true,user:{id:user.id,email:user.email,displayName:user.display_name}}),{headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","set-cookie":sessionCookie(token,30*86400)}});
 }
 if(path==="/api/auth/logout"&&request.method==="POST"){
  const token=cookieValue(request,"aidaily_session");if(token)await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await sha256(token)).run();
  return new Response(JSON.stringify({ok:true}),{headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","Set-Cookie":"aidaily_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"}});
 }
 if(path==="/api/health")return json({ok:true,service:"AIdaily2",database:"D1",aiConfigured:!!env.GEMINI_API_KEY,model:env.GEMINI_MODEL||"gemini-3.8-flash",login:"email-password"});

 if(path==="/api/profile"&&request.method==="GET"){
  const user=await requireUser(request,env);if(!user)return json({error:"로그인이 필요합니다."},401);
  const p=await env.DB.prepare("SELECT preferences_json,location,zodiac_sign,chinese_zodiac_sign,mbti_type,updated_at FROM user_profiles WHERE user_id=?").bind(user.id).first<any>();
  return json(p||{preferences_json:"{}",location:"Seoul",zodiac_sign:"",chinese_zodiac_sign:"",mbti_type:""});
 }
 if(path==="/api/profile"&&request.method==="PUT"){
  const user=await requireUser(request,env);if(!user)return json({error:"로그인이 필요합니다."},401);
  const b:any=await request.json(),stamp=now(),prefs=JSON.stringify(typeof b.preferences==="object"&&b.preferences?b.preferences:{});
  await env.DB.prepare("INSERT INTO user_profiles(user_id,preferences_json,location,zodiac_sign,chinese_zodiac_sign,mbti_type,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET preferences_json=excluded.preferences_json,location=excluded.location,zodiac_sign=excluded.zodiac_sign,chinese_zodiac_sign=excluded.chinese_zodiac_sign,mbti_type=excluded.mbti_type,updated_at=excluded.updated_at")
   .bind(user.id,prefs,safeText(b.location,80)||"Seoul",safeText(b.zodiac_sign,40),safeText(b.chinese_zodiac_sign,40),safeText(b.mbti_type,8),stamp).run();
  return json({ok:true});
 }
 if(path==="/api/daily"&&request.method==="GET"){
  const user=await requireUser(request,env);if(!user)return json({error:"로그인이 필요합니다."},401);
  const type=safeText(url.searchParams.get("type"),30);
  if(type&&!DAILY_TYPES.includes(type as DailyType))return json({error:"지원하지 않는 콘텐츠 유형입니다."},400);
  const rows=type?await env.DB.prepare("SELECT * FROM daily_contents WHERE owner_key=? AND content_type=? ORDER BY content_date DESC LIMIT 7").bind(user.id,type).all<any>():await env.DB.prepare("SELECT * FROM daily_contents WHERE owner_key=? ORDER BY content_date DESC LIMIT 40").bind(user.id).all<any>();
  return json((rows.results||[]).map((x:any)=>({...x,content:JSON.parse(x.content_json)})));
 }
 if(path==="/api/daily"&&request.method==="POST"){
  const user=await requireUser(request,env);if(!user)return json({error:"로그인이 필요합니다."},401);
  const b:any=await request.json(),type=safeText(b.type,30) as DailyType;
  if(!DAILY_TYPES.includes(type))return json({error:"지원하지 않는 콘텐츠 유형입니다."},400);
  const result=await createDaily(env,user,type,safeText(b.preferences,1200));
  return json({ok:true,reused:result.reused,item:result.item});
 }
 if(path==="/api/quiz/answer"&&request.method==="POST"){
  const user=await requireUser(request,env);if(!user)return json({error:"로그인이 필요합니다."},401);
  const b:any=await request.json(),answer=safeText(b.answer,1),contentId=safeText(b.contentId,80);
  if(!["O","X"].includes(answer))return json({error:"O 또는 X를 선택하세요."},400);
  const quiz=await env.DB.prepare("SELECT content_json FROM daily_contents WHERE id=? AND owner_key=? AND content_type='quiz'").bind(contentId,user.id).first<any>();
  if(!quiz)return json({error:"퀴즈를 찾을 수 없습니다."},404);
  const parsed=JSON.parse(quiz.content_json),correct=parsed.answer===answer;
  await env.DB.prepare("INSERT INTO quiz_attempts(id,user_id,content_id,user_answer,is_correct,attempted_at) VALUES(?,?,?,?,?,?)").bind(id(),user.id,contentId,answer,correct?1:0,now()).run();
  return json({ok:true,correct,explanation:parsed.explanation});
 }
 if(path==="/api/articles"&&request.method==="GET"){
  const category=url.searchParams.get("category");const status=url.searchParams.get("status")||"published";if(status!=="published"&&!await requireUser(request,env))return json({error:"로그인이 필요합니다."},401);const limit=Math.min(100,Math.max(1,Number(url.searchParams.get("limit")||30)));
  const result=category?await env.DB.prepare("SELECT * FROM articles WHERE status=? AND category=? ORDER BY published_at DESC LIMIT ?").bind(status,category,limit).all():await env.DB.prepare("SELECT * FROM articles WHERE status=? ORDER BY published_at DESC LIMIT ?").bind(status,limit).all();
  return json(result.results);
 }
 if(path==="/api/articles"&&request.method==="POST"){
  if(!await requireUser(request,env))return json({error:"로그인이 필요합니다."},401);
  const b:any=await request.json();const articleId=id(),stamp=now();await env.DB.prepare("INSERT INTO articles(id,title,summary,content,category,image_url,image_alt,image_credit,status,created_at,published_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)").bind(articleId,safeText(b.title,240),safeText(b.summary,700),safeText(b.content,12000),safeText(b.category,40)||"시사",safeText(b.image_url,2000),safeText(b.image_alt,500),safeText(b.image_credit,500),b.status==="draft"?"draft":"published",stamp,b.status==="draft"?null:stamp,stamp).run();return json({ok:true,id:articleId});
 }
 if(path==="/api/images"&&request.method==="GET"){
  const query=safeText(url.searchParams.get("query"),180);if(!env.UNSPLASH_ACCESS_KEY)return json({error:"이미지 검색을 사용하려면 UNSPLASH_ACCESS_KEY Worker secret을 등록하세요."},400);
  const u=new URL("https://api.unsplash.com/search/photos");u.searchParams.set("query",query);u.searchParams.set("orientation","landscape");u.searchParams.set("per_page","12");
  const r=await fetch(u,{headers:{Authorization:"Client-ID "+env.UNSPLASH_ACCESS_KEY}});const d:any=await r.json();if(!r.ok)return json({error:d?.errors?.[0]||"Unsplash 검색 실패"},502);
  return json((d.results||[]).map((p:any)=>({url:p.urls?.regular,alt:p.alt_description||query,credit:"Photo by "+(p.user?.name||"Unsplash")+" on Unsplash",link:p.links?.html})));
 }
 if(path.startsWith("/api/articles/")&&request.method==="PUT"){
  if(!await requireUser(request,env))return json({error:"로그인이 필요합니다."},401);
  const articleId=path.split("/").pop();const b:any=await request.json();const stamp=now();
  await env.DB.prepare("UPDATE articles SET title=?,summary=?,content=?,category=?,image_url=?,image_alt=?,image_credit=?,status=?,published_at=CASE WHEN ?='published' THEN COALESCE(published_at,?) ELSE published_at END,updated_at=? WHERE id=?")
   .bind(safeText(b.title,240),safeText(b.summary,700),safeText(b.content,12000),safeText(b.category,40),safeText(b.image_url,2000),safeText(b.image_alt,500),safeText(b.image_credit,500),b.status==="draft"?"draft":"published",b.status==="draft"?"draft":"published",stamp,stamp,articleId).run();
  return json({ok:true});
 }
 if(path.startsWith("/api/articles/")&&request.method==="DELETE"){if(!await requireUser(request,env))return json({error:"로그인이 필요합니다."},401);const articleId=path.split("/").pop();await env.DB.prepare("UPDATE articles SET status='archived',updated_at=? WHERE id=?").bind(now(),articleId).run();return json({ok:true});}
 if(path==="/api/news"&&request.method==="GET"){const items=await collectNews();return json(items.slice(0,50));}
 if(path==="/api/generate"&&request.method==="POST"){const user=await requireUser(request,env);if(!user)return json({error:"로그인이 필요합니다."},401);const b:any=await request.json();const created=await createBriefing(env,safeText(b.category,40)||undefined,safeText(b.topic,300)||undefined,user.id);return json({ok:true,articles:created});}
 if(path==="/api/agent"&&request.method==="POST"){
  if(!await requireUser(request,env))return json({error:"로그인이 필요합니다."},401);
  const b:any=await request.json();const command=safeText(b.command,1000);if(!command)return json({error:"명령을 입력하세요."},400);
  if(/예약/.test(command)){
   const m=command.match(/(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2})/);if(!m)return json({error:"예약 시간은 YYYY-MM-DD HH:mm 형식으로 말해주세요."},400);
   const dt=new Date(m[1].replace(" ","T")+":00+09:00");if(isNaN(dt.getTime()))return json({error:"예약 시간이 올바르지 않습니다."},400);
   const qid=id(),stamp=now();
   await env.DB.prepare("INSERT INTO publish_queue(id,topic,category,scheduled_at,status,created_at,updated_at,owner_user_id) VALUES(?,?,?,?,?,?,?,?)").bind(qid,command,categories.find(c=>command.includes(c))||"시사",dt.toISOString(),"queued",stamp,stamp,(await requireUser(request,env)).id).run();
   return json({ok:true,message:"예약 대기열에 등록했습니다.",id:qid});
  }
  if(/뉴스|브리핑|발행|작성|만들어|생성/.test(command)){const cat=categories.find(c=>command.includes(c));const result=await createBriefing(env,cat,undefined,(await requireUser(request,env)).id);return json({ok:true,message:result.length+"건의 브리핑을 생성하고 발행했습니다.",articles:result});}

  return json({ok:true,message:"명령을 이해했습니다. '오늘 IT 뉴스 브리핑 발행해줘' 또는 '2026-11-28 09:00 시사 뉴스 예약해줘'처럼 요청해 주세요."});
 }
 if(path==="/api/queue"&&request.method==="GET"){const user=await requireUser(request,env);if(!user)return json({error:"로그인이 필요합니다."},401);await publishDue(env);const r=await env.DB.prepare("SELECT * FROM publish_queue WHERE owner_user_id=? ORDER BY created_at DESC LIMIT 50").bind(user.id).all();return json(r.results);}
 if(path==="/api/queue"&&request.method==="POST"){
  const user=await requireUser(request,env);if(!user)return json({error:"로그인이 필요합니다."},401);
  const b:any=await request.json();const dt=new Date(safeText(b.scheduled_at));
  if(isNaN(dt.getTime())||dt.getTime()<=Date.now())return json({error:"미래 시간을 선택하세요."},400);
  const qid=id(),stamp=now();
  await env.DB.prepare("INSERT INTO publish_queue(id,topic,category,scheduled_at,status,created_at,updated_at,owner_user_id) VALUES(?,?,?,?,?,?,?,?)")
   .bind(qid,safeText(b.topic,300)||"오늘의 뉴스 브리핑",safeText(b.category,40)||"시사",dt.toISOString(),"queued",stamp,stamp,user.id).run();
  return json({ok:true,id:qid});
 }
 if(path.startsWith("/api/queue/")&&request.method==="DELETE"){
  const user=await requireUser(request,env);if(!user)return json({error:"로그인이 필요합니다."},401);
  await env.DB.prepare("UPDATE publish_queue SET status='cancelled',updated_at=? WHERE id=? AND owner_user_id=? AND status='queued'").bind(now(),path.split("/").pop(),user.id).run();
  return json({ok:true});
 }
 if(path==="/api/publish-due"&&request.method==="POST"){if(!await requireUser(request,env))return json({error:"로그인이 필요합니다."},401);return json({results:await publishDue(env)});}
 return env.ASSETS.fetch(request);
}
export default {fetch(request:Request,env:Env){return handle(request,env).catch(e=>json({error:(e as Error).message||"요청 처리 실패"},500));}} satisfies ExportedHandler<Env>;