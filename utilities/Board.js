class Board{
    constructor(){
        this.gameSet = new Set();
        this.end = false;
        this.turn = Math.floor(Math.random() * 2);
    }

    mark = (number) => {
        if(this.gameSet.has(number)){
            return false;
        }
        this.gameSet.add(number);
        return true;
    }


    toggleTurn = () => {
        this.turn = 1 - this.turn;
    }
}

module.exports = Board;