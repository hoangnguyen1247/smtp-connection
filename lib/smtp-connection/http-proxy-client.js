"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

var _net = _interopRequireDefault(require("net"));

var _tls = _interopRequireDefault(require("tls"));

var _url = _interopRequireDefault(require("url"));

/**
 * Minimal HTTP/S proxy client
 */

/**
 * Establishes proxied connection to destinationPort
 *
 * httpProxyClient("http://localhost:3128/", 80, "google.com", function(err, socket){
 *     socket.write("GET / HTTP/1.0\r\n\r\n");
 * });
 *
 * @param {String} proxyUrl proxy configuration, etg "http://proxy.host:3128/"
 * @param {Number} destinationPort Port to open in destination host
 * @param {String} destinationHost Destination hostname
 * @param {Function} callback Callback to run with the rocket object once connection is established
 */
function httpProxyClient(proxyUrl, destinationPort, destinationHost, callback) {
  var proxy = _url["default"].parse(proxyUrl); // create a socket connection to the proxy server


  var options;
  var connect;
  var socket;
  options = {
    host: proxy.hostname,
    port: Number(proxy.port) ? Number(proxy.port) : proxy.protocol === 'https:' ? 443 : 80
  };

  if (proxy.protocol === 'https:') {
    // we can use untrusted proxies as long as we verify actual SMTP certificates
    options.rejectUnauthorized = false;
    connect = _tls["default"].connect.bind(_tls["default"]);
  } else {
    connect = _net["default"].connect.bind(_net["default"]);
  } // Error harness for initial connection. Once connection is established, the responsibility
  // to handle errors is passed to whoever uses this socket


  var finished = false;

  var tempSocketErr = function tempSocketErr(err) {
    if (finished) {
      return;
    }

    finished = true;

    try {
      socket.destroy();
    } catch (E) {// ignore
    }

    callback(err);
  };

  socket = connect(options, function () {
    if (finished) {
      return;
    }

    var reqHeaders = {
      Host: destinationHost + ':' + destinationPort,
      Connection: 'close'
    };

    if (proxy.auth) {
      reqHeaders['Proxy-Authorization'] = 'Basic ' + Buffer.from(proxy.auth).toString('base64');
    }

    socket.write( // HTTP method
    'CONNECT ' + destinationHost + ':' + destinationPort + ' HTTP/1.1\r\n' + // HTTP request headers
    Object.keys(reqHeaders).map(function (key) {
      return key + ': ' + reqHeaders[key];
    }).join('\r\n') + // End request
    '\r\n\r\n');
    var headers = '';

    var onSocketData = function onSocketData(chunk) {
      var match;
      var remainder;

      if (finished) {
        return;
      }

      headers += chunk.toString('binary');

      if (match = headers.match(/\r\n\r\n/)) {
        socket.removeListener('data', onSocketData);
        remainder = headers.substr(match.index + match[0].length);
        headers = headers.substr(0, match.index);

        if (remainder) {
          socket.unshift(Buffer.from(remainder, 'binary'));
        } // proxy connection is now established


        finished = true; // check response code

        match = headers.match(/^HTTP\/\d+\.\d+ (\d+)/i);

        if (!match || (match[1] || '').charAt(0) !== '2') {
          try {
            socket.destroy();
          } catch (E) {// ignore
          }

          return callback(new Error('Invalid response from proxy' + (match && ': ' + match[1] || '')));
        }

        socket.removeListener('error', tempSocketErr);
        return callback(null, socket);
      }
    };

    socket.on('data', onSocketData);
  });
  socket.once('error', tempSocketErr);
}

module.exports = httpProxyClient;