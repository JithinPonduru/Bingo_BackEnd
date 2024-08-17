const generateRoomCode = () => {
    let roomCode = "";
    for(let i = 0 ; i < 6 ; i++){
        roomCode += generateRandomChar();
    }
    return roomCode;
}

const generateRandomChar = () => {
    let chars = "0123456789abcdefghijklmnopqrstuvwxyz@#$";
    return chars[Math.floor(Math.random() * chars.length)];
}

const getRandomArrangement = () => {

    let arr = [];
    for(let i = 1 ; i <= 25 ; i++){
        arr.push(i);
    }

    let pMap = new Map();  

    arr.sort(() => Math.random() - 0.5);

    for(let i = 0 ; i < 5; i++){
        for(let j = 0 ; j < 5 ; j++){
           pMap.set(arr[i*5+j],{x:i,y:j});
        }
    }
    return pMap;
}

const getRandomFirst = () => {
    return (Math.floor(Math.random() * 2));
}

const generateId = () => {
    let id = "";
    for(let i = 0 ; i < 10; i++){
        id += generateRandomChar();
    }
    return id;
}

module.exports = {generateRoomCode, generateId, getRandomArrangement, getRandomFirst};
