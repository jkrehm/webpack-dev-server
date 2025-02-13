'use strict';

/* global self */

const url = require('url');
const getCurrentScriptSource = require('./getCurrentScriptSource');

function createSocketUrl(resourceQuery, currentLocation) {
  let urlParts;

  if (typeof resourceQuery === 'string' && resourceQuery !== '') {
    // If this bundle is inlined, use the resource query to get the correct url.
    // format is like `?http://0.0.0.0:8096&sockPort=8097&sockHost=localhost`
    urlParts = url.parse(
      resourceQuery
        // strip leading `?` from query string to get a valid URL
        .substr(1)
        // replace first `&` with `?` to have a valid query string
        .replace('&', '?'),
      true
    );
  } else {
    // Else, get the url from the <script> this file was called with.
    const scriptHost = getCurrentScriptSource();
    urlParts = url.parse(scriptHost || '/', true, true);
  }

  // Use parameter to allow passing location in unit tests
  if (typeof currentLocation === 'string' && currentLocation !== '') {
    currentLocation = url.parse(currentLocation);
  } else {
    currentLocation = self.location;
  }

  return getSocketUrl(urlParts, currentLocation);
}

/*
 * Gets socket URL based on Script Source/Location
 * (scriptSrc: URL, location: URL) -> URL
 */
function getSocketUrl(urlParts, loc) {
  const { auth, query } = urlParts;
  let { hostname, protocol, port } = urlParts;

  if (!port || port === '0') {
    port = loc.port;
  }

  // check ipv4 and ipv6 `all hostname`
  // why do we need this check?
  // hostname n/a for file protocol (example, when using electron, ionic)
  // see: https://github.com/webpack/webpack-dev-server/pull/384
  if (
    (hostname === '0.0.0.0' || hostname === '::') &&
    loc.hostname &&
    loc.protocol.startsWith('http')
  ) {
    hostname = loc.hostname;
  }

  // `hostname` can be empty when the script path is relative. In that case, specifying
  // a protocol would result in an invalid URL.
  // When https is used in the app, secure websockets are always necessary
  // because the browser doesn't accept non-secure websockets.
  if (
    hostname &&
    hostname !== '127.0.0.1' &&
    (loc.protocol === 'https:' || urlParts.hostname === '0.0.0.0')
  ) {
    protocol = loc.protocol;
  }

  // all of these sock url params are optionally passed in through
  // resourceQuery, so we need to fall back to the default if
  // they are not provided
  const sockHost = query.sockHost || hostname;
  const sockPath = query.sockPath || '/sockjs-node';
  const sockPort = query.sockPort || port;

  return url.format({
    protocol,
    auth,
    hostname: sockHost,
    port: sockPort,
    // If sockPath is provided it'll be passed in via the resourceQuery as a
    // query param so it has to be parsed out of the querystring in order for the
    // client to open the socket to the correct location.
    pathname: sockPath,
  });
}

module.exports = createSocketUrl;
