let express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

/**
 * REDIS CLIENT
 */
const REDIS = require('./redis');

/**
 * SOCKET ADAPTER
 */
const adapter = require('socket.io-redis');
const redisAdapter = adapter({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    // password: process.env.REDIS_PASS || 'password',
});

io.adapter(redisAdapter);

app.set('view engine', 'ejs');
app.set('views', './views');

app.use(express.static('./public'));

app.get('/', (req, res) => res.render('index'));

async function verifyUser (token) {
    return new Promise((resolve, reject) => {
      // setTimeout to mock a cache or database call
      setTimeout(() => {
        // this information should come from your cache or database
        const users = [
          {
            id: 1,
            name: 'mariotacke',
            token: 'secret_token',
          },
        ];
  
        const user = users.find((user) => user.token === token);
  
        if (!user) {
          return reject('USER_NOT_FOUND');
        }
  
        return resolve(user);
      }, 200);
    });
}

require('socketio-auth')(io, {
    authenticate: async (socket, data, callback) => {
        const { user } = data;
        try {   
            /**
             * NX will make sure that we only set the key if it does not already exist. 
             * If it does, the command returns null
             */
            const canConnect = await REDIS
              .setAsync(`users:${user.id}`, socket.id, 'NX', 'EX', 30);
              /**
               * We also added EX 30 to the command to auto-expire the lock after 30 seconds. 
               * This is important because our server or Redis might crash and we don’t want to lock out our users forever. 
               * The reason I chose 30 seconds is because Socket.IO has a default ping of 25 seconds, that is,
               * every 25 seconds it will probe connected users to see if they are still connected. 
               * In the next section, we will make use of this to renew the lock.
               */
            console.log({ SET_NOT_EXIST: canConnect })
            if (!canConnect) {
              return callback({ message: 'ALREADY_LOGGED_IN' });
            }
        
            socket.user = user;
            return callback(null, { error: false, message: 'auth_successed' });
        } catch (e) {
            console.log({ e: e.message })
            console.log(`Socket ${socket.id} unauthorized.`);
            return callback({ error: true, message: 'auth_failure' });
        }
    },
    postAuthenticate: async (socket) => {
        console.log(`Socket ${socket.id} authenticated.`);
        /**
         * We use this mechanism to refresh the expiration time on the key every 25 seconds.
         * Phải kiểm tra sau sự kiện đã xác thực thành công 'authenticated'
         * - Nếu sau 25s được PING auto của socket -> ko có kết nối từ SOCKET_UD -> CHẤYM DỨT KẾT NỐI
         */
        socket.conn.on('packet', async packet => {
            if (socket.auth && packet.type === 'ping') {
              /**
               * TIẾP TỤC GIA HẠN (renew) bằng:
               * 'XX' states that it will only be set if it already exists
               */
                let setRedis = await REDIS.setAsync(`users:${socket.user.id}`, socket.id, 'XX', 'EX', 30);
                console.log({ SET_EXIST: setRedis })
            }
        });
    },
    disconnect: async (socket) => {
        console.log(`Socket ${socket.id} disconnected.`);
        /**
         * Khi User cố ý thoát(đóng tab, tắt trình duyệt)
         */
        if (socket.user) {
            let infoDel = await REDIS.delAsync(`users:${socket.user.id}`);
            console.log({ DEL_REDIS: infoDel })
        }
    },
});

server.listen(3900, () => console.log({ _: `SERVER started at ***: 3900` }));