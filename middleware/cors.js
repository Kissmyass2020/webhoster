/** @typedef {import('../types').MiddlewareFunction} MiddlewareFunction */
/** @typedef {import('../types').MiddlewareFunctionParams} MiddlewareFunctionParams */
/** @typedef {import('../types').MiddlewareFunctionResult} MiddlewareFunctionResult */
/** @typedef {import('../types').RequestMethod} RequestMethod */

/**
 * @typedef CORSMiddlewareOptions
 * @prop {(string|RegExp)[]} [allowOrigin]
 * Indicates whether the response can be shared, via returning the literal
 * value of the `Origin` request header (which can be `null`) or `*` in a response.
 * @prop {boolean} [allowCredentials]
 * Indicates whether the response can be shared when request’s credentials mode is "include".
 * @prop {RequestMethod[]} [allowMethods]
 * Indicates which methods are supported by the response’s URL for the purposes of the CORS protocol.
 * @prop {string[]} [allowHeaders]
 * Indicates which headers are supported by the response’s URL for the purposes of the CORS protocol.
 * @prop {number} [maxAge]
 * Indicates the number of seconds (5 by default) the information provided by the
 * `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers` headers can be cached.
 * @prop {string[]} [exposeHeaders]
 * Indicates which headers can be exposed as part of the response by listing their names.
 */

/**
 * @param {MiddlewareFunctionParams} params
 * @param {CORSMiddlewareOptions} [options]
 * @return {MiddlewareFunctionResult}
 */
function executeCORSMiddleware({ req, res }, options = {}) {
  if (('origin' in req.headers) === false) {
    // not CORS
    return 'continue';
  }
  if (!options.allowOrigin) {
    // Unspecified default of '*'
    res.headers['access-control-allow-origin'] = '*';
  } else {
    options.allowOrigin.some((origin) => {
      if (origin === '*') {
        res.headers['access-control-allow-origin'] = '*';
        return true;
      }
      if (typeof origin === 'string') {
        if (req.headers.origin?.toLowerCase() === origin.toLowerCase()) {
          res.headers['access-control-allow-origin'] = req.headers.origin;
          return true;
        }
        return false;
      }
      if (origin.test(req.headers.origin)) {
        res.headers['access-control-allow-origin'] = req.headers.origin;
        return true;
      }
      return false;
    });
  }
  if (options.allowCredentials) {
    res.headers['access-control-allow-credentials'] = 'true';
  }
  if (req.method === 'OPTIONS') {
    if (options.allowMethods) {
      res.headers['access-control-allow-methods'] = options.allowMethods.join(',');
    } else {
      res.headers['access-control-allow-methods'] = [
        'GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'CONNECT', 'TRACE', 'PATCH',
      ].join(',');
    }
    if (options.allowHeaders) {
      res.headers['access-control-allow-headers'] = options.allowHeaders.join(',');
    } else {
      res.headers['access-control-allow-headers'] = req.headers['access-control-request-headers'];
    }
    if (options.maxAge) {
      res.headers['access-control-max-age'] = options.maxAge.toString(10);
    }
    // 200 instead of 204 for compatibility
    res.status = 200;
    res.stream.end('OK');
    return 'end';
  }

  if (options.exposeHeaders) {
    res.headers['access-control-expose-headers'] = options.exposeHeaders.join(',');
  }
  return 'continue';
}

/**
 * @param {CORSMiddlewareOptions} options
 * @return {MiddlewareFunction}
 */
export function createCORSMiddleware(options = {}) {
  return function corsMiddleware(params) {
    return executeCORSMiddleware(params, options);
  };
}

/** @type {MiddlewareFunction}  */
export function defaultCORSMiddleware(params) {
  return executeCORSMiddleware(params);
}
