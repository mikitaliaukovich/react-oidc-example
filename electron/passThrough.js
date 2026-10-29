import { net } from 'electron';

// Responses that must not carry a body (the Response constructor rejects one).
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);

function toHeaders(rawHeaders) {
  const headers = new Headers();
  for (const [name, values] of Object.entries(rawHeaders)) {
    for (const value of [].concat(values)) headers.append(name, value);
  }
  return headers;
}

// Sends a non-app http request (e.g. a plain-http IdP) to the network.
//
// Redirects are not followed here: they are handed back to Chromium, so the
// next hop comes through the protocol handler again. Otherwise a redirect to
// the app's redirect URI would go to whatever really listens on
// localhost:8080, and an http -> https hop would render under the wrong origin.
export function forwardWithoutFollowingRedirects(ses, request) {
  return new Promise((resolve, reject) => {
    const outgoing = net.request({
      session: ses,
      useSessionCookies: true,
      method: request.method,
      url: request.url,
      redirect: 'manual',
      bypassCustomProtocolHandlers: true,
    });

    request.headers.forEach((value, name) => {
      try {
        outgoing.setHeader(name, value);
      } catch {
        // Chromium manages some headers itself (Host, Content-Length, ...).
      }
    });

    outgoing.on('redirect', (statusCode, _method, location, responseHeaders) => {
      const headers = toHeaders(responseHeaders);
      headers.set('location', location);
      outgoing.abort();
      resolve(new Response(null, { status: statusCode, headers }));
    });

    outgoing.on('response', (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const body = NULL_BODY_STATUSES.has(response.statusCode) ? null : Buffer.concat(chunks);
        resolve(new Response(body, { status: response.statusCode, headers: toHeaders(response.headers) }));
      });
      response.on('error', reject);
    });

    outgoing.on('error', reject);

    request
      .arrayBuffer()
      .then((body) => {
        if (body.byteLength) outgoing.write(Buffer.from(body));
        outgoing.end();
      })
      .catch(reject);
  });
}
