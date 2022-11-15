const lobby = require('../socket');
const Room = require('../schemas/room')
const redisCli = require('../redis');

const autoIncrease = function () {
    let a = 1;
    const inner = function () {
        return a++;
    };
    return inner;
};
const autoInc = autoIncrease();



// 로비에 연결 되었을때 
lobby.on('connection',  async(socket) => {
  console.log(socket.id + ' join lobby !') 

    socket.on('getNickname', (nickname) => {
      socket.nickname = nickname
      socket.emit('getNickname', socket.nickname)
      console.log(socket.nickname)
    })
    

      // 방 퇴장
  socket.on('leaveRoom', async(roomNum) => { 
    const lvRoom = await Room.findByIdAndUpdate(
      {_id : roomNum},
      {$inc : {currentCount : -1}}
    )
    const udtRoom = await Room.findOne({_id : roomNum})

    if(udtRoom.currentCount <= 8 && udtRoom.currentCount >= 1){
    socket.leave(`/gameRoom${roomNum}`)
    socket.emit("leaveRoom", udtRoom)
    }else if(udtRoom.currentCount <= 0){
      
     const dteRoom = await Room.deleteOne({_id : roomNum})

      console.log("방이 삭제 되었습니다.")
      socket.emit("leaveRoom", dteRoom)
    }
  });

        // 게임방생성
    socket.on('createRoom', async(gameMode, roomTitle) => { // roomName 과 gameMode를 받아서 방 생성 함수를 실행

      let autoNum = autoInc();
      
      const creRoom =   await Room.create({
          "_id": autoNum,
          "gameMode": gameMode,
          "roomTitle": roomTitle,
          "roomMaker" : socket.nickname,
        });
  
      const makedRoom =  await Room.findOne({_id : autoNum})
      redisCli.set('ready', 1)
  
        socket.join(`/gameRoom${autoNum}`)
        console.log(makedRoom)
        socket.emit("createRoom", makedRoom); 
      })

    // 게임방입장
     socket.on('enterRoom', async(roomNum) => {



        const udtRoom = await Room.findOne({_id : roomNum})

      if(udtRoom.currentCount <= 8){

        const entRoom = await Room.findByIdAndUpdate(
          {_id : roomNum}, 
          {$inc : {currentCount : 1}}
          )
        
        const currntRoom = await Room.findOne({_id: roomNum})
        
        await socket.join(`/gameRoom${roomNum}`)
        console.log(socket.adapter.rooms)
        console.log(currntRoom)
        socket.emit('enterRoom', currntRoom);
      }else if(udtRoom.currentCount > 8){
        console.log("풀방입니다.")
      }

     
  });




  // 게임 준비
  socket.on('ready', async(roomNum) => {
    let readyCount = await redisCli.get('ready')
    const findRoom = await Room.findOne({_id : roomNum})
    await redisCli.incr('ready')
    console.log("준비 완료 !")
    console.log(readyCount, findRoom.currentCount)
    console.log("게임시작 5초전!")
    setTimeout(async() => {
      if(findRoom.currentCount == readyCount){
        console.log("게임 시작 ! ")
        lobby.to(`/gameRoom${roomNum}`).emit("gameStart")
        await redisCli.del('ready')
    }
    }, 5000)
    
  })

  // 준비 취소
  socket.on('unReady', async() => {
    await redisCli.decr('ready')
    console.log("준비 취소 !")
  })

})

