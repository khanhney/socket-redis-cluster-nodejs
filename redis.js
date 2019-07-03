const bluebird = require('bluebird');
const redis    = require('redis');

bluebird.promisifyAll(redis);

const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
});

module.exports = client;