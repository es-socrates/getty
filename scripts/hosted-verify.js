#!/usr/bin/env node
const axios = require('axios');
const WebSocket = require('ws');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { url: '', token: '', admin: '', start: false, draw: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--url') out.url = args[++i] || '';
    else if (a === '--token') out.token = args[++i] || '';
    else if (a === '--admin') out.admin = args[++i] || '';
    else if (a === '--start') out.start = true;
    else if (a === '--draw') out.draw = true;
  }
  if (!out.url || !/^https?:\/\//i.test(out.url)) throw new Error('Missing or invalid --url');
  if (!out.token) throw new Error('Missing --token');
  return out;
}

function http(url, token, method = 'GET', data, adminTokenCookie) {
  const headers = {};
  if (adminTokenCookie) headers['Cookie'] = `getty_admin_token=${adminTokenCookie}`;
  return axios({
    url,
    method,
    data,
    headers,
    timeout: 10000,
    validateStatus: (s) => s >= 200 && s < 300,
  });
}

function toWsUrl(httpUrl) {
  return httpUrl.replace(/^http:/i, 'ws:').replace(/^https:/i, 'wss:');
}

async function verifyModules(baseUrl, token) {
  const qsToken = encodeURIComponent(token);
  const res = await http(`${baseUrl}/api/modules?widgetToken=${qsToken}`);
  const m = res.data || {};
  const lastTip = m.lastTip || {};
  const raffle = m.raffle || {};
  try {
    console.warn('modules.lastTip.active =', !!lastTip.active);
    console.warn('modules.lastTip.walletAddress =', lastTip.walletAddress ? '[set]' : '[empty]');
    console.warn('modules.lastTip.lastDonation =', lastTip.lastDonation ? '[present]' : '[none]');
    console.warn('modules.raffle =', Object.keys(raffle).length ? raffle : '[none]');
  } catch {}
}

async function wsProbe(baseUrl, token, { start, draw, admin }) {
  return new Promise((resolve) => {
    const wsUrl = `${toWsUrl(baseUrl)}/?widgetToken=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    let gotInit = false;
    let gotRaffleState = false;
    let gotWinner = false;

    const finish = (label) => {
      try {
        ws.close();
      } catch {}
      resolve(label);
    };

    ws.on('open', async () => {
      try {
        console.warn('ws: connected');
      } catch {}

      if (admin && start) {
        try {
          await http(`${baseUrl}/api/raffle/start`, token, 'POST', {}, admin);
          console.warn('raffle/start -> OK');
        } catch (e) {
          try {
            console.warn('raffle/start -> FAIL', e?.response?.status);
          } catch {}
        }
      }
      if (admin && draw) {
        setTimeout(async () => {
          try {
            await http(`${baseUrl}/api/raffle/draw`, token, 'POST', {}, admin);
            console.warn('raffle/draw -> OK');
          } catch (e) {
            try {
              console.warn('raffle/draw -> FAIL', e?.response?.status);
            } catch {}
          }
        }, 1000);
      }

      setTimeout(() => finish('timeout'), 8000);
    });

    ws.on('message', (buf) => {
      try {
        const msg = JSON.parse(String(buf));
        if (msg.type === 'init' && msg.data) {
          gotInit = true;
          const r = msg.data.raffle || {};
          const lt = msg.data.lastTip || {};
          const ld = lt && lt.lastDonation ? lt.lastDonation : lt;
          if (r) {
            try {
              console.warn('init.raffle:', {
                command: r.command,
                prize: r.prize,
                imageUrl: r.imageUrl,
                active: r.active,
                paused: r.paused,
              });
            } catch {}
          }
          if (ld)
            try {
              console.warn('init.lastTip.lastDonation:', ld);
            } catch {}
        } else if (msg.type === 'raffle_state') {
          gotRaffleState = true;
          try {
            console.warn('raffle_state:', {
              active: msg.active,
              paused: msg.paused,
              prize: msg.prize,
              imageUrl: msg.imageUrl,
              command: msg.command,
            });
          } catch {}
        } else if (msg.type === 'raffle_winner') {
          gotWinner = true;
          try {
            console.warn('raffle_winner:', {
              winner: msg.winner,
              prize: msg.prize,
              imageUrl: msg.imageUrl,
            });
          } catch {}
        }
        if (gotInit && (!start || gotRaffleState) && (!draw || gotWinner)) {
          finish('ok');
        }
      } catch {}
    });

    ws.on('error', (e) => {
      try {
        console.warn('ws error:', e?.message || e);
      } catch {}
      finish('error');
    });
  });
}

(async () => {
  try {
    const args = parseArgs();
    await verifyModules(args.url, args.token);
    const label = await wsProbe(args.url, args.token, args);
    try {
      console.warn('probe result:', label);
    } catch {}
  } catch (e) {
    console.error('verify failed:', e.message || e);
    process.exitCode = 1;
  }
})();
