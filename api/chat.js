// Vercel Serverless Function — Gemini 2.5 Flash 행운번호 추천 챗봇
// 환경변수 GEMINI_API_KEY 를 Vercel 프로젝트 설정에 등록해야 동작합니다.

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_INSTRUCTION = `당신은 한국 로또 6/45의 "행운번호" 추천 도우미입니다.
사용자의 성별과 생년월일을 바탕으로, 사주·수비학·생일 숫자 등 재미있는 관점을 섞어
1부터 45 사이의 서로 다른 번호 6개와 보너스 번호 1개(메인 번호와 겹치지 않음)를 추천합니다.
추천 이유는 따뜻하고 친근한 한국어로, 각 번호가 왜 선택됐는지 구체적으로 설명하세요.
반드시 "재미로 즐기는 추천이며 당첨을 보장하지 않는다"는 점을 한 문장으로 덧붙이세요.`;

const RECOMMEND_SCHEMA = {
  type: "OBJECT",
  properties: {
    numbers: {
      type: "ARRAY",
      items: { type: "INTEGER" },
      description: "1~45 사이 서로 다른 정수 6개",
    },
    bonus: { type: "INTEGER", description: "메인 번호와 겹치지 않는 1~45 보너스 번호" },
    reason: { type: "STRING", description: "추천 이유 설명 (한국어)" },
  },
  required: ["numbers", "bonus", "reason"],
};

async function callGemini(apiKey, body) {
  const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini API ${res.status}: ${detail}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini 응답이 비어 있습니다.");
  return text;
}

function sanitizeNumbers(numbers, bonus) {
  // 중복/범위 오류를 방어적으로 보정한다.
  const seen = new Set();
  const main = [];
  for (const n of Array.isArray(numbers) ? numbers : []) {
    const v = Math.round(Number(n));
    if (v >= 1 && v <= 45 && !seen.has(v)) {
      seen.add(v);
      main.push(v);
    }
    if (main.length === 6) break;
  }
  // 부족하면 랜덤으로 채운다.
  while (main.length < 6) {
    const v = Math.floor(Math.random() * 45) + 1;
    if (!seen.has(v)) {
      seen.add(v);
      main.push(v);
    }
  }
  main.sort((a, b) => a - b);

  let bonusNum = Math.round(Number(bonus));
  if (!(bonusNum >= 1 && bonusNum <= 45) || seen.has(bonusNum)) {
    do {
      bonusNum = Math.floor(Math.random() * 45) + 1;
    } while (seen.has(bonusNum));
  }
  return { numbers: main, bonus: bonusNum };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST 요청만 지원합니다." });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error: "서버에 GEMINI_API_KEY가 설정되지 않았습니다. Vercel 환경변수를 확인해 주세요.",
    });
    return;
  }

  try {
    const { type, gender, birthdate, history, message } = req.body || {};

    if (type === "recommend") {
      const prompt = `성별: ${gender}\n생년월일: ${birthdate}\n위 정보를 바탕으로 행운의 로또 번호를 추천해 주세요.`;
      const text = await callGemini(apiKey, {
        system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: RECOMMEND_SCHEMA,
          temperature: 1.0,
        },
      });

      const parsed = JSON.parse(text);
      const fixed = sanitizeNumbers(parsed.numbers, parsed.bonus);
      res.status(200).json({ ...fixed, reason: parsed.reason || "" });
      return;
    }

    // 후속 자유 대화
    const contents = (Array.isArray(history) ? history : []).map((m) => ({
      role: m.role === "bot" ? "model" : "user",
      parts: [{ text: String(m.text || "") }],
    }));
    contents.push({ role: "user", parts: [{ text: String(message || "") }] });

    const text = await callGemini(apiKey, {
      system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents,
      generationConfig: { temperature: 0.9 },
    });
    res.status(200).json({ reply: text });
  } catch (err) {
    res.status(500).json({ error: "추천 생성 중 오류가 발생했습니다.", detail: String(err.message || err) });
  }
}
