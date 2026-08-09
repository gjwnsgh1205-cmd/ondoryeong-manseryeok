/* ============================================================
   bbanana.js — 빠나나 AI 로 영상을 만든다.

   엔드포인트는 MCP 인데 세션을 잡지 않고 단발 tools/call 로 동작한다.
   응답이 text/event-stream 이라 `data: ` 접두어를 벗겨야 JSON 이 나온다.

   함정 하나. `get_status` 는 "Generation status updated." 만 돌려주고 결과 URL 을 안 준다.
   **결과 URL 은 `list_my_generations` 에서 taskId 로 찾아야 한다.**

   키는 ~/.api-keys 에 있다. 이 저장소는 공개라 절대 커밋하지 않는다.

   쓰는 법:
     node tools/bbanana.js credits
     node tools/bbanana.js models video
     node tools/bbanana.js gen <이미지URL> "<프롬프트>" [초] [파일이름]
     node tools/bbanana.js poll <taskId>
   ============================================================ */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const ENDPOINT = 'https://www.bbanana.ai/mcp';

function apiKey() {
  const f = path.join(os.homedir(), '.api-keys');
  const line = fs.readFileSync(f, 'utf8').split('\n')
    .find((l) => l.trim().startsWith('BBANANA_API_KEY'));
  if (!line) throw new Error('~/.api-keys 에 BBANANA_API_KEY 가 없다');
  return line.split('=').slice(1).join('=').trim().replace(/^["']|["']$/g, '');
}

/* 응답이 SSE 다. data: 줄만 모아 마지막 JSON 을 돌려준다. */
function parseSSE(text) {
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const body = line.slice(5).trim();
    if (!body || body === '[DONE]') continue;
    try { out.push(JSON.parse(body)); } catch { /* 조각은 건너뛴다 */ }
  }
  return out[out.length - 1] || null;
}

async function call(tool, args) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { name: tool, arguments: args || {} },
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${tool} ${res.status}: ${text.slice(0, 300)}`);
  const msg = parseSSE(text) || (() => { try { return JSON.parse(text); } catch { return null; } })();
  if (!msg) throw new Error(`${tool}: 응답을 못 읽었다 — ${text.slice(0, 200)}`);
  if (msg.error) throw new Error(`${tool}: ${JSON.stringify(msg.error).slice(0, 300)}`);
  const c = msg.result && msg.result.content;
  if (Array.isArray(c)) {
    const t = c.map((x) => x.text || '').join('\n');
    try { return JSON.parse(t); } catch { return t; }
  }
  return msg.result;
}

/* 만든 결과의 URL 을 찾는다. get_status 로는 안 나온다. */
async function findResult(taskId) {
  const list = await call('list_my_generations', { limit: 30 });
  const rows = Array.isArray(list) ? list : (list && (list.generations || list.data || list.items)) || [];
  const hit = rows.find((r) => String(r.taskId || r.task_id || r.id) === String(taskId));
  if (!hit) return null;
  return hit.resultUrl || hit.result_url || hit.url || hit.outputUrl
      || (Array.isArray(hit.outputs) && hit.outputs[0]) || null;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'credits') {
    console.log(JSON.stringify(await call('check_credits', {}), null, 1));
    return;
  }
  if (cmd === 'models') {
    const r = await call('list_models', { modality: rest[0] || 'video' });
    console.log(JSON.stringify(r, null, 1).slice(0, 3000));
    return;
  }
  if (cmd === 'gen') {
    const [imageUrl, prompt, sec, name] = rest;
    if (!imageUrl || !prompt) { console.error('gen <이미지URL> "<프롬프트>" [초] [이름]'); process.exit(1); }
    /* 모델 이름은 list_models 가 주는 service_name 그대로다("Seedance 2.0").
       mini 는 모델이 아니라 **티어**다 — 'seedance-2.0-mini' 로 부르면
       "Unknown model" 이 돌아온다. 한 번 걸렸다.
       mini 720p 는 초당 2크레딧이라 5초에 10크레딧이다. */
    const r = await call('generate_video', {
      model: 'Seedance 2.0',
      tier: 'mini',
      prompt,
      duration: Number(sec) || 5,
      quality: '720p',
      aspect_ratio: '9:16',
      image_urls: [imageUrl],
    });
    console.log(JSON.stringify({ name: name || '', started: r }, null, 1));
    return;
  }
  if (cmd === 'poll') {
    const id = rest[0];
    await call('get_status', { taskId: id }).catch(() => null);
    const url = await findResult(id);
    console.log(url ? url : '(아직 안 나왔다)');
    return;
  }
  if (cmd === 'list') {
    const r = await call('list_my_generations', { limit: Number(rest[0]) || 10 });
    console.log(JSON.stringify(r, null, 1).slice(0, 4000));
    return;
  }
  console.error('credits | models [video|image] | gen | poll <taskId> | list [n]');
  process.exit(1);
}

if (require.main === module) main().catch((e) => { console.error(e.message); process.exit(1); });
module.exports = { call, findResult };
