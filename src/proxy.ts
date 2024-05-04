var net = null;
var url = null;
var httpProxy = null;
var http = null;
var https = null;
var getProxyForUrl = null;

if(typeof module !== 'undefined' && module.exports) {
    net = require('net');
    url = require('url');
    httpProxy = require('http-proxy');
    http = require('http');
    https = require('https');
    getProxyForUrl = require('proxy-from-env').getProxyForUrl;
}

interface Location {
    protocol: string | null;
    host: string | null;
    hostname: string | null;
    port: string | null;
    path: string;
    href: string;
}

interface CorsProxyRequestState {
    location: Location;
    getProxyForUrl: typeof getProxyForUrl;
    maxRedirects: number;
    corsMaxAge: number;
    redirectCount_?: number;
    proxyBaseUrl?: string;
}

interface CorsProxyOptions {
    handleInitialRequest?: (req: any, res: any, location: Location) => boolean;
    getProxyForUrl?: typeof getProxyForUrl;
    maxRedirects?: number;
    originBlacklist?: string[];
    originWhitelist?: string[];
    httpProxyOptions?: any;
    httpsOptions?: any;
    checkRateLimit?: (origin: string) => string | null;
    redirectSameOrigin?: boolean;
    requireHeader?: string | string[] | null;
    removeHeaders?: string[];
    setHeaders?: Record<string, string>;
    corsMaxAge?: number;
}

function isValidHostName(hostname: string): boolean {
    return !!(
        net.isIPv4(hostname) ||
        net.isIPv6(hostname)
    );
}

function withCORS(headers: Record<string, string>, request: any): Record<string, string> {
    headers['access-control-allow-origin'] = '*';
    const corsMaxAge = request.corsProxyRequestState.corsMaxAge;
    if (request.method === 'OPTIONS' && corsMaxAge) {
        headers['access-control-max-age'] = corsMaxAge.toString();
    }
    if (request.headers['access-control-request-method']) {
        headers['access-control-allow-methods'] = request.headers['access-control-request-method'];
        delete request.headers['access-control-request-method'];
    }
    if (request.headers['access-control-request-headers']) {
        headers['access-control-allow-headers'] = request.headers['access-control-request-headers'];
        delete request.headers['access-control-request-headers'];
    }

    headers['access-control-expose-headers'] = Object.keys(headers).join(',');

    return headers;
}

function parseURL(req_url: string): Location | null {
    const match = req_url.match(/^(?:(https?:)?\/\/)?(([^\/?]+?)(?::(\d{0,5})(?=[\/?]|$))?)([\/?][\S\s]*|$)/i);
    if (!match) {
        return null;
    }
    if (!match[1]) {
        if (/^https?:/i.test(req_url)) {
            return null;
        }
        req_url = (match[4] === '443' ? 'https:' : 'http:') + '//' + req_url;
    }
    const parsed = url.parse(req_url);
    if (!parsed.hostname) {
        return null;
    }
    return parsed as Location;
}

function onProxyResponse(proxy: any, proxyReq: any, proxyRes: any, req: any, res: any): boolean {
    const requestState: CorsProxyRequestState = req.corsProxyRequestState;

    const statusCode = proxyRes.statusCode;

    if (!requestState.redirectCount_) {
        res.setHeader('x-request-url', requestState.location.href);
    }

    if (statusCode === 301 || statusCode === 302 || statusCode === 303 || statusCode === 307 || statusCode === 308) {
        let locationHeader = proxyRes.headers.location;
        let parsedLocation: Location | null = null;
        if (locationHeader) {
            locationHeader = url.resolve(requestState.location.href, locationHeader);
            parsedLocation = parseURL(locationHeader);
        }
        if (parsedLocation) {
            if (statusCode === 301 || statusCode === 302 || statusCode === 303) {
                requestState.redirectCount_ = (requestState.redirectCount_ || 0) + 1;
                if (requestState.redirectCount_ <= requestState.maxRedirects) {
                    res.setHeader('X-CORS-Redirect-' + requestState.redirectCount_, `${statusCode} ${locationHeader}`);
                    req.method = 'GET';
                    req.headers['content-length'] = '0';
                    delete req.headers['content-type'];
                    requestState.location = parsedLocation;

                    req.removeAllListeners();
                    proxyReq.removeAllListeners('error');
                    proxyReq.once('error', function catchAndIgnoreError() {});
                    proxyReq.abort();

                    proxyRequest(req, res, proxy);
                    return false;
                }
            }
            proxyRes.headers.location = `${requestState.proxyBaseUrl}/${locationHeader}`;
        }
    }

    delete proxyRes.headers['set-cookie'];
    delete proxyRes.headers['set-cookie2'];

    proxyRes.headers['x-final-url'] = requestState.location.href;
    withCORS(proxyRes.headers, req);
    return true;
}

function proxyRequest(req: any, res: any, proxy: any): void {
    const location = req.corsProxyRequestState.location;
    req.url = location.path;

    const proxyOptions = {
        changeOrigin: false,
        prependPath: false,
        toProxy: false,
        target: location,
        headers: {
            host: location.host,
        },
        buffer: {
            pipe(proxyReq: any) {
                const proxyReqOn = proxyReq.on;
                proxyReq.on = function(eventName: string, listener: Function) {
                    if (eventName !== 'response') {
                        return proxyReqOn.call(this, eventName, listener);
                    }
                    return proxyReqOn.call(this, 'response', function(proxyRes: any) {
                        if (onProxyResponse(proxy, proxyReq, proxyRes, req, res)) {
                            try {
                                listener(proxyRes);
                            } catch (err) {
                                proxyReq.emit('error', err);
                            }
                        }
                    });
                };
                return req.pipe(proxyReq);
            },
        },
    };

    const proxyThroughUrl = req.corsProxyRequestState.getProxyForUrl(location.href);
    if (proxyThroughUrl) {
        proxyOptions.target = proxyThroughUrl;
        proxyOptions.toProxy = true;
        req.url = location.href;
    }

    try {
        proxy.web(req, res, proxyOptions);
    } catch (err) {
        proxy.emit('error', err, req, res);
    }
}

function getHandler(options: CorsProxyOptions, proxy: any): (req: any, res: any) => void {
    const corsProxy = {
        handleInitialRequest: null,
        getProxyForUrl: getProxyForUrl,
        maxRedirects: 5,
        originBlacklist: [],
        originWhitelist: [],
        checkRateLimit: null,
        redirectSameOrigin: false,
        requireHeader: null,
        removeHeaders: [],
        setHeaders: {},
        corsMaxAge: 0,
        ...options,
    };

    if (corsProxy.requireHeader) {
        if (typeof corsProxy.requireHeader === 'string') {
            corsProxy.requireHeader = [corsProxy.requireHeader.toLowerCase()];
        } else if (!Array.isArray(corsProxy.requireHeader) || corsProxy.requireHeader.length === 0) {
            corsProxy.requireHeader = null;
        } else {
            corsProxy.requireHeader = corsProxy.requireHeader.map(function(headerName) {
                return headerName.toLowerCase();
            });
        }
    }

    const hasRequiredHeaders = function(headers: Record<string, string>): boolean {
        return !corsProxy.requireHeader || (Array.isArray(corsProxy.requireHeader) && corsProxy.requireHeader.some((headerName) => Object.hasOwnProperty.call(headers, headerName)));
    };

    return function(req: any, res: any): void {
        req.corsProxyRequestState = {
            getProxyForUrl: corsProxy.getProxyForUrl,
            maxRedirects: corsProxy.maxRedirects,
            corsMaxAge: corsProxy.corsMaxAge,
        };

        const cors_headers = withCORS({}, req);
        if (req.method === 'OPTIONS') {
            res.writeHead(200, cors_headers);
            res.end();
            return;
        }

        const location = parseURL(req.url.slice(1));

        if (corsProxy.handleInitialRequest && corsProxy.handleInitialRequest(req, res, location)) {
            return;
        }

        if (!location) {
            if (/^\/https?:\/[^/]/i.test(req.url)) {
                res.writeHead(400, 'Missing slash', cors_headers);
                res.end('The URL is invalid: two slashes are needed after the http(s):.');
                return;
            }
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.end('ok');
            return;
        }

        if (location.host === 'iscorsneeded') {
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.end('no');
            return;
        }

        if (location.port > '65535') {
            res.writeHead(400, 'Invalid port', cors_headers);
            res.end('Port number too large: ' + location.port);
            return;
        }

        if (!/^\/https?:/.test(req.url) && !isValidHostName(location.hostname)) {
            res.writeHead(404, 'Invalid host', cors_headers);
            res.end('Invalid host: ' + location.hostname);
            return;
        }

        if (!hasRequiredHeaders(req.headers)) {
            res.writeHead(400, 'Header required', cors_headers);
            res.end('Missing required request header. Must specify one of: ' + corsProxy.requireHeader);
            return;
        }

        const origin = req.headers.origin || '';
        if (corsProxy.originBlacklist.indexOf(origin) >= 0) {
            res.writeHead(403, 'Forbidden', cors_headers);
            res.end('The origin "' + origin + '" was blacklisted by the operator of this proxy.');
            return;
        }

        if (corsProxy.originWhitelist.length && corsProxy.originWhitelist.indexOf(origin) === -1) {
            res.writeHead(403, 'Forbidden', cors_headers);
            res.end('The origin "' + origin + '" was not whitelisted by the operator of this proxy.');
            return;
        }

        const rateLimitMessage = corsProxy.checkRateLimit && corsProxy.checkRateLimit(origin);
        if (rateLimitMessage) {
            res.writeHead(429, 'Too Many Requests', cors_headers);
            res.end('The origin "' + origin + '" has sent too many requests.\n' + rateLimitMessage);
            return;
        }

        if (corsProxy.redirectSameOrigin && origin && location.href[origin.length] === '/' &&
            location.href.lastIndexOf(origin, 0) === 0) {
            cors_headers.vary = 'origin';
            cors_headers['cache-control'] = 'private';
            cors_headers.location = location.href;
            res.writeHead(301, 'Please use a direct request', cors_headers);
            res.end();
            return;
        }

        const isRequestedOverHttps = req.connection.encrypted || /^\s*https/.test(req.headers['x-forwarded-proto']);
        const proxyBaseUrl = (isRequestedOverHttps ? 'https://' : 'http://') + req.headers.host;

        corsProxy.removeHeaders.forEach(function(header) {
            delete req.headers[header];
        });

        Object.keys(corsProxy.setHeaders).forEach(function(header) {
            req.headers[header] = corsProxy.setHeaders[header];
        });

        req.corsProxyRequestState.location = location;
        req.corsProxyRequestState.proxyBaseUrl = proxyBaseUrl;

        proxyRequest(req, res, proxy);
    };
}

export function createServer(options?: CorsProxyOptions): any {
    options = options || {};

    const httpProxyOptions = {
        xfwd: true,
        secure: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0',
    };

    if (options.httpProxyOptions) {
        Object.keys(options.httpProxyOptions).forEach(function(option) {
            httpProxyOptions[option] = options.httpProxyOptions[option];
        });
    }

    const proxy = httpProxy.createServer(httpProxyOptions);
    const requestHandler = getHandler(options, proxy);
    let server;

    if (options.httpsOptions) {
        server = https.createServer(options.httpsOptions, requestHandler);
    } else {
        server = http.createServer(requestHandler);
    }

    proxy.on('error', function(err: Error, req: any, res: any) {
        if (res.headersSent) {
            if (res.writableEnded === false) {
                res.end();
            }
            return;
        }

        const headerNames = res.getHeaderNames ? res.getHeaderNames() : Object.keys(res._headers || {});
        headerNames.forEach(function(name) {
            res.removeHeader(name);
        });

        res.writeHead(404, {'Access-Control-Allow-Origin': '*'});
        res.end('Not found because of proxy error: ' + err);
    });

    return server;
}
