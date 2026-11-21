import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { handleRequest } from './worker.mjs';

const env = {
  SITE_ORIGIN: 'https://qiuxu00.github.io',
  ALLOWED_GITHUB_LOGIN: 'Qiuxu00',
  CONTENT_REPOSITORY: 'Qiuxu00/qiuxu00.github.io',
  GITHUB_OAUTH_ID: 'test-client',
  GITHUB_OAUTH_SECRET: 'test-only-secret',
};
const host = 'https://auth.example.test';
const request = (path, options) => new Request(host + path, options);
const json = value => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
const neverFetch = () => { throw new Error('No network call should occur'); };

async function start() {
  const response = await handleRequest(request('/auth?provider=github&site_id=qiuxu00.github.io'), env, neverFetch);
  assert.equal(response.status, 302);
  const location = new URL(response.headers.get('location'));
  return { response, location, cookie: response.headers.get('set-cookie').split(';')[0] };
}

function callback(started, extra = '') {
  return request(`/callback?code=test-code&state=${started.location.searchParams.get('state')}${extra}`, {
    headers: { Cookie: started.cookie },
  });
}

function githubMock(login = 'Qiuxu00', push = true) {
  const calls = [];
  return {
    calls,
    fetcher: async (url, options) => {
      calls.push({ url, options });
      if (url === 'https://github.com/login/oauth/access_token') return json({ access_token: 'test-access-token', token_type: 'bearer', scope: 'public_repo' });
      if (url === 'https://api.github.com/user') return json({ login });
      if (url === 'https://api.github.com/repos/Qiuxu00/qiuxu00.github.io') return json({ full_name: 'Qiuxu00/qiuxu00.github.io', private: false, permissions: { push } });
      throw new Error('Unexpected upstream request');
    },
  };
}

test('login redirects only to GitHub, with PKCE and a secure short-lived cookie', async () => {
  const a = await start();
  const b = await start();
  assert.equal(a.location.origin, 'https://github.com');
  assert.equal(a.location.searchParams.get('scope'), 'public_repo');
  assert.equal(a.location.searchParams.get('redirect_uri'), host + '/callback');
  assert.equal(a.location.searchParams.get('code_challenge_method'), 'S256');
  assert.match(a.location.searchParams.get('state'), /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a.location.searchParams.get('state'), b.location.searchParams.get('state'));
  assert.match(a.response.headers.get('set-cookie'), /^__Host-decap_oauth=.*; Path=\/; Secure; HttpOnly; SameSite=Lax; Max-Age=600$/);
  assert.equal(a.response.headers.get('Cache-Control'), 'no-store');
  assert.ok(!a.location.href.includes(env.GITHUB_OAUTH_SECRET));
});

test('foreign sites, wrong providers, HTTP, and incomplete configuration fail closed', async () => {
  for (const path of ['/auth?provider=github&site_id=evil.test', '/auth?provider=gitlab&site_id=qiuxu00.github.io']) {
    assert.equal((await handleRequest(request(path), env, neverFetch)).status, 400);
  }
  assert.equal((await handleRequest(request('/auth?provider=github&site_id=qiuxu00.github.io', { headers: { Origin: 'https://evil.test' } }), env, neverFetch)).status, 403);
  assert.equal((await handleRequest(new Request('http://auth.example.test/auth'), env, neverFetch)).status, 400);
  assert.equal((await handleRequest(request('/auth'), {}, neverFetch)).status, 503);
});

test('missing, incorrect, duplicated, and expired state cookies never reach GitHub', async () => {
  const started = await start();
  let calls = 0;
  const fetcher = () => { calls++; throw new Error('Unexpected network request'); };
  const noCookie = request(`/callback?code=test-code&state=${started.location.searchParams.get('state')}`);
  const badState = request('/callback?code=test-code&state=wrong', { headers: { Cookie: started.cookie } });
  const duplicate = callback({ ...started, cookie: started.cookie + '; ' + started.cookie });
  const session = JSON.parse(decodeURIComponent(started.cookie.split('=')[1]));
  session.createdAt -= 601000;
  const expired = callback({ ...started, cookie: '__Host-decap_oauth=' + encodeURIComponent(JSON.stringify(session)) });
  for (const value of [noCookie, badState, duplicate, expired]) {
    const response = await handleRequest(value, env, fetcher);
    assert.equal(response.status, 400);
    assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  }
  assert.equal(calls, 0);
});

test('successful sign-in verifies account and repository and exchanges the matching PKCE verifier', async () => {
  const started = await start();
  const mock = githubMock();
  const response = await handleRequest(callback(started), env, mock.fetcher);
  assert.equal(response.status, 200);
  assert.equal(mock.calls.length, 3);
  const form = new URLSearchParams(mock.calls[0].options.body);
  const challenge = Buffer.from(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(form.get('code_verifier')))).toString('base64url');
  assert.equal(challenge, started.location.searchParams.get('code_challenge'));
  const html = await response.text();
  assert.ok(html.includes('test-access-token'));
  assert.ok(!html.includes(env.GITHUB_OAUTH_SECRET));
  assert.ok(!html.includes('test-code'));
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/);
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
});

test('callback releases the token only after a handshake from the exact site and opener', async () => {
  const started = await start();
  const response = await handleRequest(callback(started), env, githubMock().fetcher);
  const html = await response.text();
  const script = html.match(/<script nonce="[^"]+">([\s\S]+?)<\/script>/)[1];
  const sent = [];
  const listeners = new Map();
  const opener = { postMessage: (...args) => sent.push(args) };
  const window = {
    opener,
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: type => listeners.delete(type),
  };
  vm.runInNewContext(script, { window, document: { getElementById: () => ({ textContent: '' }) } });
  assert.deepEqual(sent, [['authorizing:github', env.SITE_ORIGIN]]);
  const receive = listeners.get('message');
  receive({ origin: 'https://evil.test', source: opener, data: 'authorizing:github' });
  receive({ origin: env.SITE_ORIGIN, source: {}, data: 'authorizing:github' });
  receive({ origin: env.SITE_ORIGIN, source: opener, data: 'unexpected' });
  assert.equal(sent.length, 1);
  receive({ origin: env.SITE_ORIGIN, source: opener, data: 'authorizing:github' });
  assert.equal(sent.length, 2);
  assert.match(sent[1][0], /^authorization:github:success:/);
  assert.equal(sent[1][1], env.SITE_ORIGIN);
  assert.ok(!listeners.has('message'));
});

test('other GitHub users and accounts without repository push permission receive no token', async () => {
  for (const mock of [githubMock('somebody-else'), githubMock('Qiuxu00', false)]) {
    const response = await handleRequest(callback(await start()), env, mock.fetcher);
    assert.equal(response.status, 403);
    assert.ok(!(await response.text()).includes('test-access-token'));
  }
});

test('cancelled authorization and upstream failures expose no secrets', async () => {
  const cancelled = await handleRequest(callback(await start(), '&error=access_denied'), env, neverFetch);
  assert.ok((await cancelled.text()).includes('authorization:github:error:'));
  const response = await handleRequest(callback(await start()), env, async () => { throw new Error('test-only-secret'); });
  assert.equal(response.status, 502);
  assert.ok(!(await response.text()).includes('test-only-secret'));
});
