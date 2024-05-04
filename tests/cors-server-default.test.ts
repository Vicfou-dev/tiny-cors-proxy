import corsServer from '../src/index';

test('test if cors server working', async() => {
    const port = 8060;

    corsServer.listen(port);
    await new Promise(resolve => setTimeout(resolve, 1000));

    const response = await fetch(`http://localhost:${port}`);
    // Check if the response status is 200
    expect(response.status).toBe(200);
    corsServer.close();
});