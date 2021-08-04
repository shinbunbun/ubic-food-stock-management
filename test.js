const date = new Date();
console.log(date);
let deadLine = date.getTime() + 259200000;
console.log(deadLine);
deadLine = new Date(deadLine);
console.log(deadLine);
