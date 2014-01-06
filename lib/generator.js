var faker = require("Faker");
var uuid = require("node-uuid");
var utilities = require("./utilities");

var fromTemplate = exports.fromTemplate = function(template, name) {
    var length = 0;
    var matches = (name || "").match(/\w+\|(\d+)-(\d+)/);
    var generated = null;
    var min;
    var max;
    var matchesInc;
    var increment;
    var keys;
    var key;
    var randomData;
    var i;
    var p;
    
    if (matches) {
        min = parseInt(matches[1], 10);
        max = parseInt(matches[2], 10);
        length = faker.Helpers.randomNumber(max - min) + min;
    }   
    
    switch (utilities.resolveType(template)) {
        case "array":
            generated = [];
            for (i = 0; i < length; i++) {
                generated[i] = fromTemplate(template[0]);
            }
            break;

        case "object":
            generated = {};
            for (p in template) {
                generated[p.replace(/\|(\d+-\d+|\+\d+)/, "")] = fromTemplate(template[p], p);
                matchesInc = p.match(/\w+\|\+(\d+)/);
                if (matchesInc && "number" === utilities.resolveType(template[p])) {
                    increment = parseInt(matchesInc[1], 10);
                    template[p] += increment;
                }
            }
            break;

        case "number":
            generated = (matches) ? length : template;
            break;

        case "boolean":
            generated = (matches) ? faker.Helpers.randomNumber(2) >= 0.5 : template;
            break;

        case "string":
            if (template.length) {
                generated = "";
                length = length || 1;
                for (i = 0; i < length; i++) {
                    generated += template;
                }
                keys = generated.match(/\{\{+([A-Z_0-9\(\)\[\],]+\}\}+)/g) || [];
                for (i = 0; i < keys.length; i++) {
                    key = keys[i];
                    randomData = randomizeData(key);
                    generated = generated.replace(key, randomData);
                    if ("number" === utilities.resolveType(randomData)) {
                        generated = Number(generated);
                    }
                }
            } 
            else {
                generated = "";
                for (i = 0; i < length; i++) {
                    generated += String.fromCharCode(Math.floor(faker.random.number() * 255));
                }
            }
            break;

        default:
            generated = template;
            break;
    }
    
    return generated;

};

function randomizeData(key) {
    var params = key.match(/\(([^\)]+)\)/g) || [];
    
    if (!(key in generators)) {
        console.log(key);
        console.log(params);
        
        return key;
    }
    
    var generator = generators[key];
    
    switch (utilities.resolveType(generator)) {
        case "array":
            return generator[Math.floor(generator.length * Math.random())];
            
        case "function":
            return generator();
    }
}

var generators = {
    "{{NUMBER}}" : function() {
        return faker.Helpers.randomNumber(10);
    },
    "{{LETTER}}" : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split(""),
    "{{NAME}}" : function() {
        return faker.Name.findName();    
    },
    "{{NAME[FIRST]}}" : function() {
        return faker.Name.firstName();
    },
    "{{NAME[LAST]}}" : function() {
        return faker.Name.lastName();
    },
    "{{GENDER}}" : "Male,Female".split(","),
    "{{EMAIL}}" : function() {
        return faker.Internet.email();
    },
    "{{DOMAIN}}" : function() {
        return faker.Internet.domainName();
    },
    "{{IP}}" : function() {
        return faker.Internet.ip();
    },
    "{{DATE[YYYY]}}" : function() {
        var yyyy = utilities.randomDate().getFullYear();
        return yyyy + "";
    },
    "{{DATE[DD]}}" : function() {
        return utilities.padLeft(utilities.randomDate().getDate(), 2);
    },
    "{{DATE[MM]}}" : function() {
        return utilities.padLeft(utilities.randomDate().getMonth() + 1, 2);
    },
    "{{TIME[HH]}}" : function() {
        return utilities.padLeft(utilities.randomDate().getHours(), 2);
    },
    "{{TIME[MM]}}" : function() {
        return utilities.padLeft(utilities.randomDate().getMinutes(), 2);
    },
    "{{TIME[SS]}}" : function() {
        return utilities.padLeft(utilities.randomDate().getSeconds(), 2);
    },
    "{{ZIP}}" : function() {
        return faker.Address.zipCode();
    },
    "{{CITY}}" : function() {
        return faker.Address.city();
    },
    "{{STREET}}" : function() {
        return faker.Address.streetAddress();
    },
    "{{PHONE}}" : function() {
        return faker.PhoneNumber.phoneNumber();
    },
    "{{UUID}}" : function() {
        return uuid.v4();    
    },
    "{{IPSUM}}" : function() {
        return faker.Lorem.words(1);
    },
    "{{IPSUM[N]}}" : function() {
        return faker.Lorem.words(Math.floor(Math.random() * faker.definitions.lorem.length / 2));
    }
};