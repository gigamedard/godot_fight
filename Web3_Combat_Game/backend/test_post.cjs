const http = require('http');

const data = JSON.stringify({
    pool_id: 9,
    loser_wallet: null,
    is_eliminated: false
});

const options = {
    hostname: 'localhost',
    port: 8000,
    path: '/api/pools/match-finished',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, res => {
    console.log(`statusCode: ${res.statusCode}`);
    res.on('data', d => {
        process.stdout.write(d);
    });
});

req.on('error', error => {
    console.error(error);
});

req.write(data);
req.end();
