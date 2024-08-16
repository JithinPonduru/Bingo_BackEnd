class Board{
    constructor(){
        this.gameSet = new Set();
        this.end = false;
        this.turn = Math.floor(Math.random() * 2);
    }

    mark = (number) => {
        if(this.gameSet.has(number)){
            throw new Error("Number already marked");
        }
        this.gameSet.add(number);
    }

    toggleTurn = () => {
        this.turn = 1 - this.turn;
    }
}

module.exports = Board;