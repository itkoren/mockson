
█▀▄▀█ █▀▀█ █▀▀ █░█ █▀▀ █▀▀█ █▀▀▄ 
█░▀░█ █░░█ █░░ █▀▄ ▀▀█ █░░█ █░░█ 
▀░░░▀ ▀▀▀▀ ▀▀▀ ▀░▀ ▀▀▀ ▀▀▀▀ ▀░░▀ 

A powerful and flexible server for mocking API's of a RESTful services, for development purposes. 

Place some files with json templates into the `services` folder and the service will respond to RESTful calls for GET, 
POST, PUT and DELETE.

Each of us has at least once created JSON files for simulating API's, but these were usually just constructed from a single static object propagated without unique fields. 

mockson was created to help frontend developers with this task.

Services can be stateful, so flows are supported. 

The data is not really stored but only kept in memory, so each time you restart the application, it resets itself to the original state.

mockson has a convenient template syntax and it's very very simple.

Install
-------

    npm install mockson


Start
-------

    node server.js start
