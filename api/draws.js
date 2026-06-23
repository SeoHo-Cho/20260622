// Vercel Serverless Function — 추첨한 로또 번호를 Supabase 에 저장/조회
//
// 필요한 Vercel 환경변수:
//   SUPABASE_URL              예) https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY Supabase 대시보드 → Project Settings → API → service_role 키
//
// service_role 키는 RLS 를 우회하므로 절대 브라우저로 노출하지 마세요.
// (이 함수는 서버에서만 실행되므로 안전합니다.)

const TABLE = "lotto_draws";

function getConfig() {
  // 환경변수에 끼어든 공백/줄바꿈/따옴표/끝 슬래시를 모두 제거한다.
  const url = (process.env.SUPABASE_URL || "").trim().replace(/^["']|["']$/g, "").replace(/\/+$/, "");
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다."
    );
  }
  return { url, key };
}

function supabaseHeaders(key, extra = {}) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

// 1~45 범위의 서로 다른 정수 배열인지 방어적으로 검증/정규화한다.
function sanitizeNumbers(numbers) {
  const seen = new Set();
  const main = [];
  for (const n of Array.isArray(numbers) ? numbers : []) {
    const v = Math.round(Number(n));
    if (v >= 1 && v <= 45 && !seen.has(v)) {
      seen.add(v);
      main.push(v);
    }
  }
  return main.length === 6 ? main.sort((a, b) => a - b) : null;
}

function sanitizeBonus(bonus, main) {
  if (bonus === null || bonus === undefined || bonus === "") return null;
  const v = Math.round(Number(bonus));
  if (v >= 1 && v <= 45 && !main.includes(v)) return v;
  return null;
}

// 클라이언트가 보낸 추첨 세트 목록을 DB 행으로 변환한다.
function buildRows(body) {
  const rawSets = Array.isArray(body?.sets)
    ? body.sets
    : body?.numbers
    ? [{ numbers: body.numbers, bonus: body.bonus }]
    : [];

  const rows = [];
  for (const set of rawSets) {
    const numbers = sanitizeNumbers(set?.numbers);
    if (!numbers) continue; // 잘못된 세트는 건너뛴다.
    rows.push({ numbers, bonus: sanitizeBonus(set?.bonus, numbers) });
  }
  return rows;
}

async function insertDraws(config, rows) {
  const res = await fetch(`${config.url}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: supabaseHeaders(config.key, { Prefer: "return=representation" }),
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    throw new Error(`Supabase insert ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function fetchRecentDraws(config, limit) {
  const params = new URLSearchParams({
    select: "id,numbers,bonus,created_at",
    order: "created_at.desc",
    limit: String(limit),
  });
  const res = await fetch(`${config.url}/rest/v1/${TABLE}?${params}`, {
    headers: supabaseHeaders(config.key),
  });
  if (!res.ok) {
    throw new Error(`Supabase select ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  let config;
  try {
    config = getConfig();
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
    return;
  }

  try {
    if (req.method === "POST") {
      const rows = buildRows(req.body);
      if (rows.length === 0) {
        res.status(400).json({ error: "저장할 유효한 번호 세트가 없습니다." });
        return;
      }
      const saved = await insertDraws(config, rows);
      res.status(201).json({ draws: saved });
      return;
    }

    if (req.method === "GET") {
      const raw = parseInt(req.query?.limit, 10);
      const limit = Number.isInteger(raw) ? Math.min(Math.max(raw, 1), 50) : 20;
      const draws = await fetchRecentDraws(config, limit);
      res.status(200).json({ draws });
      return;
    }

    res.status(405).json({ error: "GET 또는 POST 요청만 지원합니다." });
  } catch (err) {
    res.status(500).json({
      error: "추첨 기록 처리 중 오류가 발생했습니다.",
      detail: String(err.message || err),
    });
  }
}
