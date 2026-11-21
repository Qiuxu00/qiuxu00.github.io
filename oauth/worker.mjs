// Standalone Decap OAuth adapter. Protocol and security references are in README.md.
// No client secret or access token is written to logs, redirects, or storage.
const COOKIE = '__Host-decap_oauth';
const SESSION_SECONDS = 600;

const safeHeaders = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

function text(message, status = 200, headers = {}) {
  return new Response(message, {
    status,
    headers: { ...safeHeaders, 'Content-Type': 'text/plain; charset=utf-8', ...headers },
  });
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function random() {
  return base64url(crypto.getRandomValues(new Uint8Array(32)));
}

function cookie(value, maxAge = SESSION_SECONDS) {
  return `${COOKIE}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

function readSession(request) {
  const values = (request.headers.get('Cookie') || '').split(';').map(value => value.trim());
  const matches = values.filter(value => value.startsWith(`${COOKIE}=`));
  if (matches.length !== 1) return null;
  try {
    return JSON.parse(decodeURIComponent(matches[0].slice(COOKIE.length + 1)));
  } catch {
    return null;
  }
}

function settings(env) {
  const origin = new URL(env.SITE_ORIGIN);
  if (origin.protocol !== 'https:' || origin.origin !== env.SITE_ORIGIN) throw new Error('Invalid site origin');
  if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(env.CONTENT_REPOSITORY || '')) throw new Error('Invalid repository');
  if (!/^[A-Za-z0-9-]+$/.test(env.ALLOWED_GITHUB_LOGIN || '')) throw new Error('Invalid account');
  if (!env.GITHUB_OAUTH_ID || !env.GITHUB_OAUTH_SECRET) throw new Error('Missing OAuth credentials');
  return { origin: origin.origin, siteId: origin.hostname };
}

// JSON is embedded in an inline script, so escape HTML delimiters as well.
function scriptLiteral(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function popup(origin, status, payload, statusCode = 200) {
  const nonce = random();
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  const page = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Academic homepage sign-in</title></head><body>
<p id="status">Completing sign-in. Keep this window open.</p>
<script nonce="${nonce}">
  const expectedOrigin = ${scriptLiteral(origin)};
  const result = ${scriptLiteral(message)};
  const opener = window.opener;
  if (!opener) {
    document.getElementById('status').textContent = 'Open the administrator page and sign in again.';
  } else {
    const receive = (event) => {
      if (event.origin !== expectedOrigin || event.source !== opener || event.data !== 'authorizing:github') return;
      window.removeEventListener('message', receive);
      opener.postMessage(result, expectedOrigin);
      document.getElementById('status').textContent = 'Return to the administrator page.';
    };
    window.addEventListener('message', receive);
    opener.postMessage('authorizing:github', expectedOrigin);
  }
</script></body></html>`;
  return new Response(page, {
    status: statusCode,
    headers: {
      ...safeHeaders,
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`,
      'Set-Cookie': cookie('', 0),
    },
  });
}

async function start(request, env, config) {
  const url = new URL(request.url);
  if (url.searchParams.get('provider') !== 'github' || url.searchParams.get('site_id') !== config.siteId) {
    return text('Start sign-in from the published homepage administrator page.', 400);
  }
  const originHeader = request.headers.get('Origin');
  if (originHeader && originHeader !== config.origin) return text('Origin not allowed.', 403);
  const state = random();
  const verifier = random();
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const session = encodeURIComponent(JSON.stringify({ state, verifier, createdAt: Date.now() }));
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.search = new URLSearchParams({
    client_id: env.GITHUB_OAUTH_ID,
    redirect_uri: `${url.origin}/callback`,
    scope: 'public_repo',
    login: env.ALLOWED_GITHUB_LOGIN,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  }).toString();
  return new Response(null, {
    status: 302,
    headers: { ...safeHeaders, Location: authorize.href, 'Set-Cookie': cookie(session) },
  });
}

async function callback(request, env, config, fetcher) {
  const url = new URL(request.url);
  const session = readSession(request);
  const age = Date.now() - session?.createdAt;
  if (!session || !/^[A-Za-z0-9_-]{43}$/.test(session.state || '') ||
      !/^[A-Za-z0-9_-]{43}$/.test(session.verifier || '') ||
      !Number.isFinite(age) || age < 0 || age > SESSION_SECONDS * 1000 ||
      url.searchParams.get('state') !== session.state) {
    return text('Sign-in expired or could not be verified. Close this window and try again.', 400, { 'Set-Cookie': cookie('', 0) });
  }
  if (url.searchParams.has('error')) {
    return popup(config.origin, 'error', { message: 'GitHub authorization was cancelled. You can try again.' });
  }
  const code = url.searchParams.get('code');
  if (!code || code.length > 512) return text('Missing authorization code.', 400, { 'Set-Cookie': cookie('', 0) });
  try {
    const exchange = await fetcher('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GITHUB_OAUTH_ID,
        client_secret: env.GITHUB_OAUTH_SECRET,
        code,
        redirect_uri: `${url.origin}/callback`,
        code_verifier: session.verifier,
      }).toString(),
      signal: AbortSignal.timeout(15000),
    });
    if (!exchange.ok) throw new Error('Exchange failed');
    const token = await exchange.json();
    if (token.error || typeof token.access_token !== 'string' || !token.access_token) throw new Error('Missing token');
    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token.access_token}`,
      'User-Agent': 'Xuhong-Qiu-Academic-Homepage',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    const identity = await fetcher('https://api.github.com/user', { headers, signal: AbortSignal.timeout(15000) });
    if (!identity.ok) throw new Error('Identity check failed');
    const user = await identity.json();
    if (typeof user.login !== 'string' || user.login.toLowerCase() !== env.ALLOWED_GITHUB_LOGIN.toLowerCase()) {
      return popup(config.origin, 'error', { message: 'This GitHub account is not the homepage administrator.' }, 403);
    }
    const access = await fetcher(`https://api.github.com/repos/${env.CONTENT_REPOSITORY}`, { headers, signal: AbortSignal.timeout(15000) });
    if (!access.ok) throw new Error('Repository check failed');
    const repository = await access.json();
    if (!repository.permissions?.push || repository.private !== false ||
        repository.full_name?.toLowerCase() !== env.CONTENT_REPOSITORY.toLowerCase()) {
      return popup(config.origin, 'error', { message: 'The administrator needs write access to the configured public homepage repository.' }, 403);
    }
    return popup(config.origin, 'success', { provider: 'github', token: token.access_token });
  } catch {
    // Never include an upstream error body: it may contain an authorization code or token.
    return popup(config.origin, 'error', { message: 'Sign-in could not be completed. Check the OAuth app and homepage repository settings, then try again.' }, 502);
  }
}

export async function handleRequest(request, env, fetcher = fetch) {
  const url = new URL(request.url);
  if (request.method !== 'GET') return text('Method not allowed.', 405, { Allow: 'GET' });
  if (url.protocol !== 'https:') return text('HTTPS is required.', 400);
  if (url.pathname === '/') return text('Homepage OAuth service is running. Sign in from your published administrator page.');
  if (!['/auth', '/callback'].includes(url.pathname)) return text('Not found.', 404);
  let config;
  try { config = settings(env); } catch { return text('The administrator must configure the OAuth service first.', 503); }
  return url.pathname === '/auth' ? start(request, env, config) : callback(request, env, config, fetcher);
}

export default { fetch: (request, env) => handleRequest(request, env) };
