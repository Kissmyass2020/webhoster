import { PassThrough } from 'stream';
import { addEndObserver, hasEndCalled } from '../utils/writableObserver.js';

/** @typedef {import('../types').MiddlewareFunction} MiddlewareFunction */
/** @typedef {import('../types').MiddlewareFunctionParams} MiddlewareFunctionParams */
/** @typedef {import('../types').MiddlewareFunctionResult} MiddlewareFunctionResult */

/**
 * @typedef {Object} BufferEncoderMiddlewareOptions
 * @prop {string} [defaultCharset='utf-8']
 * @prop {boolean} [setCharset=false]
 * Automatically applies charset in `Content-Type`
 * @prop {boolean} [setJSON=false]
 * Automatically applies `application/json` mediatype in `Content-Type`
 */


/**
 * @param {string} charset
 * @return {BufferEncoding}
 */
function charsetAsBufferEncoding(charset) {
  switch (charset) {
    case 'iso-8859-1':
    case 'ascii':
    case 'binary':
    case 'latin1':
      return 'latin1';
    case 'utf-16le':
    case 'ucs-2':
    case 'ucs2':
    case 'utf16le':
      return 'utf16le';
    default:
    case 'utf-8':
    case 'utf8':
      return 'utf-8';
    case 'base64':
    case 'hex':
      return /** @type {BufferEncoding} */ (charset);
  }
}

/**
 * @param {MiddlewareFunctionParams} params
 * @param {BufferEncoderMiddlewareOptions} [options]
 * @return {MiddlewareFunctionResult}
 */
function executeBufferEncoderMiddleware({ req, res }, options = {}) {
  if (req.method === 'HEAD') {
    return 'continue';
  }

  const newWritable = new PassThrough({
    objectMode: true,
  });
  addEndObserver(newWritable);
  const destination = res.replaceStream(newWritable);
  /** @type {Buffer[]} */
  const pendingChunks = [];
  /** @type {string} */
  let charset = null;
  /** @type {BufferEncoding} */
  let encoding = null;
  let hasSetJSON = false;

  /** @return {string} */
  function parseCharset() {
    if (charset) return charset;
    /** @type {string} */
    const contentType = (res.headers['content-type']);
    if (contentType) {
      contentType.split(';').some((directive) => {
        const parameters = directive.split('=');
        if (parameters[0].trim().toLowerCase() !== 'charset') {
          return false;
        }
        charset = parameters[1]?.trim().toLowerCase();
        const firstQuote = charset.indexOf('"');
        const lastQuote = charset.lastIndexOf('"');
        if (firstQuote !== -1 && lastQuote !== -1) {
          charset = charset.substring(firstQuote + 1, lastQuote);
        }
        return true;
      });
    }
    if (!charset) {
      charset = options.defaultCharset || 'utf-8';
      if (options.setCharset && !res.headersSent) {
        res.headers['content-type'] = `${contentType || ''};charset=${charset}`;
      }
    }
    return charset;
  }
  /** @return {void} */
  function setJSONMediaType() {
    if (hasSetJSON) return;
    /** @type {string} */
    const contentType = (res.headers['content-type']);
    res.headers['content-type'] = (contentType || '')
      .split(';')
      .map((directive) => {
        const isKeyPair = directive.includes('=');
        if (isKeyPair) return directive;
        return 'application/json';
      })
      .join(';');

    hasSetJSON = true;
  }

  newWritable.on('data', (any) => {
    /** @type {Buffer} */
    let chunk;
    if (Buffer.isBuffer(any)) {
      chunk = any;
    } else if (typeof any === 'string') {
      if (!encoding) {
        encoding = charsetAsBufferEncoding(parseCharset());
      }
      chunk = Buffer.from(any, encoding);
    } else if (typeof any === 'object') {
      if (!encoding) {
        encoding = charsetAsBufferEncoding(parseCharset());
      }
      chunk = Buffer.from(JSON.stringify(any), encoding);
      if (options.setJSON && !hasSetJSON && !res.headersSent) {
        setJSONMediaType();
      }
    }

    if (hasEndCalled(newWritable)) {
      pendingChunks.push(chunk);
    } else {
      destination.write(chunk);
    }
  });

  newWritable.on('end', () => {
    let chunk;
    // eslint-disable-next-line no-cond-assign
    while (chunk = pendingChunks.shift()) {
      // TODO: Implement backpressure.
      destination.write(chunk);
    }
    destination.end();
  });

  return 'continue';
}

/**
 * @param {BufferEncoderMiddlewareOptions} options
 * @return {MiddlewareFunction}
 */
export function createBufferEncoderMiddleware(options = {}) {
  return function bufferEncoderMiddleware(params) {
    return executeBufferEncoderMiddleware(params, options);
  };
}

/** @type {MiddlewareFunction} */
export function defaultBufferEncoderMiddleware(params) {
  return executeBufferEncoderMiddleware(params);
}