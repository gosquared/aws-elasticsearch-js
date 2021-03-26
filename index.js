const AWS = require('aws-sdk');
const debug = require('debug')('elasticsearch');
const pump = require('pump');
const { Connection } = require('@elastic/elasticsearch');

const INVALID_PATH_REGEX = /[^\u0021-\u00ff]/
const {
  ConnectionError,
  RequestAbortedError,
  TimeoutError
} = require('@elastic/elasticsearch/lib/errors');

function isStream(obj) {
  return typeof obj.pipe === 'function';
}

function createConnector(opts = {}) {
  let { region, getCreds } = opts;
  region = region || process.env.AWS_REGION;
  if (!getCreds) getCreds = cb => AWS.config.getCredentials(cb);

  class AwsEs extends Connection {
    request(params, callback) {
      this._openRequests++
      let cleanedListeners = false
      let aborted;
      let request = { abort: () => { aborted = true } };

      const requestParams = this.buildRequestObject(params)
      // https://github.com/nodejs/node/commit/b961d9fd83
      if (INVALID_PATH_REGEX.test(requestParams.path) === true) {
        callback(new TypeError(`ERR_UNESCAPED_CHARACTERS: ${requestParams.path}`), null)
        /* istanbul ignore next */
        return request;
      }

      debug('Starting a new request', params)

      getCreds((err, credentials) => {
        if (err) {
          this._openRequests--;
          return callback(new ConnectionError(err.message), null);
        }
        if (aborted) {
          this._openRequests--;
          return;
        }

        const domain = requestParams.hostname;
        const body = requestParams.body;

        const endpoint = new AWS.Endpoint(domain);
        request = new AWS.HttpRequest(endpoint, region);

        request.method = requestParams.method;
        request.path = requestParams.path;

        if (body && !isStream(body)) {
          request.body = body;
          request.headers['Content-Length'] = Buffer.byteLength(request.body);
        }
        const contentType = requestParams.headers['content-type'];
        if (contentType) {
          request.headers['Content-Type'] = contentType;
        }
        request.headers['host'] = domain;

        const signer = new AWS.Signers.V4(request, 'es');
        signer.addAuthorization(credentials, new Date());

        const client = new AWS.HttpClient();
        const response = () => {};
        const error = () => {};
        const opts = {
          timeout: requestParams.timeout,
          agent: requestParams.agent
        }

        request = client.handleRequest(request, opts, response, error)

        const onResponse = response => {
          cleanListeners()
          this._openRequests--
          callback(null, response)
        }

        const onTimeout = () => {
          cleanListeners()
          this._openRequests--
          request.once('error', () => {}) // we need to catch the request aborted error
          request.abort()
          callback(new TimeoutError('Request timed out', params), null)
        }

        const onError = err => {
          cleanListeners()
          this._openRequests--
          callback(new ConnectionError(err.message), null)
        }

        const onAbort = () => {
          cleanListeners()
          request.once('error', () => {}) // we need to catch the request aborted error
          debug('Request aborted', params)
          this._openRequests--
          callback(new RequestAbortedError(), null)
        }

        request.on('response', onResponse)
        request.on('timeout', onTimeout)
        request.on('error', onError)
        request.on('abort', onAbort)

        // Disables the Nagle algorithm
        request.setNoDelay(true)

        // starts the request
        if (isStream(params.body) === true) {
          pump(params.body, request, err => {
            /* istanbul ignore if  */
            if (err != null && cleanedListeners === false) {
              cleanListeners()
              this._openRequests--
              callback(err, null)
            }
          })
        } else {
          request.end(params.body)
        }

        function cleanListeners () {
          request.removeListener('response', onResponse)
          request.removeListener('timeout', onTimeout)
          request.removeListener('error', onError)
          request.removeListener('abort', onAbort)
          cleanedListeners = true
        }
      });

      return {
        abort: () => {
          request.abort();
        }
      }
    }
  }

  return AwsEs;
}

exports.createConnector = createConnector;
