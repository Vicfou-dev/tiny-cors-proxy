# tiny-cors-proxy
Fork from cors-everywhere in TypeScript
[![MIT license](http://img.shields.io/badge/license-MIT-brightgreen.svg?style=flat)](http://opensource.org/licenses/MIT) [![image](https://shields.io/badge/TypeScript-3178C6?logo=TypeScript&logoColor=FFF&style=flat-square)](https://www.typescriptlang.org/) 

## Description
This repository provides a tiny-cors-proxy to bypass cors

## Installation
Run this command to install it
```
npm i tiny-cors-proxy
```

## Example

Easy use for tiny-cors-proxy
```js
import corsServer from 'tiny-cors-proxy';
corsServer.listen(8080);
```

Imagine that you want to call google.com from a page in your browser : do the following
```js
const server = "http://localhost:8080";
const domain = "https://google.com"
const response = await fetch(`${server}/${domain}`, { headers: { 'x-requested-with': 'XMLHttpRequest' }} );
```

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
[This project is licensed under the ISC license](license.md) 

