var app = require('express')(),
	http = require('http').Server(app),
	io = require('socket.io')(http),
	uuid=require('uuid'),
	p2=require('p2');

app.get('/', function(req, res){
  res.send('Hello world');
});

io.on('connection', function(socket){
  console.log('a user connected');
  socket.emit('connected',{id:uuid()});
  socket.on("action",function(msg){
	console.log(msg);
	socket.broadcast.emit("action",msg);
  });
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});