import { createRateLimitChecker, createServer } from '../src/index';

test('test if cors server working', async () => {

    const limiter = createRateLimitChecker('1 1');
    const corsServer = createServer({
        originWhitelist: [], // Allow all origins
        requireHeader: ['origin', 'x-requested-with'],
        removeHeaders: ['cookie', 'cookie2'],
        checkRateLimit: limiter,
    });

    const port = 8090;
    corsServer.listen(port);

    await new Promise(resolve => setTimeout(resolve, 1000));

    await fetch(`http://localhost:${port}/https://google.com`, { headers: { 'x-requested-with': 'XMLHttpRequest' }} );

    const response = await fetch(`http://localhost:${port}/https://google.com`, { headers: { 'x-requested-with': 'XMLHttpRequest' }} );
    
    expect(response.status).toBe(429);

    corsServer.close();
});