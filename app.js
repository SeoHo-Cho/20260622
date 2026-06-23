const MIN = 1;
const MAX = 45;
const COUNT = 6;

const ballsEl = document.getElementById("balls");
const bonusRowEl = document.getElementById("bonusRow");
const bonusBallEl = document.getElementById("bonusBall");
const drawStatusEl = document.getElementById("drawStatus");
const broadcastRoundEl = document.getElementById("broadcastRound");
const broadcastLiveEl = document.getElementById("broadcastLive");
const machineDrumEl = document.getElementById("machineDrum");
const drumInnerEl = document.getElementById("drumInner");
const chuteBallEl = document.getElementById("chuteBall");
const drawBroadcastEl = document.getElementById("drawBroadcast");
const drawBtn = document.getElementById("drawBtn");
const drawBtnTop = document.getElementById("drawBtnTop");
const copyBtn = document.getElementById("copyBtn");
const clearBtn = document.getElementById("clearBtn");
const includeBonusEl = document.getElementById("includeBonus");
const setCountEl = document.getElementById("setCount");
const historyListEl = document.getElementById("historyList");
const historyCountEl = document.getElementById("historyCount");
const roundInputEl = document.getElementById("roundInput");
const roundSearchBtn = document.getElementById("roundSearchBtn");
const roundPrevBtn = document.getElementById("roundPrevBtn");
const roundNextBtn = document.getElementById("roundNextBtn");
const winnerResultEl = document.getElementById("winnerResult");
const winnerLatestLabelEl = document.getElementById("winnerLatestLabel");

const LOTTO_DATA_URL = "https://smok95.github.io/lotto/results/all.json";
const DHLOTTERY_URL =
  "https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=";
const DRAWS_API_URL = "/api/draws";

let lottoDataMap = null;
let lottoMaxRound = 0;
let currentRound = null;
let isLoadingRound = false;

const ballEls = [...ballsEl.querySelectorAll(".ball")];
const DRUM_BALL_COUNT = 32;
let drumShuffleTimer = null;
let history = [];
let latestResult = null;
let isDrawing = false;

function getBallRangeClass(num) {
  if (num <= 10) return "range-1";
  if (num <= 20) return "range-2";
  if (num <= 30) return "range-3";
  if (num <= 40) return "range-4";
  return "range-5";
}

function pickNumbers(count, exclude = new Set()) {
  const pool = [];
  for (let i = MIN; i <= MAX; i++) {
    if (!exclude.has(i)) pool.push(i);
  }

  if (pool.length < count) {
    throw new Error("Not enough numbers available");
  }

  const result = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool[idx]);
    pool.splice(idx, 1);
  }

  return result.sort((a, b) => a - b);
}

function generateSet(includeBonus) {
  const main = pickNumbers(COUNT);
  let bonus = null;

  if (includeBonus) {
    const exclude = new Set(main);
    bonus = pickNumbers(1, exclude)[0];
  }

  return { main, bonus };
}

function resetBall(el) {
  el.className = "ball placeholder";
  el.textContent = "?";
}

function setBall(el, num) {
  el.className = `ball ${getBallRangeClass(num)} revealed`;
  el.textContent = num;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setDrawStatus(message) {
  if (drawStatusEl) drawStatusEl.textContent = message;
}

function setBroadcastRound(message) {
  if (broadcastRoundEl) broadcastRoundEl.textContent = message;
}

function setBroadcastLive(active) {
  if (!broadcastLiveEl) return;
  broadcastLiveEl.classList.toggle("broadcast-live--idle", !active);
  broadcastLiveEl.textContent = active ? "LIVE" : "STBY";
}

function shuffleDrumBallNumbers() {
  if (!drumInnerEl) return;
  drumInnerEl.querySelectorAll(".drum-ball").forEach((ball) => {
    if (Math.random() > 0.4) return;
    const num = Math.floor(Math.random() * MAX) + MIN;
    ball.textContent = num;
    ball.className = `drum-ball ${getBallRangeClass(num)}`;
  });
}

function populateDrumBalls() {
  if (!drumInnerEl) return;
  drumInnerEl.innerHTML = "";

  for (let i = 0; i < DRUM_BALL_COUNT; i++) {
    const num = Math.floor(Math.random() * MAX) + MIN;
    const mini = document.createElement("span");
    mini.className = `drum-ball ${getBallRangeClass(num)}`;
    mini.textContent = num;

    const radius = 24 + Math.random() * 58;
    const angle = Math.random() * 360;
    const size = 20 + Math.random() * 16;
    const orbitDur = 0.22 + Math.random() * 0.38;
    const wobbleDur = 0.12 + Math.random() * 0.2;
    const direction = Math.random() > 0.5 ? "normal" : "reverse";

    mini.style.setProperty("--radius", `${radius}px`);
    mini.style.setProperty("--angle", `${angle}deg`);
    mini.style.setProperty("--size", `${size}px`);
    mini.style.setProperty("--orbit-dur", `${orbitDur}s`);
    mini.style.setProperty("--wobble-dur", `${wobbleDur}s`);
    mini.style.setProperty("--orbit-dir", direction);
    mini.style.setProperty("--delay", `${-(angle / 360) * orbitDur}s`);
    drumInnerEl.appendChild(mini);
  }
}

function startDrum() {
  populateDrumBalls();
  machineDrumEl?.classList.add("is-spinning");
  drawBroadcastEl?.classList.add("is-drawing");

  if (drumShuffleTimer) clearInterval(drumShuffleTimer);
  drumShuffleTimer = setInterval(shuffleDrumBallNumbers, 55);
}

function stopDrum() {
  machineDrumEl?.classList.remove("is-spinning");
  if (drumShuffleTimer) {
    clearInterval(drumShuffleTimer);
    drumShuffleTimer = null;
  }
}

function hideChuteBall() {
  chuteBallEl.className = "chute-ball hidden";
  chuteBallEl.textContent = "";
}

function showChuteBall(num) {
  chuteBallEl.className = `chute-ball ${getBallRangeClass(num)} is-dropping`;
  chuteBallEl.textContent = num;
}

async function animateChuteDrop(num, slotEl) {
  showChuteBall(num);
  await sleep(560);
  chuteBallEl.classList.remove("is-dropping");
  chuteBallEl.classList.add("is-landed");
  await sleep(380);
  hideChuteBall();
  slotEl.classList.add("ball-slot--filled");
  setBall(slotEl.querySelector(".ball"), num);
  await sleep(400);
  slotEl.classList.remove("ball-slot--filled");
}

async function animateDraw(result) {
  document.getElementById("draw")?.scrollIntoView({ behavior: "smooth", block: "start" });

  ballEls.forEach(resetBall);
  ballsEl.querySelectorAll(".ball-slot").forEach((slot) => {
    slot.classList.remove("ball-slot--active", "ball-slot--filled");
  });

  bonusRowEl.classList.toggle("hidden", result.bonus === null);
  bonusRowEl.classList.remove("is-revealing");
  if (result.bonus !== null) {
    resetBall(bonusBallEl);
  }

  hideChuteBall();
  setBroadcastLive(true);
  setBroadcastRound("번호 추첨 진행 중");
  setDrawStatus("추첨기 가동 중… 공이 섞이고 있습니다");

  startDrum();
  await sleep(1400);

  for (let i = 0; i < result.main.length; i++) {
    const slotEl = ballsEl.querySelector(`.ball-slot[data-index="${i}"]`);
    const ballEl = ballEls[i];

    ballsEl.querySelectorAll(".ball-slot").forEach((slot) => {
      slot.classList.toggle("ball-slot--active", slot === slotEl);
    });

    setDrawStatus(`${i + 1}번째 번호 추첨 중`);
    setBroadcastRound(`${i + 1} / 6`);
    startDrum();
    await sleep(900 + Math.random() * 400);

    stopDrum();
    setDrawStatus(`${i + 1}번째 당첨번호 발표`);
    await animateChuteDrop(result.main[i], slotEl);
    ballEl.classList.add("just-revealed");
    await sleep(200);
    ballEl.classList.remove("just-revealed");
  }

  ballsEl.querySelectorAll(".ball-slot").forEach((slot) => {
    slot.classList.remove("ball-slot--active");
  });

  if (result.bonus !== null) {
    setDrawStatus("보너스 번호 추첨 중");
    setBroadcastRound("보너스");
    bonusRowEl.classList.remove("hidden");
    bonusRowEl.classList.add("is-revealing");
    await sleep(600);

    startDrum();
    await sleep(1200);
    stopDrum();

    setDrawStatus("보너스 번호 발표");
    showChuteBall(result.bonus);
    chuteBallEl.classList.add("is-bonus");
    await sleep(560);
    chuteBallEl.classList.remove("is-dropping");
    chuteBallEl.classList.add("is-landed");
    await sleep(380);
    hideChuteBall();
    chuteBallEl.classList.remove("is-bonus");

    bonusBallEl.className = `ball bonus ${getBallRangeClass(result.bonus)} revealed`;
    bonusBallEl.textContent = result.bonus;
    await sleep(500);
  }

  stopDrum();
  drawBroadcastEl?.classList.remove("is-drawing");
  setBroadcastRound("추첨 완료");
  setDrawStatus(
    result.bonus !== null
      ? `당첨번호 ${result.main.join(" · ")} + 보너스 ${result.bonus}`
      : `당첨번호 ${result.main.join(" · ")}`
  );
  await sleep(300);
  setBroadcastLive(false);
}

function formatTime(date) {
  return date.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatNumbersForCopy(result) {
  let text = result.main.join(", ");
  if (result.bonus !== null) {
    text += ` + 보너스 ${result.bonus}`;
  }
  return text;
}

function renderHistory() {
  historyCountEl.textContent = `${history.length}세트`;

  if (history.length === 0) {
    historyListEl.innerHTML =
      '<li class="history-empty">아직 추첨 기록이 없습니다. 추첨하기를 눌러보세요!</li>';
    copyBtn.disabled = true;
    return;
  }

  copyBtn.disabled = false;
  historyListEl.innerHTML = history
    .map((entry, idx) => {
      const balls = entry.main
        .map(
          (n) =>
            `<span class="mini-ball ${getBallRangeClass(n)}">${n}</span>`
        )
        .join("");

      const bonus =
        entry.bonus !== null
          ? `<span class="mini-ball bonus-mini">+${entry.bonus}</span>`
          : "";

      return `
        <li class="history-item">
          <span class="history-index">#${history.length - idx}</span>
          <div class="history-numbers">${balls}${bonus}</div>
          <span class="history-time">${formatTime(entry.time)}</span>
        </li>
      `;
    })
    .join("");
}

function formatCurrency(amount) {
  if (amount == null || Number.isNaN(amount)) return "-";
  return `${amount.toLocaleString("ko-KR")}원`;
}

function formatDrawDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getFirstDivision(divisions = []) {
  const valid = divisions.filter((d) => d.prize && d.winners);
  if (!valid.length) return null;
  return valid.reduce((best, item) => (item.prize > best.prize ? item : best));
}

function renderMiniBalls(numbers, bonus) {
  const main = numbers
    .map((n) => `<span class="mini-ball ${getBallRangeClass(n)}">${n}</span>`)
    .join("");
  const bonusBall = bonus
    ? `<span class="mini-ball bonus-mini">+${bonus}</span>`
    : "";
  return `${main}${bonusBall}`;
}

function normalizeLottoEntry(entry) {
  const first = getFirstDivision(entry.divisions);
  return {
    round: entry.draw_no,
    date: entry.date,
    main: entry.numbers,
    bonus: entry.bonus_no,
    firstPrize: first?.prize ?? null,
    firstWinners: first?.winners ?? null,
  };
}

function normalizeDhlotteryEntry(data) {
  if (data.returnValue !== "success") return null;

  const main = [
    data.drwtNo1,
    data.drwtNo2,
    data.drwtNo3,
    data.drwtNo4,
    data.drwtNo5,
    data.drwtNo6,
  ].sort((a, b) => a - b);

  return {
    round: data.drwNo,
    date: data.drwNoDate,
    main,
    bonus: data.bnusNo,
    firstPrize: data.firstWinamnt ?? null,
    firstWinners: data.firstPrzwnerCo ?? null,
  };
}

async function loadLottoData() {
  if (lottoDataMap) return lottoDataMap;

  const response = await fetch(LOTTO_DATA_URL);
  if (!response.ok) {
    throw new Error("Failed to load lotto data");
  }

  const list = await response.json();
  lottoDataMap = new Map(list.map((entry) => [entry.draw_no, entry]));
  lottoMaxRound = list[list.length - 1]?.draw_no ?? 0;
  winnerLatestLabelEl.textContent = lottoMaxRound
    ? `최신 ${lottoMaxRound}회`
    : "";

  return lottoDataMap;
}

async function fetchRoundFromApi(round) {
  const response = await fetch(`${DHLOTTERY_URL}${round}`);
  if (!response.ok) return null;

  const data = await response.json();
  return normalizeDhlotteryEntry(data);
}

async function fetchRoundData(round) {
  await loadLottoData();

  const cached = lottoDataMap.get(round);
  if (cached) {
    return normalizeLottoEntry(cached);
  }

  if (round > lottoMaxRound) {
    try {
      const latest = await fetchRoundFromApi(round);
      if (latest) return latest;
    } catch {
      /* dhlottery API may be blocked by CORS in browser */
    }
  }

  return null;
}

function updateRoundNavButtons() {
  roundPrevBtn.disabled = !currentRound || currentRound <= 1 || isLoadingRound;
  roundNextBtn.disabled =
    !currentRound || currentRound >= lottoMaxRound || isLoadingRound;
}

function renderWinnerLoading() {
  winnerResultEl.innerHTML =
    '<p class="winner-placeholder winner-loading">당첨 정보를 불러오는 중...</p>';
}

function renderWinnerError(message) {
  winnerResultEl.innerHTML = `<p class="winner-placeholder winner-error">${message}</p>`;
  updateRoundNavButtons();
}

function renderWinnerResult(data) {
  winnerResultEl.innerHTML = `
    <div class="winner-card">
      <div class="winner-meta">
        <span class="winner-round">${data.round}회</span>
        <span class="winner-date">${formatDrawDate(data.date)}</span>
      </div>
      <div class="winner-numbers">${renderMiniBalls(data.main, data.bonus)}</div>
      <div class="winner-prize-grid">
        <div class="winner-prize-item">
          <span class="winner-prize-label">1등 당첨금</span>
          <strong class="winner-prize-value">${formatCurrency(data.firstPrize)}</strong>
        </div>
        <div class="winner-prize-item">
          <span class="winner-prize-label">1등 당첨자</span>
          <strong class="winner-prize-value">${data.firstWinners != null ? `${data.firstWinners.toLocaleString("ko-KR")}명` : "-"}</strong>
        </div>
      </div>
    </div>
  `;
  updateRoundNavButtons();
}

async function lookupRound(round) {
  if (!Number.isInteger(round) || round < 1) {
    renderWinnerError("올바른 회차 번호를 입력해 주세요.");
    return;
  }

  isLoadingRound = true;
  roundSearchBtn.disabled = true;
  roundPrevBtn.disabled = true;
  roundNextBtn.disabled = true;
  renderWinnerLoading();

  try {
    const data = await fetchRoundData(round);
    if (!data) {
      currentRound = null;
      renderWinnerError(`${round}회 당첨 정보를 찾을 수 없습니다.`);
      return;
    }

    currentRound = data.round;
    roundInputEl.value = String(data.round);
    renderWinnerResult(data);
  } catch {
    currentRound = null;
    renderWinnerError("당첨 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
  } finally {
    isLoadingRound = false;
    roundSearchBtn.disabled = false;
    updateRoundNavButtons();
  }
}

async function handleRoundSearch() {
  const round = parseInt(roundInputEl.value, 10);
  await lookupRound(round);
}

async function initWinnerLookup() {
  try {
    await loadLottoData();
    await lookupRound(lottoMaxRound);
  } catch {
    winnerLatestLabelEl.textContent = "";
    renderWinnerError("역대 당첨 데이터를 불러오지 못했습니다.");
  }
}

function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => toast.classList.remove("show"), 2000);
}

// Supabase(서버리스 함수 /api/draws)에 추첨 세트를 저장한다.
async function saveDrawsToSupabase(sets) {
  try {
    const res = await fetch(DRAWS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sets: sets.map((s) => ({ numbers: s.main, bonus: s.bonus })),
      }),
    });
    if (!res.ok) throw new Error(`save failed: ${res.status}`);
  } catch (err) {
    // 저장 실패해도 추첨 자체는 정상 동작하도록 조용히 처리한다.
    console.warn("추첨 기록 저장 실패:", err);
    showToast("추첨 기록을 서버에 저장하지 못했습니다.");
  }
}

// 페이지 진입 시 최근 저장된 추첨 기록을 불러온다.
async function loadDrawsFromSupabase() {
  try {
    const res = await fetch(`${DRAWS_API_URL}?limit=50`);
    if (!res.ok) throw new Error(`load failed: ${res.status}`);

    const data = await res.json();
    const draws = Array.isArray(data?.draws) ? data.draws : [];
    history = draws.map((d) => ({
      main: d.numbers,
      bonus: d.bonus ?? null,
      time: new Date(d.created_at),
    }));
    latestResult = history[0] ?? null;
    renderHistory();
  } catch (err) {
    // 서버 연동 전(로컬 파일 직접 열기 등)에는 조용히 넘어간다.
    console.warn("추첨 기록 불러오기 실패:", err);
  }
}

async function handleDraw() {
  if (isDrawing) return;

  isDrawing = true;
  drawBtn.disabled = true;
  drawBtnTop.disabled = true;
  copyBtn.disabled = true;

  const includeBonus = includeBonusEl.checked;
  const setCount = parseInt(setCountEl.value, 10);
  const newSets = [];

  for (let i = 0; i < setCount; i++) {
    newSets.push({ ...generateSet(includeBonus), time: new Date() });
  }

  latestResult = newSets[0];
  await animateDraw(latestResult);

  history = [...newSets, ...history].slice(0, 50);
  renderHistory();

  saveDrawsToSupabase(newSets);

  isDrawing = false;
  drawBtn.disabled = false;
  drawBtnTop.disabled = false;
}

async function handleCopy() {
  if (!latestResult) return;

  const lines = history
    .slice(0, parseInt(setCountEl.value, 10))
    .map((entry, i) => `${i + 1}. ${formatNumbersForCopy(entry)}`);

  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    showToast("클립보드에 복사되었습니다!");
  } catch {
    showToast("복사에 실패했습니다.");
  }
}

function handleClear() {
  history = [];
  latestResult = null;
  ballEls.forEach(resetBall);
  bonusRowEl.classList.add("hidden");
  bonusRowEl.classList.remove("is-revealing");
  stopDrum();
  hideChuteBall();
  drawBroadcastEl?.classList.remove("is-drawing");
  setBroadcastLive(false);
  setBroadcastRound("추첨 준비");
  setDrawStatus("추첨하기 버튼을 눌러 주세요");
  renderHistory();
  showToast("기록을 지웠습니다.");
}

drawBtn.addEventListener("click", handleDraw);
drawBtnTop.addEventListener("click", handleDraw);
copyBtn.addEventListener("click", handleCopy);
clearBtn.addEventListener("click", handleClear);
roundSearchBtn.addEventListener("click", handleRoundSearch);
roundPrevBtn.addEventListener("click", () => {
  if (currentRound > 1) lookupRound(currentRound - 1);
});
roundNextBtn.addEventListener("click", () => {
  if (currentRound < lottoMaxRound) lookupRound(currentRound + 1);
});
roundInputEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") handleRoundSearch();
});

includeBonusEl.addEventListener("change", () => {
  bonusRowEl.classList.toggle("hidden", !includeBonusEl.checked);
});

populateDrumBalls();
setBroadcastLive(false);

renderHistory();
loadDrawsFromSupabase();
initWinnerLookup();
