class Player {
    constructor(name, room, socketId){
        this.name = name; 
        this.room = room;
        this.socketId = socketId;
        this.count = 0;
        this.pMap = new Map();
    }
}

module.exports =  Player;