import corsServer from '../src/index';

test('test if cors server working', async() => {
    const port = 8070;

    corsServer.listen(port);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await fetch(`http://localhost:${port}/https://google.com`, { headers: { 'x-requested-with': 'XMLHttpRequest' }} );
    // Check if the response status is 200
    expect(response.status).toBe(200);
    corsServer.close();
});