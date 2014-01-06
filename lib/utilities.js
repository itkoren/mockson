var randomDate = exports.randomDate = function randomDate() {
    return new Date(Math.floor(Math.random() * new Date().valueOf()));
};

var padLeft = exports.padLeft = function padLeft(num, length, padder){
    return Array(length - String(num).length + 1).join(padder || "0") + num;
};

var isArray = exports.isArray = function isArray(obj) {
    return ("[object Array]" === Object.prototype.toString.call(obj));
};

var resolveType = exports.resolveType = function resolveType(obj) {
    return isArray(obj) ? "array" : ((null === obj) ? "null" : typeof obj);
};

var padArray = exports.padArray = function padArray(obj) {
    return isArray(obj) ? obj : [obj];
};