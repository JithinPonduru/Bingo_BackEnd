class Player {
    constructor(name, room, id){
        this.name = name; 
        this.room = room;
        this.id = id;
        this.count = 0;
        this.pMap = new Map();
    }
}

module.exports =  Player;