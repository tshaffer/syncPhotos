const path = require('path');
const fs = require('fs');

console.log("syncPhotos - start");
console.log("__dirname: ", __dirname);

var pizzaFolder = path.basename('C:\\Users\\Ted\Documents\\PizzaFolder');
console.log(pizzaFolder);

var pizzaFolder2 = path.win32.basename('C:\\Users\\Ted\Documents\\PizzaFolder');
console.log(pizzaFolder2);

var testFolder = 'C:\\Users\\Ted\\Documents\\PizzaFolder';
fs.readdir(testFolder, (err, files) => {
  files.forEach(file => {
    console.log(file);
  });
})