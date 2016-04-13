import DeepFreezer from './DeepFreezer';

var obj = {hello: true};
DeepFreezer.deepFreeze(obj, true);
console.log(obj);
obj.hello = false;
console.log(obj);
