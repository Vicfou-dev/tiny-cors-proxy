# tiny-cors-proxy
Fork from cors-everywhere in TypeScript
[![MIT license](http://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat)](http://opensource.org/licenses/MIT) [![image](https://shields.io/badge/TypeScript-3178C6?logo=TypeScript&logoColor=FFF&style=flat-square)](https://www.typescriptlang.org/) 

# Table of content

1. [Description](#description)
2. [Installation](#installation)
3. [Example](#example)
3.1 [Proxy out of the box](#proxy-out-of-the-box)
3.2 [Call it from everywhere](#use-it-from-your-favortie-browser--server)
3.3 [Configure your proxy](#configure-it-as-you-like)
3.4 [Rate limiter](#more-option-for-your-proxy-server)
4. [License](#license)

## Description
This repository provides a tiny-cors-proxy to bypass cors

## Installation
Run this command to install it
```
npm i tiny-cors-proxy
```

## Example

### Proxy out of the box
Easy use for tiny-cors-proxy
```js
import corsServer from 'tiny-cors-proxy';
corsServer.listen(8080);
```

### Use it from your favortie browser / server
Imagine that you want to call google.com from a page in your browser : do the following
```js
const server = "http://localhost:8080";
const domain = "https://google.com"
const response = await fetch(`${server}/${domain}`, { headers: { 'x-requested-with': 'XMLHttpRequest' }} );
```

### Configure it as you like 
If you want to configure the server by your own
```js
import { createServer } from 'tiny-cors-proxy';
const corsServer = createServer({
    originWhitelist: [],
    requireHeader: ['origin', 'x-requested-with'],
    removeHeaders: ['cookie', 'cookie2'],
});
corsServer.listen(8080);
```

### More Option for your proxy server
If you want to add a rate limiter for and allowed 
```js
import { createServer, createRateLimitChecker } from 'tiny-cors-proxy';

const limiter = createRateLimitChecker('5 1'); // 5 request per minute
const corsServer = createServer({
    originWhitelist: [], // Allow all origins
    requireHeader: ['origin', 'x-requested-with'],
    removeHeaders: ['cookie', 'cookie2'],
    checkRateLimit: limiter,
});
corsServer.listen(8080);
```

## License
[This project is licensed under the MIT license](license.md) 

