// AIdaily2 administrator console and magazine-style detail pages
const dailyLabels={fortune:"오늘의 운세",diet:"오늘의 식단",exercise:"오늘의 운동",music:"오늘의 음악",history:"오늘의 역사",quiz:"오늘의 퀴즈",shopping:"스마트 쇼핑",recommendation:"라이프 추천",weather:"오늘의 날씨"};
const fieldLabels={morning:"아침",lunch:"점심",evening:"저녁",breakfast:"아침 식단",dinner:"저녁 식단",summary:"요약",advice:"오늘의 조언",nutritionNote:"영양 정보",safetyNote:"안전 안내",question:"퀴즈",answer:"정답",explanation:"해설",condition:"날씨",temperature:"기온",precipitationProbability:"강수 확률",sourceNote:"참고",restaurant:"맛집 추천",travelDestination:"여행 추천",accommodation:"숙소 추천",zodiacFortune:"별자리 운세",chineseZodiacFortune:"띠 운세",mbtiFortune:"MBTI 운세",song:"곡",artist:"아티스트",mood:"분위기",description:"내용",name:"이름",menu:"메뉴",calories:"열량",duration:"소요 시간",criteria:"선택 기준",item:"추천 항목",title:"제목",searchUrl:"검색 링크"};
function readableValue(value){
 if(value===null||value===undefined||value==="")return "";
 if(typeof value==="object"){
  if(Array.isArray(value))return value.map((v,i)=>'<div class="detail-section"><div class="detail-label">항목 '+(i+1)+'</div>'+readableValue(v)+'</div>').join("");
  return Object.entries(value).map(([k,v])=>'<div class="detail-section"><div class="detail-label">'+escapeHtml(fieldLabels[k]||k)+'</div>'+readableValue(v)+'</div>').join("");
 }
 if(typeof value==="string"&&/^https?:\/\//.test(value))return '<a href="'+escapeHtml(value)+'" target="_blank" rel="noopener">관련 링크 열기 ↗</a>';
 return '<p>'+escapeHtml(String(value))+'</p>';
}
function renderDailyItem(item){
 const c=item.content||{};const detailKeys=Object.keys(c).filter(k=>!["title","summary","answer"].includes(k));
 const preview=detailKeys.slice(0,2).map(k=>'<div class="daily-preview"><b>'+escapeHtml(fieldLabels[k]||k)+'</b><span>'+escapeHtml(typeof c[k]==="object"?Object.values(c[k]).filter(v=>typeof v==="string").join(" · "):String(c[k]))+'</span></div>').join("");
 const quiz=item.content_type==="quiz"?'<div class="quiz-question">'+escapeHtml(c.question||"")+'</div><div class="quiz-actions"><button data-quiz-answer="O" data-quiz-id="'+escapeHtml(item.id)+'">O</button><button data-quiz-answer="X" data-quiz-id="'+escapeHtml(item.id)+'">X</button><span class="quiz-feedback" id="quiz-'+escapeHtml(item.id)+'"></span></div>':"";
 return '<article class="daily-result editorial-card"><div class="meta">'+escapeHtml(dailyLabels[item.content_type]||item.content_type)+' · '+escapeHtml(item.content_date)+'</div><h3>'+escapeHtml(item.title)+'</h3><p>'+escapeHtml(item.summary||"")+'</p>'+preview+quiz+'<a class="editorial-link" href="/content/'+encodeURIComponent(item.id)+'">전문 읽기 <span>↗</span></a></article>';
}
renderArticles=function(list){
 $("#articles").innerHTML=list.length?list.map(a=>'<article class="article"><a class="article-image-link" href="/article/'+encodeURIComponent(a.id)+'"><img src="'+escapeHtml(a.image_url||"https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80")+'" alt="'+escapeHtml(a.image_alt||a.title)+'" loading="lazy"></a><div class="article-body"><div class="meta">'+escapeHtml(a.category)+' · '+new Date(a.published_at||a.created_at).toLocaleDateString("ko-KR")+'</div><h3><a href="/article/'+encodeURIComponent(a.id)+'">'+escapeHtml(a.title)+'</a></h3><p>'+escapeHtml(a.summary||a.content.slice(0,180))+'</p><a class="editorial-link" href="/article/'+encodeURIComponent(a.id)+'">상세 기사 읽기 <span>↗</span></a></div></article>').join(""):'<div class="empty">아직 발행된 브리핑이 없습니다.</div>';
};
function renderDetailSections(content){
 return Object.entries(content||{}).filter(([k])=>!["title","summary","answer"].includes(k)).map(([k,v])=>'<section class="detail-section"><div class="detail-label">'+escapeHtml(fieldLabels[k]||k)+'</div>'+readableValue(v)+'</section>').join("");
}
async function openDetailRoute(){
 const match=location.pathname.match(/^\/(content|article)\/([^/]+)\/?$/);if(!match)return;
 const [,kind,rawId]=match,id=decodeURIComponent(rawId),root=$("#detailPage");
 $("main").hidden=true;root.hidden=false;root.innerHTML='<div class="empty">콘텐츠를 불러오는 중입니다…</div>';
 try{
  const item=await api(kind==="content"?"/api/daily/"+encodeURIComponent(id):"/api/articles/"+encodeURIComponent(id));
  const isDaily=kind==="content",content=isDaily?(item.content||{}):null;
  const title=isDaily?item.title:item.title,summary=isDaily?item.summary:item.summary;
  const image=!isDaily&&item.image_url?'<img class="detail-cover" src="'+escapeHtml(item.image_url)+'" alt="'+escapeHtml(item.image_alt||item.title)+'">':"";
  const body=isDaily?renderDetailSections(content):'<section class="detail-section">'+(item.content||"").split(/\n{2,}/).map(p=>'<p>'+escapeHtml(p).replace(/\n/g,"<br>")+'</p>').join("")+'</section>';
  root.innerHTML='<div class="detail-topline"><button class="detail-back" id="detailBack">← 목록으로 돌아가기</button><span>'+escapeHtml(isDaily?(dailyLabels[item.content_type]||item.content_type):item.category)+'</span></div><article class="detail-shell">'+image+'<div class="detail-content"><div class="detail-kicker">'+escapeHtml(isDaily?"YOUR DAILY EDITION":"AIDAILY EDITORIAL")+' · '+escapeHtml(isDaily?item.content_date:new Date(item.published_at||item.created_at).toLocaleDateString("ko-KR"))+'</div><h1>'+escapeHtml(title)+'</h1><p class="detail-lead">'+escapeHtml(summary||"")+'</p>'+body+(isDaily&&item.content_type==="quiz"?'<div class="quiz-question">'+escapeHtml(content.question||"")+'</div><div class="quiz-actions"><button data-quiz-answer="O" data-quiz-id="'+escapeHtml(item.id)+'">O</button><button data-quiz-answer="X" data-quiz-id="'+escapeHtml(item.id)+'">X</button><span class="quiz-feedback" id="quiz-'+escapeHtml(item.id)+'"></span></div>':"")+'<div class="detail-actions"><button id="detailCopy">내용 복사</button><button id="detailPrint">인쇄하기</button></div></div></article>';
  $("#detailBack").onclick=()=>{location.href="/#daily-life"};
  $("#detailCopy").onclick=async()=>{try{await navigator.clipboard.writeText(title+"\n\n"+summary+"\n\n"+(isDaily?JSON.stringify(content,null,2):item.content));toast("콘텐츠를 복사했습니다.")}catch(e){toast("복사 권한을 확인해 주세요.")}};
  $("#detailPrint").onclick=()=>window.print();
 }catch(e){root.innerHTML='<div class="empty">'+escapeHtml(e.message)+'<p><a href="/">홈으로 이동</a></p></div>'}
}
function ensureAdminEditor(){
 if($("#adminEditor"))return;
 document.body.insertAdjacentHTML("beforeend",'<div id="adminEditor" class="admin-editor" hidden><form id="adminEditorForm" class="admin-editor-card"><h3 id="adminEditorTitle">콘텐츠 편집</h3><input type="hidden" id="editId"><input type="hidden" id="editKind"><label>콘텐츠 제목<input id="editTitle" required maxlength="240"></label><label>요약<textarea id="editSummary" rows="2"></textarea></label><div id="articleFields"><label>분야<input id="editCategory" value="라이프"></label><label>대표 이미지 URL<input id="editImage"></label><label>원문 URL<input id="editSource"></label><label>본문<textarea id="editBody" rows="9"></textarea></label></div><div id="dailyFields"><label>콘텐츠 유형<select id="editDailyType"><option value="fortune">운세</option><option value="diet">식단</option><option value="exercise">운동</option><option value="music">음악</option><option value="history">역사</option><option value="quiz">퀴즈</option><option value="shopping">쇼핑</option><option value="recommendation">라이프 추천</option><option value="weather">날씨</option></select></label><label>상세 콘텐츠 JSON<textarea id="editJson" rows="12" spellcheck="false"></textarea></label></div><label id="editStatusWrap">발행 상태<select id="editStatus"><option value="published">공개 발행</option><option value="draft">임시 저장</option></select></label><div class="admin-editor-actions"><button type="button" id="cancelAdminEdit" class="small">취소</button><button type="submit" class="primary">저장하기</button></div></form></div>');
 $("#cancelAdminEdit").onclick=()=>$("#adminEditor").hidden=true;
 $("#adminEditorForm").onsubmit=saveAdminContent;
}
let adminReady=false;
async function refreshAdminStatus(){
 try{
  const st=await api("/api/admin/status");const nav=$("#adminNav"),panel=$("#adminPanel"),bootstrap=$("#adminBootstrap");
  if(!st.authenticated){nav.hidden=true;panel.hidden=true;return}
  if(!st.adminExists){
   nav.hidden=false;nav.href="#adminPanel";nav.textContent="관리자 등록";
   panel.hidden=false;bootstrap.hidden=false;
   $("#adminContentList").innerHTML='<p class="muted">최초 관리자 등록 후 대시보드와 콘텐츠 관리 기능을 사용할 수 있습니다.</p>';
   return;
  }
  if(!st.isAdmin){nav.hidden=true;panel.hidden=true;return}
  nav.hidden=false;nav.href="#adminPanel";nav.textContent="관리자";
  bootstrap.hidden=true;panel.hidden=location.hash!=="#adminPanel";
  if(!adminReady){adminReady=true;loadAdminDashboard()}
 }catch(e){console.warn("관리자 상태 확인 실패",e)}
}
async function loadAdminDashboard(){
 if(!adminReady)return;
 try{
  const d=await api("/api/admin/overview");
  $("#adminStats").innerHTML=[["전체 회원",d.users],["전체 콘텐츠",d.articles+d.daily],["공개 브리핑",d.published],["임시 저장",d.drafts]].map(x=>'<div class="admin-stat"><span>'+x[0]+'</span><b>'+Number(x[1]).toLocaleString("ko-KR")+'</b></div>').join("");
  await loadAdminContent();
 }catch(e){toast(e.message)}
}
async function loadAdminContent(){
 const type=$("#adminContentType").value;
 try{
  const rows=await api("/api/admin/content?type="+encodeURIComponent(type));
  $("#adminContentList").innerHTML=rows.length?rows.map(x=>{
   const kind=x.kind==="article"||type==="articles"?"article":"daily";
   const sub=kind==="article"?(x.category||"뉴스 브리핑"):(dailyLabels[x.content_type]||x.content_type||dailyLabels[x.kind]||"데일리 콘텐츠");
   return '<article class="admin-row"><div><h4>'+escapeHtml(x.title)+'</h4><p>'+escapeHtml(sub)+' · '+escapeHtml(x.date||x.content_date||new Date(x.created_at).toLocaleDateString("ko-KR"))+'</p></div><div class="admin-row-actions"><button data-admin-edit="'+kind+'" data-id="'+escapeHtml(x.id)+'">수정</button><button class="danger" data-admin-delete="'+kind+'" data-id="'+escapeHtml(x.id)+'">삭제</button></div></article>';
  }).join(""):'<div class="empty">관리할 콘텐츠가 없습니다.</div>';
 }catch(e){toast(e.message)}
}
async function editAdminContent(kind,id){
 ensureAdminEditor();$("#adminEditor").hidden=false;$("#editKind").value=kind;$("#editId").value=id||"";
 $("#articleFields").hidden=kind!=="article";$("#dailyFields").hidden=kind!=="daily";$("#editStatusWrap").hidden=kind!=="article";
 $("#adminEditorTitle").textContent=id?"콘텐츠 수정":"새 콘텐츠 작성";
 if(!id){$("#adminEditorForm").reset();$("#editKind").value=kind;$("#editId").value="";$("#editCategory").value="라이프";$("#editJson").value=JSON.stringify({title:"새 데일리 콘텐츠",summary:"",morning:{title:"아침",description:"내용을 입력하세요."}},null,2);return}
 try{
  const x=await api("/api/admin/"+(kind==="daily"?"daily":"articles")+"/"+encodeURIComponent(id));
  $("#editTitle").value=x.title||"";$("#editSummary").value=x.summary||"";
  if(kind==="daily"){const c=x.content||JSON.parse(x.content_json);$("#editDailyType").value=x.content_type;$("#editJson").value=JSON.stringify(c,null,2)}
  else{$("#editCategory").value=x.category||"라이프";$("#editImage").value=x.image_url||"";$("#editSource").value=x.source_url||"";$("#editBody").value=x.content||"";$("#editStatus").value=x.status||"published"}
 }catch(e){$("#adminEditor").hidden=true;toast(e.message)}
}
async function saveAdminContent(e){
 e.preventDefault();const kind=$("#editKind").value,id=$("#editId").value;
 const title=$("#editTitle").value.trim(),summary=$("#editSummary").value.trim();
 try{
  if(kind==="daily"){
   const content=JSON.parse($("#editJson").value);content.title=title;content.summary=summary;
   if(id)await api("/api/admin/daily/"+encodeURIComponent(id),{method:"PUT",body:JSON.stringify({title,summary,content})});
   else await api("/api/admin/daily",{method:"POST",body:JSON.stringify({type:$("#editDailyType").value,title,summary,content})});
  }else{
   const payload={title,summary,category:$("#editCategory").value,image_url:$("#editImage").value,source_url:$("#editSource").value,content:$("#editBody").value,status:$("#editStatus").value};
   await api(id?"/api/admin/articles/"+encodeURIComponent(id):"/api/admin/articles",{method:id?"PUT":"POST",body:JSON.stringify(payload)});
  }
  $("#adminEditor").hidden=true;toast("콘텐츠를 저장했습니다.");loadAdminDashboard();
 }catch(err){toast("저장 실패: "+err.message)}
}
document.body.addEventListener("click",async e=>{
 const edit=e.target.closest("[data-admin-edit]"),del=e.target.closest("[data-admin-delete]");
 if(edit){editAdminContent(edit.dataset.adminEdit,edit.dataset.id);return}
 if(del){if(!confirm("이 콘텐츠를 영구 삭제할까요? 삭제 후 복구할 수 없습니다."))return;try{await api("/api/admin/"+(del.dataset.adminDelete==="daily"?"daily":"articles")+"/"+encodeURIComponent(del.dataset.id),{method:"DELETE"});toast("콘텐츠를 삭제했습니다.");loadAdminDashboard()}catch(err){toast(err.message)}}
});
$("#claimAdmin")?.addEventListener("click",async()=>{const b=$("#claimAdmin");b.disabled=true;try{await api("/api/admin/bootstrap",{method:"POST",body:"{}"});toast("관리자 계정 등록 완료");adminReady=true;refreshAdminStatus()}catch(e){toast(e.message)}finally{b.disabled=false}});
$("#adminRefresh")?.addEventListener("click",loadAdminDashboard);
$("#adminContentType")?.addEventListener("change",loadAdminContent);
$("#adminCreate")?.addEventListener("click",()=>editAdminContent($("#adminContentType").value==="daily"?"daily":"article",null));
async function openAdminPanel(){
 const panel=$("#adminPanel"),nav=$("#adminNav"),bootstrap=$("#adminBootstrap");
 if(!panel)return;
 try{
  const st=await api("/api/admin/status");
  if(!st.authenticated){openAuth("login");toast("관리자 메뉴는 로그인 후 이용할 수 있습니다.");return;}
  if(!st.adminExists){
   panel.hidden=false;bootstrap.hidden=false;
   if(nav){nav.hidden=false;nav.textContent="관리자 등록";nav.href="#adminPanel";}
   return;
  }
  if(!st.isAdmin){panel.hidden=true;toast("관리자 권한이 없습니다.");return;}
  panel.hidden=false;bootstrap.hidden=true;adminReady=true;
  await loadAdminDashboard();
 }catch(error){toast("관리자 화면을 열지 못했습니다: "+error.message)}
}
$("#adminNav")?.addEventListener("click",async event=>{
 event.preventDefault();
 if(location.hash!=="#adminPanel")history.pushState(null,"","#adminPanel");
 await openAdminPanel();
});
window.addEventListener("hashchange",()=>{
 if(location.hash==="#adminPanel")openAdminPanel();
 else if($("#adminPanel"))$("#adminPanel").hidden=true;
});
document.addEventListener("DOMContentLoaded",()=>{openDetailRoute();refreshAdminStatus()});
const authRefreshObserver=new MutationObserver(()=>{if(typeof authUser!=="undefined"&&authUser)refreshAdminStatus()});
if($("#accountLabel"))authRefreshObserver.observe($("#accountLabel"),{childList:true,subtree:true,characterData:true});
