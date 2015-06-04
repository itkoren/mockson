var fs = require("fs");
var http = require("http");
var path = require("path");

var async = require("async");
var express = require("express");
var cors = require("cors");
var toobusy = require("toobusy-js");
var domain = require("express-domain-middleware");
var mathjs = require("mathjs");
var _defaults = require("lodash-node/modern/object/defaults");
var generator = require("./generator");

var log = require("./log");
var utilities = require("./utilities");
var config = require("../config/server.json");

var math = mathjs();
var mockson = {};

mockson.logger = log.getLogger("system");
mockson.defaults = {
    servicesDirectory: "./services/",
    allowedDomains: ["*"]
};
mockson.services = {};
mockson.statuses = {
    get: 200,
    post: 201,
    put: 200,
    delete: 204
};

//
// ## 'createServer(options)'
//
// Creates a new instance of mockson Server with options:
//  * 'port' - The HTTP port to listen on. If 'process.env.PORT' is set, _it overrides this value_.
//
var createServer = function(options) {
    mockson.logger.info("Create and Configure the mockson Server");
    
    options = options || {};
    mockson.options = _defaults(options, _defaults(config, mockson.defaults));
    mockson.logger.debug({ options: mockson.options});
    
    mockson.router = express();
    
    // configure all envs
    mockson.router.configure(function() {
        mockson.router.use(domain);
        
        // Middleware which turns off connections that are
        // using the Keep-Alive header to stay on when we want to stop the server.
        mockson.router.set("exiting", false);
        mockson.router.use(function(req, res, next) {
            // Sorry Keep-Alive connections, but we need to part ways
            if (true === mockson.router.settings.exiting === true) {
              req.connection.setTimeout(1);
            }
        
            next();
        });
        
        // Middleware to serves the connect favicon, or the favicon located by the given path.
        mockson.router.use(express.favicon());
        
        // Middleware which blocks requests when we're too busy
        mockson.router.use(function(req, res, next) {
          if (mockson.options.toobusy && toobusy()) {
            res.send(503, "Opppppppppps..... I'm busy right now, sorry.");
          } 
          else {
            next();
          } 
        });
        
        // Middleware to log requests with the given options or a format string.
        mockson.router.use(express.logger("dev"));
        
        // this.router.use(express.bodyParser());
        // switched to use express.urlencoded and express.json, instead of bodyParser
        // https://github.com/senchalabs/connect/wiki/Connect-3.0
        // 
        // Middleware to parse x-ww-form-urlencoded request bodies,
        // providing the parsed object as req.body using
        mockson.router.use(express.urlencoded());
        
        // Middleware to parse JSON request bodies, providing the
        // parsed object as req.body.
        mockson.router.use(express.json());
        
        // Middleware to provides faux HTTP method support.
        mockson.router.use(express.methodOverride());
        
        // Middleware to compress response data with gzip/deflate (support content-encoding methods).
        mockson.router.use(express.compress());
        
        // Enable CORS for everything
        var corsOptions;
        if (mockson.options.allowedDomains            && 
            0 < mockson.options.allowedDomains.length &&
            -1 === mockson.options.allowedDomains.indexOf("*")) {
                corsOptions = {
                  origin: function(origin, callback){
                    var originIsAllowed = (-1 !== mockson.options.allowedDomains.indexOf(origin));
                    callback(null, originIsAllowed);
                  }
                };
        }
        
        mockson.router.use(cors(corsOptions));
        mockson.router.options("*", cors(corsOptions));
        
        mockson.router.use(express.static(path.resolve(__dirname, "../client")));
        
        // Set the error handler
        mockson.router.use(function errorHandler(err, req, res, next) {
          mockson.logger.error("error on request %d %s %s: %j", process.domain.id, req.method, req.url, err);
          res.send(500, "Opppppppppps..... Something bad happened, sorry. :(");
          
          if (err.domain) {
            // should think about gracefully stopping & respawning the server
            // since an unhandled error might put the application into an unknown state
          }
        });
    });
    
    // configure development only
    mockson.router.configure("development", function() {
        // Middleware for Development error handler, providing stack traces
        // and error message responses for requests accepting text, html,
        // or json.
        mockson.router.use(express.errorHandler());
    });
    
    mockson.router.post("/__mockson/generator", function(req, res, next){
        res.set("Content-Type", "application/json; charset=utf-8"); // Make sure the response's content-type is set to JSON
        res.json(generator.fromTemplate(req.body || {}));
    });
};

var startServer = function() {
    mockson.logger.info("Start the mockson Server");
    mockson.server = http.createServer(mockson.router);
    mockson.server.listen(process.env.PORT || mockson.options.port || 3000, process.env.IP || "0.0.0.0", function() {
      var addr = mockson.server.address();
      mockson.logger.info("mockson server listening at", addr.address + ":" + addr.port);
    });    
    
    process.on("SIGINT", function() {
      stop();
    });
};

var matchServiceResponseItem = function(req, serviceDef, matches) {
    var root;
    var found;
    var matched;
    var key;
    var attrs;
    var type;
    var param;
    var moveon;
    
    if (!mockson.services[serviceDef.matches.service].cache || true === mockson.services[serviceDef.matches.service].cache) {
        root = processResponseBody(void 0, mockson.services[serviceDef.matches.service], "get");
    } 
    else {
        root = mockson.services[serviceDef.matches.service].cache;
    }
    
    // Currentlly I only implement the matching is the root service returns an array of results
    if (utilities.isArray(root)) {
        root.every(function(element, index, array) {
            for (key in matches) {
                if (key && matches.hasOwnProperty(key) && matches[key]) {
                    attrs = utilities.padArray(matches[key]);
                    
                    moveon = attrs.every(function(elem, ind, arr) {
                        matched = /\{+(params|headers|query)+(\.)+(\w+)+\}+(.*)/g.exec(elem);
                        if (matched && 3 < matched.length) {
                            type = matched[1];
                            param = matched[3];
                            
                            if (element[key] === (req[type] && req[type][param])) {
                                return false;
                            }
                        } 
                        else {
                            if (element[key] == elem) {
                                return false;
                            }
                        }
                        
                        return true;
                    });
                }
                
                if (moveon) {
                    break;
                }
            }
            
            if (!moveon) {
                found = { index: index, element: element };
                return false;
            }
            
            return true;
        });
    }
    
    return found;
};

var processResponseHeaders = function(req, serviceDef, method) {
    var headers;
    var header;
    var key;
    var generated;
    var matched;
    var parsed;
    var param;
    var type;
    var additions;
    
    mockson.logger.info("Process headers");
    method = method || req.route.method;
    headers = serviceDef.headers ? (serviceDef.headers[method] || serviceDef.headers["*"]) : void 0;
    if (headers) {
        parsed = {};
        for (key in headers) {
            header = headers[key];
            if (key && headers.hasOwnProperty(key) && header) {
                header = utilities.padArray(header);
                
                header.every(function(element, index, array) {
                    generated = generator.fromTemplate(element);
                    matched = /\{+(params|headers|query)+(\.)+(\w+)+\}+(.*)/g.exec(generated);
                    if (matched && 3 < matched.length) {
                        type = matched[1];
                        param = matched[3];
                        additions = matched[4];
                        
                        generated = req[type] && req[type][param];
                        if (generated && additions) {
                            generated = math.eval(generated + additions) || (generated + additions);
                        }
                    }
                    
                    if (generated) {
                        parsed[key] = generated;  
                        
                        // Break the iteration
                        return false;
                    }
                    
                    // Continue iteration
                    return true;
                });
            }
        }
        
        mockson.logger.debug(parsed);
        
        return parsed;
    }
};

var processResponseBody = function(req, serviceDef, method) {
    var body;
    var keys;
    var template;
    var matches;
    var found;
    var processor;
    
    mockson.logger.info("Process body");
    method = method || req.route.method;
    template = serviceDef.templates ? (serviceDef.templates[method] || serviceDef.templates["*"]) : void 0;
    matches = serviceDef.matches ? (serviceDef.matches[method] || serviceDef.matches["*"]) : void 0;
    
    processor = {
        get: function() {
            if (template && (!serviceDef.cache || true === serviceDef.cache)) {
                body = generator.fromTemplate(template);
                
                if (serviceDef.unwrap && (serviceDef.unwrap[method] || serviceDef.unwrap["*"])) {
                    keys = Object.keys(body);
                    
                    if (1 === keys.length) {
                        body = body[keys[0]];  
                    }
                }
                if (serviceDef.cache) {
                    serviceDef.cache = body;
                }
            } 
            else if (serviceDef.cache) {
                body = serviceDef.cache;
            }
            else if (matches && mockson.services[serviceDef.matches.service]) {
                found = matchServiceResponseItem(req, serviceDef, matches);
                
                if (found) {
                    body = found.element;    
                }
            }
        },
        post: function() {
            var data;
            if (template) {
                if (!serviceDef.cache || true === serviceDef.cache) {
                    data = processResponseBody(void 0, serviceDef, "get");
                } else {
                    data = serviceDef.cache;
                }
                
                body = generator.fromTemplate(template);
                // Currentlly I only implement the post for services which returns an array of results for "GET"
                if (utilities.isArray(serviceDef.cache)) {
                    serviceDef.cache.push(_defaults(req.body, body));
                }
            }
        },
        put: function() {
            if (template) {
                body = generator.fromTemplate(template);
            }
            
            if (!matches && serviceDef.cache) {
                serviceDef.cache = req.body;
            } else if (matches && mockson.services[serviceDef.matches.service]) {
                found = matchServiceResponseItem(req, serviceDef, matches);
                
                if (found && serviceDef.cache) {
                    serviceDef.cache.splice(found.index, 1, _defaults(req.body, found.element));
                }
            }
        },
        delete: function() {
            if (template) {
                body = generator.fromTemplate(template);
            }
            
            if (!matches && serviceDef.cache) {
                serviceDef.cache = void 0;
            } else if (matches && mockson.services[serviceDef.matches.service]) {
                found = matchServiceResponseItem(req, serviceDef, matches);
                
                if (found && serviceDef.cache) {
                    serviceDef.cache.splice(found.index, 1);    
                }
            }
        }
    };
    
    if (processor[method]) {
        processor[method]();
    }
    
    mockson.logger.debug(body);
    
    return body;
};

var processResponseStatus = function(req, serviceDef, method) {
    var status;
    
    mockson.logger.info("Process status");
    method = method || req.route.method; 
    status = serviceDef.status ? (serviceDef.status[method] || serviceDef.status["*"]) : void 0;
    
    if (!status) {
        status = mockson.statuses[method];
    }
    
    mockson.logger.debug(status);
    
    return status;
};

var processResponse = function(req, res, serviceDef, next) {
    var body;
    var headers;
    var status;
    var empty;
    
    mockson.logger.info("Process response for '" + serviceDef.serviceUrl + "'");  
    
    headers = processResponseHeaders(req, serviceDef);
    res.set("Content-Type", "application/json; charset=utf-8"); // Make sure the response's content-type is set to JSON
    
    if (headers) {
        res.set(headers);    
    }
    
    status = processResponseStatus(req, serviceDef);
    if (status) {
        res.status(status);
    }
    
    body = processResponseBody(req, serviceDef);
    
    // Check for empty response handling
    if (!body) {
        empty = serviceDef.empty ? (serviceDef.empty[req.route.method] || serviceDef.empty["*"]) : void 0; 
        
        if (empty) {
            if (empty.headers) {
                res.set(empty.headers);
            }
            
            if (empty.status) {
                res.status(empty.status);
            }
            
            body = empty.body;
        }
    }
    
    if (serviceDef.jsonp && req.query[serviceDef.jsonp]) {
        res.send(req.query[serviceDef.jsonp] + "(" + (JSON.stringify(body) || "") + ");");
    } 
    else {
        res.json(body);
    }
    
    mockson.logger.info("Response for '" + serviceDef.serviceUrl + "' was processed");   
};

var setRoute = function(latency, verb, serviceDef) {
    try {
        mockson.router[verb]("/" + serviceDef.serviceUrl, function(req, res, next) {
            mockson.logger.info("Got request to '" + serviceDef.serviceUrl + "'");
            if (0 < latency) {
                setTimeout(function() {
                    processResponse(req, res, serviceDef, next);  
                }, latency);
            } 
            else {
                processResponse(req, res, serviceDef, next);      
            }
        });
        mockson.logger.info("Set route: " + verb.toUpperCase() + " " + serviceDef.serviceUrl + " : " +
                latency + " ms");    
                
        return true;
    } 
    catch(err) {
        mockson.logger.info("Cannot set route: " + verb.toUpperCase() + " " + serviceDef.serviceUrl + " : " +
                latency + " ms");
        if (err) {
            mockson.logger.error({ error: err });   
        }
        
        return false;
    }
};

var setRoutes = function(serviceDef) {
    var latency = serviceDef.latency || 0;
    var success = true;
    var i;
    var verb;
    
    for (i = 0; i < serviceDef.verbs.length; i++) {
        verb = serviceDef.verbs[i];
        success = success && setRoute(latency, verb, serviceDef);
    }
    
    return success;
};

var parseServiceDefinition = function(serviceDef) {
    var data = serviceDef;
    var i;
    var def;
    
    try {
        data = JSON.parse(data);
    } 
    catch (err) {
        if (err) {
            mockson.logger.error({ error: err });   
        }
        
        mockson.logger.error(data);
        return false;
    }
        
    mockson.logger.debug(data);
    
    data = utilities.padArray(data);
    
    for (i = 0; i < data.length; i++) {
        def = data[i];
        
        if (!def || !def.serviceUrl) {
            mockson.logger.error("Service definition [" + i + "] is invalid and missing the 'serviceUrl' attribute");
            continue;
        } 
        else if (!def.verbs || 0 === def.verbs.length) {
            mockson.logger.error("Service definition [" + i + "] is invalid and missing the 'verbs' attribute");
            continue;
        }   
        
        if (!setRoutes(def)) {
            continue;
        }
        
        mockson.services[def.serviceUrl] = def;
    }
    
    return true;
};

var loadServiceDefinition = function(serviceDef, callback) {
    var location = mockson.options.servicesDirectory;
    var file = path.resolve(location, serviceDef);
    mockson.logger.info("Load service '" + file + "'");
    
    fs.readFile(file, "utf8", function (err, data) {
        if (err) {
            mockson.logger.error({ error: err });
            callback(err);
            return;
        }
     
        if (!parseServiceDefinition(data)) {
            mockson.logger.error("Cannot parse service definition JSON at '" + file + "'");
        }
        
        callback();
    });
};

var loadServiceDefinitions = function() {
    var location = mockson.options.servicesDirectory;
    mockson.logger.info("Load services from '" + location + "'");
    
    async.waterfall([
        function(callback) {
            fs.exists(location, function (exists) {
                if (!exists) {
                    callback("No directory '" + location + "' exists!");    
                }
                
                callback();
            });
        },
        function(callback){
            fs.readdir(location, callback);
        },
        function(serviceDefs, callback){
            // assuming serviceDefs is an array of file names and loadServiceDefinition is a function
            // to load the service definition from that file:
            if (!serviceDefs || 0 === serviceDefs.length) {
                mockson.logger.warn("No service definitions found at '" + location + "'");
                return;
            }
            
            async.each(serviceDefs, loadServiceDefinition, callback);
        }
    ],
    // optional callback
    function(err, results) {
        if (err) {
            mockson.logger.error({ error: err });   
            return;
        }
        
        // All services were loaded
        mockson.logger.info("Services Loaded");
        
        mockson.logger.info("Configure static pages");
        mockson.router.use(express.static(path.resolve(__dirname, "client")));
        
        startServer();
    });
};

var start = exports.start = function(options) {
    createServer(options);
    loadServiceDefinitions();
};

var stop = exports.stop = function() {
    mockson.logger.info("Stop the mockson Server");
    // Try to exit gracefully
    mockson.router.set("exiting", true);
    mockson.server.close(function(){
        // calling .shutdown allows your process to exit normally
        toobusy.shutdown();
        process.exit(0);    
    });
    
    // If after an acceptable time limit is reached, we still have
    // connections lingering around for some reason, just kill the process... 
    setTimeout(function() {
        process.exit(1);
    }, 2*60*1000 + 10*1000); // 2m10s (nodejs default is 2m)
};