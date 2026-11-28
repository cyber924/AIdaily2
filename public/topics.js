(() => {
  const topics = {
    exercise: {
      label: "운동", icon: "✦", en: "MOVE BETTER", title: "오늘의 움직임을 설계하다",
      intro: "내 체력과 생활 리듬에 맞춘 운동 루틴과 올바른 자세 가이드.",
      sub: [["전체 루틴","하루 운동 흐름을 한눈에"],["부위별 운동","상체·하체·코어 중심"],["홈트레이닝","공간과 장비 부담 없이"],["스트레칭","운동 전후 회복과 유연성"]],
      features: [["01","오늘의 루틴","아침·점심·저녁으로 나눈 실천 계획"],["02","부위별 가이드","목표 부위에 맞는 동작과 주의사항"],["03","회복과 스트레칭","무리하지 않는 회복 습관"]]
    },
    diet: {
      label: "식단", icon: "◒", en: "EAT WELL", title: "잘 먹는 하루의 작은 설계",
      intro: "아침부터 저녁까지 균형 잡힌 식사 아이디어와 영양 팁.",
      sub: [["오늘의 식단","아침·점심·저녁 구성"],["간편 레시피","바쁜 날을 위한 메뉴"],["영양 밸런스","식품군과 영양소 이해"],["식단 기록","나의 식사 습관 돌아보기"]],
      features: [["01","하루 식단","끼니별 메뉴와 간단한 조리 팁"],["02","영양 포인트","균형 있는 식사를 위한 참고 정보"],["03","식사 아이디어","상황에 맞는 현실적인 메뉴 제안"]]
    },
    fortune: {
      label: "운세", icon: "☼", en: "DAILY INSIGHT", title: "하루를 여는 가벼운 인사이트",
      intro: "별자리·띠·MBTI를 바탕으로 오늘을 돌아보는 재미있는 콘텐츠.",
      sub: [["오늘의 운세","오늘의 전체 흐름"],["별자리","별자리별 메시지"],["띠별 운세","띠에 따른 오늘의 조언"],["MBTI","성향별 하루 팁"]],
      features: [["01","오늘의 흐름","가볍게 참고하는 하루의 메시지"],["02","나의 별자리","별자리별 오늘의 키워드"],["03","성향별 조언","나에게 맞는 하루의 작은 제안"]]
    },
    music: {
      label: "음악", icon: "♫", en: "SOUNDTRACK", title: "오늘의 장면에 어울리는 음악",
      intro: "집중·휴식·이동·운동 등 순간의 분위기에 맞춘 음악 큐레이션.",
      sub: [["아침 플레이리스트","기분 좋은 하루의 시작"],["집중 음악","일과 공부에 몰입"],["휴식 음악","저녁의 여유와 회복"],["운동 음악","리듬을 살리는 선곡"]],
      features: [["01","시간대별 선곡","아침·낮·저녁의 분위기"],["02","상황별 음악","집중과 휴식에 맞는 큐레이션"],["03","음악 탐색","곡 정보와 검색 링크"]]
    },
    history: {
      label: "역사", icon: "⌛", en: "ON THIS DAY", title: "오늘, 과거에서 발견하는 이야기",
      intro: "오늘의 역사적 사건과 인물, 지금의 관점으로 읽는 흥미로운 지식.",
      sub: [["오늘의 역사","오늘 일어난 주요 사건"],["인물 이야기","역사를 만든 사람들"],["세계사","시대와 문명을 잇는 이야기"],["상식 노트","알아두면 좋은 배경지식"]],
      features: [["01","오늘의 사건","날짜로 만나는 역사적 순간"],["02","인물과 시대","사건을 만든 사람과 배경"],["03","더 알아보기","맥락을 이해하는 읽을거리"]]
    },
    quiz: {
      label: "퀴즈", icon: "?", en: "BRAIN BREAK", title: "잠깐의 퀴즈, 선명해지는 지식",
      intro: "하루 한 문제씩 풀어보는 상식 퀴즈와 정답 해설.",
      sub: [["오늘의 O/X","직관적으로 풀어보는 한 문제"],["일반 상식","분야를 넘나드는 지식"],["과학 퀴즈","일상 속 과학 원리"],["역사 퀴즈","사건과 인물에 관한 질문"]],
      features: [["01","오늘의 문제","정답을 고르고 바로 확인"],["02","자세한 해설","왜 정답인지 맥락까지"],["03","나의 기록","풀었던 문제를 다시 확인"]]
    },
    shopping: {
      label: "쇼핑", icon: "◇", en: "SMART CHOICE", title: "더 나은 선택을 위한 쇼핑 가이드",
      intro: "상품군별 선택 기준과 라이프스타일에 맞는 구매 아이디어.",
      sub: [["오늘의 추천","관심사에 맞는 아이템"],["테크·디지털","일과 생활을 돕는 기기"],["홈·리빙","공간을 바꾸는 생활용품"],["구매 가이드","비교할 때 확인할 기준"]],
      features: [["01","카테고리 큐레이션","필요와 취향에 맞춘 상품군"],["02","선택 기준","구매 전 확인할 핵심 요소"],["03","합리적 소비","가격·품질·활용도를 함께 고려"]]
    },
    recommendation: {
      label: "라이프 추천", icon: "⌖", en: "LOCAL & TRAVEL", title: "새로운 장소와 경험을 발견하다",
      intro: "맛집·여행지·숙소 등 일상을 풍성하게 만드는 장소와 경험.",
      sub: [["맛집","취향과 상황에 맞는 식당"],["여행","새로운 지역과 여행 아이디어"],["숙소","여행 목적에 맞는 숙박"],["주말 추천","가까운 곳에서 보내는 시간"]],
      features: [["01","맛집 아이디어","메뉴와 분위기를 고려한 추천"],["02","여행 큐레이션","목적에 맞는 여행지 탐색"],["03","머무는 경험","여행 스타일별 숙소 선택"]]
    },
    weather: {
      label: "날씨", icon: "☁", en: "WEATHER NOTE", title: "날씨를 알고 하루를 준비하다",
      intro: "실제 기상 데이터와 함께 확인하는 오늘의 날씨와 외출 준비.",
      sub: [["오늘의 날씨","현재 지역의 예보 요약"],["기온과 강수","최저·최고 기온과 비 소식"],["외출 준비","날씨에 맞는 옷차림과 준비물"],["주간 흐름","앞으로의 날씨 확인"]],
      features: [["01","지역별 예보","설정한 지역의 날씨 정보"],["02","외출 체크","강수와 기온에 맞는 준비"],["03","날씨 출처","실제 예보 데이터 확인"]]
    }
  };
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const root = document.createElement("main");
  root.id = "topicLanding";
  root.hidden = true;
  const main = document.querySelector("body > main");
  if (main) main.insertAdjacentElement("afterend", root);
  const dailyTypeLabel = Object.fromEntries(Object.entries(topics).map(([k,v])=>[k,v.label]));
  const pretty = (value, key="") => {
    if (value == null || value === "") return "";
    const labels = {morning:"아침",lunch:"점심",evening:"저녁",breakfast:"아침",dinner:"저녁",name:"동작",description:"설명",duration:"시간",menu:"메뉴",calories:"열량",song:"곡",artist:"아티스트",mood:"분위기",advice:"오늘의 조언",safetyNote:"안전 안내",nutritionNote:"영양 정보",question:"퀴즈",explanation:"해설",condition:"날씨",temperature:"기온",restaurant:"맛집",travelDestination:"여행지",accommodation:"숙소",item:"추천 항목",criteria:"선택 기준",title:"제목",summary:"요약",source:"출처",location:"지역"};
    if (Array.isArray(value)) return value.map(v=>pretty(v)).join("");
    if (typeof value === "object") return Object.entries(value).map(([k,v])=>'<div class="topic-detail-row"><b>'+esc(labels[k]||k)+'</b>'+pretty(v,k)+'</div>').join("");
    if (/^https?:\/\//.test(String(value))) return '<a href="'+esc(value)+'" target="_blank" rel="noopener">관련 정보 열기 ↗</a>';
    return '<p>'+esc(value)+'</p>';
  };
  const params = new URLSearchParams(location.search);
  const key = params.get("topic");
  function renderTopic(topicKey) {
    const topic = topics[topicKey];
    if (!topic) return false;
    const selectedSub = params.get("sub") || "";
    root.hidden = false;
    if (main) main.hidden = true;
    const nav = document.querySelector(".top nav");
    if (nav && !nav.querySelector("[data-topic-home]")) {
      const link = document.createElement("a");
      link.href = "/";
      link.textContent = "전체 홈";
      link.dataset.topicHome = "1";
      nav.prepend(link);
    }
    root.innerHTML = `
      <div class="topic-breadcrumb"><a href="/">AIDAILY</a><span>/</span><span>${esc(topic.label)}</span><a class="topic-home-link" href="/">← 전체 홈</a></div>
      <section class="topic-hero topic-hero-${esc(topicKey)}">
        <div class="topic-hero-copy"><div class="topic-eyebrow">${esc(topic.en)} · AIDAILY LIFE</div><div class="topic-symbol">${esc(topic.icon)}</div><h1>${esc(topic.title)}</h1><p>${esc(topic.intro)}</p><div class="topic-hero-meta">PERSONALIZED DAILY CONTENT <span>·</span> UPDATED EVERY DAY</div></div>
        <div class="topic-hero-art"><div class="topic-art-ring"></div><div class="topic-art-core">${esc(topic.icon)}</div><span>${esc(topic.label)}</span></div>
      </section>
      <section class="topic-subnav"><div><span class="topic-section-kicker">EXPLORE</span><h2>${esc(topic.label)} 둘러보기</h2></div><div class="topic-subnav-list">${topic.sub.map((s,i)=>'<a class="topic-subnav-item '+(selectedSub===String(i)?"active":"")+'" href="/?topic='+topicKey+'&sub='+i+'"><b>'+esc(s[0])+'</b><small>'+esc(s[1])+'</small></a>').join("")}</div></section>
      <section class="topic-features"><div class="topic-section-heading"><div><span class="topic-section-kicker">CURATED FOR YOU</span><h2>오늘의 ${esc(topic.label)} 가이드</h2></div><button class="topic-generate" id="topicGenerate">✦ 오늘 콘텐츠 생성</button></div><div class="topic-feature-grid">${topic.features.map(f=>'<article class="topic-feature"><span>'+f[0]+'</span><h3>'+esc(f[1])+'</h3><p>'+esc(f[2])+'</p></article>').join("")}</div></section>
      <section class="topic-library"><div class="topic-section-heading"><div><span class="topic-section-kicker">YOUR DAILY LIBRARY</span><h2>나의 ${esc(topic.label)} 콘텐츠</h2><p>오늘 생성한 콘텐츠와 지난 기록을 이곳에서 이어서 볼 수 있습니다.</p></div><a class="topic-all-link" href="/#daily-life">전체 라이프 보기 ↗</a></div><div id="topicContentList" class="topic-content-grid"><div class="empty">콘텐츠를 불러오는 중입니다…</div></div></section>
      <section class="topic-bottom"><div><span class="topic-section-kicker">A BETTER DAY STARTS HERE</span><h2>매일 조금 더 나은 하루를<br>만들어 보세요.</h2></div><a href="/" class="topic-home-cta">AIdaily 전체 둘러보기 ↗</a></section>`;
    root.querySelector("#topicGenerate").addEventListener("click", async () => {
      if (!window.authUser) { if (typeof openAuth==="function") openAuth("login"); return; }
      const button=root.querySelector("#topicGenerate");
      button.disabled=true;button.textContent="생성 중…";
      try {
        const result=await api("/api/daily",{method:"POST",body:JSON.stringify({type:topicKey,preferences:document.querySelector("#dailyPreferences")?.value||""})});
        toast(result.reused?"오늘 생성된 콘텐츠를 불러왔습니다.":"콘텐츠 생성 및 저장 완료");
        await loadTopicContent(topicKey);
      } catch(error) { toast(error.message); }
      finally { button.disabled=false;button.textContent="✦ 오늘 콘텐츠 생성"; }
    });
    loadTopicContent(topicKey);
    return true;
  }
  async function loadTopicContent(topicKey) {
    const target=root.querySelector("#topicContentList");
    if (!target) return;
    if (!window.authUser) { target.innerHTML='<div class="topic-empty">로그인하면 나의 콘텐츠와 생성 이력을 확인할 수 있습니다.</div>'; return; }
    try {
      const rows=await api("/api/daily");
      const filtered=rows.filter(item=>item.content_type===topicKey);
      target.innerHTML=filtered.length?filtered.map(item=>{
        const c=item.content||{};
        const teaser=Object.entries(c).filter(([k])=>!["title","summary","answer"].includes(k)).slice(0,2).map(([k,v])=>'<div class="topic-teaser"><b>'+esc(k)+'</b><span>'+esc(typeof v==="object"?Object.values(v).filter(x=>typeof x==="string").join(" · "):v)+'</span></div>').join("");
        return '<article class="topic-content-card"><div class="topic-content-meta">'+esc(dailyTypeLabel[item.content_type]||item.content_type)+' · '+esc(item.content_date)+'</div><h3>'+esc(item.title)+'</h3><p>'+esc(item.summary||"")+'</p>'+teaser+'<a href="/content/'+encodeURIComponent(item.id)+'">콘텐츠 전문 읽기 ↗</a></article>';
      }).join(""):'<div class="topic-empty">아직 저장된 콘텐츠가 없습니다. 오늘의 콘텐츠를 생성해 보세요.</div>';
    } catch(error) { target.innerHTML='<div class="topic-empty">'+esc(error.message)+'</div>'; }
  }
  if (key && renderTopic(key)) {
    const observer=new MutationObserver(()=>{if(window.authUser)loadTopicContent(key);});
    const account=document.querySelector("#accountLabel");
    if(account) observer.observe(account,{childList:true,subtree:true,characterData:true});
  } else {
    const directory=document.createElement("section");
    directory.className="topic-directory section";
    directory.id="topic-directory";
    directory.innerHTML='<div class="section-head"><div><div class="eyebrow">AIDAILY LIFE SERVICES</div><h2>나의 일상을 위한 9가지 서비스</h2><p class="muted">각 분야를 독립된 공간에서 더 깊이 탐색해 보세요.</p></div></div><div class="topic-directory-grid">'+Object.entries(topics).map(([k,v])=>'<a class="topic-directory-card" href="/?topic='+k+'"><span>'+esc(v.en)+'</span><b>'+esc(v.icon)+'　'+esc(v.label)+'</b><p>'+esc(v.intro)+'</p><i>서비스 둘러보기 ↗</i></a>').join("")+'</div>';
    const dailySection=document.querySelector("#daily-life");
    if(dailySection) dailySection.insertAdjacentElement("afterend",directory);
  }
})();
