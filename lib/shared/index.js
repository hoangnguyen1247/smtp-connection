"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.encodeXText = exports.assign = exports.resolveContent = exports.callbackPromise = exports.getLogger = exports._logFunc = exports.parseConnectionUrl = exports.resolveHostname = void 0;

var _typeof2 = _interopRequireDefault(require("@babel/runtime/helpers/typeof"));

var _toConsumableArray2 = _interopRequireDefault(require("@babel/runtime/helpers/toConsumableArray"));

var _url = _interopRequireDefault(require("url"));

var _util = _interopRequireDefault(require("util"));

var _fs = _interopRequireDefault(require("fs"));

var _dns = _interopRequireDefault(require("dns"));

var _net = _interopRequireDefault(require("net"));

var _fetch = _interopRequireDefault(require("../fetch"));

/* eslint no-console: 0 */
var DNS_TTL = 5 * 60 * 1000;

var resolver = function resolver(family, hostname, callback) {
  _dns["default"]['resolve' + family](hostname, function (err, addresses) {
    if (err) {
      switch (err.code) {
        case _dns["default"].NODATA:
        case _dns["default"].NOTFOUND:
        case _dns["default"].NOTIMP:
        case _dns["default"].SERVFAIL:
        case _dns["default"].CONNREFUSED:
        case 'EAI_AGAIN':
          return callback(null, []);
      }

      return callback(err);
    }

    return callback(null, Array.isArray(addresses) ? addresses : [].concat(addresses || []));
  });
};

var dnsCache = module.exports.dnsCache = new Map();

var resolveHostname = function resolveHostname(options, callback) {
  options = options || {};

  if (!options.host || _net["default"].isIP(options.host)) {
    // nothing to do here
    var value = {
      host: options.host,
      servername: options.servername || false
    };
    return callback(null, value);
  }

  var cached;

  if (dnsCache.has(options.host)) {
    cached = dnsCache.get(options.host);

    if (!cached.expires || cached.expires >= Date.now()) {
      return callback(null, {
        host: cached.value.host,
        servername: cached.value.servername,
        _cached: true
      });
    }
  }

  resolver(4, options.host, function (err, addresses) {
    if (err) {
      if (cached) {
        // ignore error, use expired value
        return callback(null, cached.value);
      }

      return callback(err);
    }

    if (addresses && addresses.length) {
      var _value = {
        host: addresses[0] || options.host,
        servername: options.servername || options.host
      };
      dnsCache.set(options.host, {
        value: _value,
        expires: Date.now() + DNS_TTL
      });
      return callback(null, _value);
    }

    resolver(6, options.host, function (err, addresses) {
      if (err) {
        if (cached) {
          // ignore error, use expired value
          return callback(null, cached.value);
        }

        return callback(err);
      }

      if (addresses && addresses.length) {
        var _value2 = {
          host: addresses[0] || options.host,
          servername: options.servername || options.host
        };
        dnsCache.set(options.host, {
          value: _value2,
          expires: Date.now() + DNS_TTL
        });
        return callback(null, _value2);
      }

      try {
        _dns["default"].lookup(options.host, {}, function (err, address) {
          if (err) {
            if (cached) {
              // ignore error, use expired value
              return callback(null, cached.value);
            }

            return callback(err);
          }

          if (!address && cached) {
            // nothing was found, fallback to cached value
            return callback(null, cached.value);
          }

          var value = {
            host: address || options.host,
            servername: options.servername || options.host
          };
          dnsCache.set(options.host, {
            value: value,
            expires: Date.now() + DNS_TTL
          });
          return callback(null, value);
        });
      } catch (err) {
        if (cached) {
          // ignore error, use expired value
          return callback(null, cached.value);
        }

        return callback(err);
      }
    });
  });
};
/**
 * Parses connection url to a structured configuration object
 *
 * @param {String} str Connection url
 * @return {Object} Configuration object
 */


exports.resolveHostname = resolveHostname;

var parseConnectionUrl = function parseConnectionUrl(str) {
  str = str || '';
  var options = {};
  [_url["default"].parse(str, true)].forEach(function (url) {
    var auth;

    switch (url.protocol) {
      case 'smtp:':
        options.secure = false;
        break;

      case 'smtps:':
        options.secure = true;
        break;

      case 'direct:':
        options.direct = true;
        break;
    }

    if (!isNaN(url.port) && Number(url.port)) {
      options.port = Number(url.port);
    }

    if (url.hostname) {
      options.host = url.hostname;
    }

    if (url.auth) {
      auth = url.auth.split(':');

      if (!options.auth) {
        options.auth = {};
      }

      options.auth.user = auth.shift();
      options.auth.pass = auth.join(':');
    }

    Object.keys(url.query || {}).forEach(function (key) {
      var obj = options;
      var lKey = key;
      var value = url.query[key];

      if (!isNaN(value)) {
        value = Number(value);
      }

      switch (value) {
        case 'true':
          value = true;
          break;

        case 'false':
          value = false;
          break;
      } // tls is nested object


      if (key.indexOf('tls.') === 0) {
        lKey = key.substr(4);

        if (!options.tls) {
          options.tls = {};
        }

        obj = options.tls;
      } else if (key.indexOf('.') >= 0) {
        // ignore nested properties besides tls
        return;
      }

      if (!(lKey in obj)) {
        obj[lKey] = value;
      }
    });
  });
  return options;
};

exports.parseConnectionUrl = parseConnectionUrl;

var _logFunc = function _logFunc(logger, level, defaults, data, message) {
  var entry = {};
  Object.keys(defaults || {}).forEach(function (key) {
    if (key !== 'level') {
      entry[key] = defaults[key];
    }
  });
  Object.keys(data || {}).forEach(function (key) {
    if (key !== 'level') {
      entry[key] = data[key];
    }
  });

  for (var _len = arguments.length, args = new Array(_len > 5 ? _len - 5 : 0), _key = 5; _key < _len; _key++) {
    args[_key - 5] = arguments[_key];
  }

  logger[level].apply(logger, [entry, message].concat(args));
};
/**
 * Returns a bunyan-compatible logger interface. Uses either provided logger or
 * creates a default console logger
 *
 * @param {Object} [options] Options object that might include 'logger' value
 * @return {Object} bunyan compatible logger
 */


exports._logFunc = _logFunc;

var getLogger = function getLogger(options, defaults) {
  options = options || {};
  var response = {};
  var levels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

  if (!options.logger) {
    // use vanity logger
    levels.forEach(function (level) {
      response[level] = function () {
        return false;
      };
    });
    return response;
  }

  var logger = options.logger;

  if (options.logger === true) {
    // create console logger
    logger = createDefaultLogger(levels);
  }

  levels.forEach(function (level) {
    response[level] = function (data, message) {
      var _module$exports;

      for (var _len2 = arguments.length, args = new Array(_len2 > 2 ? _len2 - 2 : 0), _key2 = 2; _key2 < _len2; _key2++) {
        args[_key2 - 2] = arguments[_key2];
      }

      (_module$exports = module.exports)._logFunc.apply(_module$exports, [logger, level, defaults, data, message].concat(args));
    };
  });
  return response;
};
/**
 * Wrapper for creating a callback that either resolves or rejects a promise
 * based on input
 *
 * @param {Function} resolve Function to run if callback is called
 * @param {Function} reject Function to run if callback ends with an error
 */


exports.getLogger = getLogger;

var callbackPromise = function callbackPromise(resolve, reject) {
  return function () {
    var args = Array.from(arguments);
    var err = args.shift();

    if (err) {
      reject(err);
    } else {
      resolve.apply(void 0, (0, _toConsumableArray2["default"])(args));
    }
  };
};
/**
 * Resolves a String or a Buffer value for content value. Useful if the value
 * is a Stream or a file or an URL. If the value is a Stream, overwrites
 * the stream object with the resolved value (you can't stream a value twice).
 *
 * This is useful when you want to create a plugin that needs a content value,
 * for example the `html` or `text` value as a String or a Buffer but not as
 * a file path or an URL.
 *
 * @param {Object} data An object or an Array you want to resolve an element for
 * @param {String|Number} key Property name or an Array index
 * @param {Function} callback Callback function with (err, value)
 */


exports.callbackPromise = callbackPromise;

var resolveContent = function resolveContent(data, key, callback) {
  var promise;

  if (!callback) {
    promise = new Promise(function (resolve, reject) {
      callback = module.exports.callbackPromise(resolve, reject);
    });
  }

  var content = data && data[key] && data[key].content || data[key];
  var contentStream;
  var encoding = ((0, _typeof2["default"])(data[key]) === 'object' && data[key].encoding || 'utf8').toString().toLowerCase().replace(/[-_\s]/g, '');

  if (!content) {
    return callback(null, content);
  }

  if ((0, _typeof2["default"])(content) === 'object') {
    if (typeof content.pipe === 'function') {
      return resolveStream(content, function (err, value) {
        if (err) {
          return callback(err);
        } // we can't stream twice the same content, so we need
        // to replace the stream object with the streaming result


        data[key] = value;
        callback(null, value);
      });
    } else if (/^https?:\/\//i.test(content.path || content.href)) {
      contentStream = (0, _fetch["default"])(content.path || content.href);
      return resolveStream(contentStream, callback);
    } else if (/^data:/i.test(content.path || content.href)) {
      var parts = (content.path || content.href).match(/^data:((?:[^;]*;)*(?:[^,]*)),(.*)$/i);

      if (!parts) {
        return callback(null, Buffer.from('0'));
      }

      return callback(null, /\bbase64$/i.test(parts[1]) ? Buffer.from(parts[2], 'base64') : Buffer.from(decodeURIComponent(parts[2])));
    } else if (content.path) {
      return resolveStream(_fs["default"].createReadStream(content.path), callback);
    }
  }

  if (typeof data[key].content === 'string' && !['utf8', 'usascii', 'ascii'].includes(encoding)) {
    content = Buffer.from(data[key].content, encoding);
  } // default action, return as is


  setImmediate(function () {
    return callback(null, content);
  });
  return promise;
};
/**
 * Copies properties from source objects to target objects
 */


exports.resolveContent = resolveContent;

var assign = function assign()
/* target, ... sources */
{
  var args = Array.from(arguments);
  var target = args.shift() || {};
  args.forEach(function (source) {
    Object.keys(source || {}).forEach(function (key) {
      if (['tls', 'auth'].includes(key) && source[key] && (0, _typeof2["default"])(source[key]) === 'object') {
        // tls and auth are special keys that need to be enumerated separately
        // other objects are passed as is
        if (!target[key]) {
          // ensure that target has this key
          target[key] = {};
        }

        Object.keys(source[key]).forEach(function (subKey) {
          target[key][subKey] = source[key][subKey];
        });
      } else {
        target[key] = source[key];
      }
    });
  });
  return target;
};

exports.assign = assign;

var encodeXText = function encodeXText(str) {
  // ! 0x21
  // + 0x2B
  // = 0x3D
  // ~ 0x7E
  if (!/[^\x21-\x2A\x2C-\x3C\x3E-\x7E]/.test(str)) {
    return str;
  }

  var buf = Buffer.from(str);
  var result = '';

  for (var i = 0, len = buf.length; i < len; i++) {
    var c = buf[i];

    if (c < 0x21 || c > 0x7e || c === 0x2b || c === 0x3d) {
      result += '+' + (c < 0x10 ? '0' : '') + c.toString(16).toUpperCase();
    } else {
      result += String.fromCharCode(c);
    }
  }

  return result;
};
/**
 * Streams a stream value into a Buffer
 *
 * @param {Object} stream Readable stream
 * @param {Function} callback Callback function with (err, value)
 */


exports.encodeXText = encodeXText;

function resolveStream(stream, callback) {
  var responded = false;
  var chunks = [];
  var chunklen = 0;
  stream.on('error', function (err) {
    if (responded) {
      return;
    }

    responded = true;
    callback(err);
  });
  stream.on('readable', function () {
    var chunk;

    while ((chunk = stream.read()) !== null) {
      chunks.push(chunk);
      chunklen += chunk.length;
    }
  });
  stream.on('end', function () {
    if (responded) {
      return;
    }

    responded = true;
    var value;

    try {
      value = Buffer.concat(chunks, chunklen);
    } catch (E) {
      return callback(E);
    }

    callback(null, value);
  });
}
/**
 * Generates a bunyan-like logger that prints to console
 *
 * @returns {Object} Bunyan logger instance
 */


function createDefaultLogger(levels) {
  var levelMaxLen = 0;
  var levelNames = new Map();
  levels.forEach(function (level) {
    if (level.length > levelMaxLen) {
      levelMaxLen = level.length;
    }
  });
  levels.forEach(function (level) {
    var levelName = level.toUpperCase();

    if (levelName.length < levelMaxLen) {
      levelName += ' '.repeat(levelMaxLen - levelName.length);
    }

    levelNames.set(level, levelName);
  });

  var print = function print(level, entry, message) {
    var prefix = '';

    if (entry) {
      if (entry.tnx === 'server') {
        prefix = 'S: ';
      } else if (entry.tnx === 'client') {
        prefix = 'C: ';
      }

      if (entry.sid) {
        prefix = '[' + entry.sid + '] ' + prefix;
      }

      if (entry.cid) {
        prefix = '[#' + entry.cid + '] ' + prefix;
      }
    }

    for (var _len3 = arguments.length, args = new Array(_len3 > 3 ? _len3 - 3 : 0), _key3 = 3; _key3 < _len3; _key3++) {
      args[_key3 - 3] = arguments[_key3];
    }

    message = _util["default"].format.apply(_util["default"], [message].concat(args));
    message.split(/\r?\n/).forEach(function (line) {
      console.log('[%s] %s %s', new Date().toISOString().substr(0, 19).replace(/T/, ' '), levelNames.get(level), prefix + line);
    });
  };

  var logger = {};
  levels.forEach(function (level) {
    logger[level] = print.bind(null, level);
  });
  return logger;
}