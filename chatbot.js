// AI 행운번호 추천 챗봇 — /api/chat (Gemini 2.5 Flash) 호출
(function () {
  const formEl = document.getElementById("aiForm");
  const genderEl = document.getElementById("aiGender");
  const birthEl = document.getElementById("aiBirth");
  const submitEl = document.getElementById("aiSubmit");
  const chatEl = document.getElementById("aiChat");
  const followFormEl = document.getElementById("aiFollowForm");
  const followInputEl = document.getElementById("aiFollowInput");
  const followSubmitEl = document.getElementById("aiFollowSubmit");

  if (!formEl) return;

  // 대화 기록 (후속 질문 시 맥락 유지)
  const history = [];

  function rangeClass(num) {
    if (num <= 10) return "range-1";
    if (num <= 20) return "range-2";
    if (num <= 30) return "range-3";
    if (num <= 40) return "range-4";
    return "range-5";
  }

  function scrollChat() {
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function addBubble(role, html) {
    const bubble = document.createElement("div");
    bubble.className = `ai-bubble ai-bubble--${role}`;
    bubble.innerHTML = html;
    chatEl.appendChild(bubble);
    scrollChat();
    return bubble;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
    );
  }

  // AI가 HTML 태그로 답해도 깔끔한 일반 텍스트로 변환 (안전망)
  function htmlToText(str) {
    let s = String(str || "");
    s = s.replace(/<li[^>]*>/gi, "\n• ");
    s = s.replace(/<br\s*\/?>/gi, "\n");
    s = s.replace(/<\/(p|li|ul|ol|div|h[1-6])>/gi, "\n");
    s = s.replace(/<[^>]+>/g, ""); // 남은 태그 제거
    s = s
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&");
    return s.replace(/\n{3,}/g, "\n\n").trim();
  }

  // 안전망 변환 후 화면에 표시할 HTML로 (이스케이프 + 줄바꿈)
  function toReasonHtml(str) {
    return escapeHtml(htmlToText(str)).replace(/\n/g, "<br>");
  }

  function addTyping() {
    return addBubble(
      "bot",
      '<span class="ai-typing"><span></span><span></span><span></span></span>'
    );
  }

  function renderBalls(numbers, bonus) {
    const main = numbers
      .map((n) => `<span class="mini-ball ${rangeClass(n)}">${n}</span>`)
      .join("");
    const bonusBall =
      bonus != null ? `<span class="mini-ball bonus-mini">+${bonus}</span>` : "";
    return `<div class="ai-balls">${main}${bonusBall}</div>`;
  }

  async function postChat(payload) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `요청 실패 (${res.status})`);
    }
    return data;
  }

  async function handleRecommend(event) {
    event.preventDefault();
    if (!genderEl.value || !birthEl.value) return;

    const gender = genderEl.value;
    const birthdate = birthEl.value;

    submitEl.disabled = true;
    submitEl.textContent = "추천 중…";

    addBubble(
      "user",
      `성별 <strong>${escapeHtml(gender)}</strong> · 생년월일 <strong>${escapeHtml(birthdate)}</strong> 으로 추천받기`
    );
    const typing = addTyping();

    try {
      const data = await postChat({ type: "recommend", gender, birthdate });
      typing.remove();

      const html = `${renderBalls(data.numbers, data.bonus)}<p class="ai-reason">${toReasonHtml(data.reason)}</p>`;
      addBubble("bot", html);

      // 후속 대화용 맥락 저장
      history.push({
        role: "user",
        text: `성별 ${gender}, 생년월일 ${birthdate} 기반 행운번호를 추천해줘.`,
      });
      history.push({
        role: "bot",
        text: `추천 번호: ${data.numbers.join(", ")} + 보너스 ${data.bonus}. 이유: ${data.reason}`,
      });

      followFormEl.classList.remove("hidden");
    } catch (err) {
      typing.remove();
      addBubble("bot", `<p class="ai-reason ai-error">⚠️ ${escapeHtml(err.message)}</p>`);
    } finally {
      submitEl.disabled = false;
      submitEl.textContent = "다시 추천받기";
    }
  }

  async function handleFollowup(event) {
    event.preventDefault();
    const text = followInputEl.value.trim();
    if (!text) return;

    followInputEl.value = "";
    followSubmitEl.disabled = true;

    addBubble("user", escapeHtml(text));
    const typing = addTyping();

    try {
      const data = await postChat({ type: "chat", history, message: text });
      typing.remove();
      addBubble("bot", `<p class="ai-reason">${toReasonHtml(data.reply)}</p>`);

      history.push({ role: "user", text });
      history.push({ role: "bot", text: data.reply });
    } catch (err) {
      typing.remove();
      addBubble("bot", `<p class="ai-reason ai-error">⚠️ ${escapeHtml(err.message)}</p>`);
    } finally {
      followSubmitEl.disabled = false;
      followInputEl.focus();
    }
  }

  formEl.addEventListener("submit", handleRecommend);
  followFormEl.addEventListener("submit", handleFollowup);
})();
