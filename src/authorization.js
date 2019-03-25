const Cookie = require('cookie');
const jwt = require('jsonwebtoken');
const url = require('url');

jwt.verifyAsync = (token, jwtKey) => new Promise((resolve, reject) => {
  jwt.verify(token, jwtKey, { complete: true }, (err, decoded) => {
    if (err) {
      return reject(err);
    }
    return resolve(decoded);
  });
});

async function authorize(req, jwtKey, publishAllowedOrigins = []) {
  const authHeader = req.headers['authorization'];

  let token;

  if (authHeader) {
    const match = /^Bearer (.*)/.exec(authHeader);
    if (!match || !(token = match[1])) {
      throw new Error('Invalid "Authorization" header.');
    }

    return await jwt.verifyAsync(token, jwtKey);
  }

  const cookie = Cookie.parse(req.headers.cookie || '');
  if (!cookie || !(token = cookie.mercureAuthorization)) {
    // Anonymous.
    return false;
  }

  // CSRF attacks cannot occur when using safe methods.
  if (req.method !== 'POST') {
    return await jwt.verifyAsync(token, jwtKey);
  }

  // Check 'Origin' & 'Referer' against publishAllowedOrigins
  let origin = req.headers['origin'];
  if (!origin) {
    const referer = req.headers['referer'];
    if (!referer) {
      throw new Error('An "Origin" or a "Referer" HTTP header must be present to use the cookie-based authorization mechanism');
    }

    const parsedReferer = url.parse(referer);
    origin = `${parsedReferer.protocol}\/\/${parsedReferer.host}`;
  }

  const allowedOrigin = publishAllowedOrigins.find(allowedOrigin => allowedOrigin === origin);
  if (allowedOrigin) {
    return await jwt.verifyAsync(token, jwtKey);
  }

  throw new Error(`The origin "${origin}" is not allowed to post updates`);
}

function getAuthorizedTargets(claims, isPublisher) {
  if (!claims) {
    // If not authenticated, then only allow public updates (no targets).
    return {
      allTargetsAuthorized: false,
      authorizedTargets: [],
    };
  }

  if (!claims.mercure) {
    // Only allow public updates.
    return {
      allTargetsAuthorized: false,
      authorizedTargets: [],
    };
  }

  const providedTargets = isPublisher ? claims.mercure.publish : claims.mercure.subscribe;

  if (providedTargets.some(target => target === '*')) {
    return {
      allTargetsAuthorized: true,
      authorizedTargets: null,
    };
  }

  return {
    allTargetsAuthorized: false,
    authorizedTargets: providedTargets,
  };
}

module.exports = { authorize, getAuthorizedTargets };
