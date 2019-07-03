var socket = io('http://localhost:3900');

socket.on('connect', function(){
    let user = {
        id: 'khanhney2'
    }
    socket.emit('authentication', { user });
    socket.on('authenticated', message => {
      console.log(message)
    });

    socket.on('unauthorized', (reason) => {
        console.log('Unauthorized:', reason);
        socket.disconnect();
    });
});