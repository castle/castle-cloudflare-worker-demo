addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

/**
 * Return Castle auth request headers
 */
function generateDefaultRequestHeaders() {
  return {
    Authorization: `Basic ${btoa(`:${CASTLE_API_SECRET}`)}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Return Castle auth request body
 */
function generateRequestBody({
  event,
  user_id,
  user_traits,
  properties,
  context,
  created_at,
}) {
  return JSON.stringify({
    sent_at: new Date().toISOString(),
    created_at,
    event,
    user_id,
    user_traits,
    properties,
    context: {
      ...context,
      client_id: context.client_id || false,
      library: {
        name: 'castle-cloudflare-worker-demo',
        version: '1.0.0',
      },
    },
  });
}

/**
 * Return the result of the POST /authenticate call to Castle API
 * @param {Request} request
 */
async function authenticate(request) {
  const params = {
    /*
    List of recognized events available under:
    https://docs.castle.io/api_reference/#list-of-recognized-events
    */
    event: '$login.succeeded',
    /*
    Unique idenfifier of the logged in user as a string,
    could be also fetched from remaining request data
    */
    user_id: request.headers.get('X-Castle-User-Id'),
    /*
    Any user traits or properties for the logged in user as a JSON encoded object,
    could be also fetched from remaining request data
    */
    user_traits: JSON.parse(request.headers.get('X-Castle-User-Traits')),
    properties: JSON.parse(request.headers.get('X-Castle-Properties')),
    context: {
      ip: request.headers.get('CF-Connecting-IP'),
      locale: request.headers.get('Locale'),
      user_agent: request.headers.get('User-Agent'),
    },
  };

  const castleAuthenticateRequestUrl = `https://api.castle.io/v1/authenticate`;
  const requestOptions = {
    method: 'POST',
    headers: generateDefaultRequestHeaders(),
    body: generateRequestBody(params),
  };
  let response;
  try {
    response = await fetch(castleAuthenticateRequestUrl, requestOptions);
  } catch (err) {
    console.log(err);
  }
  return response;
}

const routes = [
  {
    pathname: '/',
    method: 'GET',
    handler: authenticate,
  },
  {
    pathname: '/users/sign_in',
    method: 'POST',
    handler: authenticate,
  },
];

/**
 * Return matched action or undefined
 * @param {Request} request
 */
async function matchRequest(request) {
  const requestUrl = new URL(request.url);
  for (const route of routes) {
    if (
      requestUrl.pathname === route.pathname &&
      request.method === route.method
    ) {
      return await route.handler(request);
    }
  }
}

/**
 * Respond with hello worker text
 * @param {Request} request
 */
async function handleRequest(request) {
  if (!CASTLE_API_SECRET) {
    throw new Error('CASTLE_API_SECRET secret not provided');
  }

  await matchRequest(request);

  return new Response('Hello worker!', {
    headers: { 'content-type': 'text/plain' },
  });
}
