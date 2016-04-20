import { deepFreeze } from './DeepFreezer';

var obj = {hello: true};
deepFreeze(obj, true);
console.log(obj);
obj.hello = false;
console.log(obj);
