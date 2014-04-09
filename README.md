len
===

![len logo](https://github.com/binocarlos/len/raw/master/graphics/logosmall.png "Len Logo")

![Build status](https://api.travis-ci.org/binocarlos/len.png)

Calendar database for resource bookings using leveldb

## installation

```
$ npm install len
```

## usage

You create a len database by passing in an existing [leveldb](https://github.com/rvagg/node-levelup) - this can also be a [sub-level](https://github.com/dominictarr/level-sublevel)

```js
var len = require('len');
var level = require('level');

// create a new leveldb - this can also be a sub-level
var leveldb = level('/tmp/lentest');

// create a new lem store using the leveldb
var lendb = len(db);
```

You can add resources - these are things in the real world that can be 'booked'.

A booking represents a resource being used for a period of time.

Here we create a booking for bob the mechanic:

```js

// start at 9.30
var start = new Date('04/03/14 09:30:00');
// end at 13.30
var end = new Date('04/03/14 13:30:00');

lendb.saveBooking('/mechanics/bob', {
	id:14, 
	start:start,
	end:end,
	meta:{
		name:'Fix Car',
		customer:34
	}
}, function(error, booking){

	// bob is all booked in

})
```

We can ask len about bookings for all mechanics in a particular month:

```js
var through = require('through');
var start = new Date('03/01/2014');
var end = new Date('04/01/2014').getTime();

var bookings_in_month = 0;

lendb.createBookingStream('mechanics', {
	start:start,
	end:end,
	// this means booking must start and end inside the window
	inclusive:true
}).pipe(through(function(booking){

	// booking is an object with 'id', 'start', 'end' and 'meta' keys
	bookings_in_month++;
	
}, function(){
	console.log('there are: ' + bookings_in_month.length + ' mechanic bookings in March');

}))
```

## resource tree

Resources are created using paths and this can be a useful way to get booking reports at various layers.

For example - imagine we have a team that does some projects - we want to be able to ask the following questions:

 * the start and end point of one project
 * an array of bookings for one project
 * an array of bookings for all projects
 * an array of bookings between certain points for all projects

This can be done using the paths you give to resources - if we create resources with the following paths:

 * team.alpha.project.1
 * team.alpha.project.2

## queries

Then we can ask for the start and end for one project:

```js
lendb.getRange('team.alpha.project.1', function(err, bounds){
	// bounds.start = timestamp of the earliest start of booking for the project
	// bounds.end = timestamp of the latest end of booking for the project
})
```

get a readstream of bookings:

```js
// bookings for one project
lendb.createBookingStream('team.alpha.project.1').pipe(through(function(booking){
	// booking is an object
}))

// bookings for one team's projects
lendb.createBookingStream('team.alpha.project')
```

get a readstream of bookings withing a time period

```js
var start = new Date('03/04/14 09:30:00');
var end = new Date('03/04/14 13:30:00');

lendb.createBookingStream('team.alpha.project', {
	start:start,
	end:end
})
```

## api

#### `len(leveldb);`

Create a new len database from the provided [leveldb](https://github.com/rvagg/node-levelup).  This can be a [level-sublevel](https://github.com/dominictarr/level-sublevel) so you can partition len into an existing database.

```js
var len = require('len');
var level = require('level');

var leveldb = level('/tmp/mylem');
var lendb = len(leveldb);
```

#### `lendb.loadBooking(resourcepath, bookingid, callback)`

Fetch a booking record using the resourcepath and booking id:

```js
lendb.loadBooking('project.1', 14, function(err, booking){

	// booking is an object with 'id', 'start', 'end' and 'meta' keys

})
```

#### `lendb.saveBooking(resourcepath, booking, callback)`

Insert/update a booking into the schedule for a resource.

booking is an object:

``` js
{
	id: 0,                   // the id of the booking you are saving - this is auto-created is left blank
	start: Date(),           // the start timestamp of the booking
	end: Date(),             // the end timestamp of the booking
	meta: {                  // an object with anything you like for the booking meta-data
		customer:12,
		comments:'apples'
	}
}
```

The start and end timestamps are required - the meta object is converted to a JSON string and is returned in the 'meta' property of bookings.

```js
var start = new Date('03/04/14 09:30:00');
var end = new Date('03/04/14 13:30:00');

lendb.createBooking('project.1', {
	id:14,
	start:start,
	end:end,
	meta:{
		name:'meta data here'
	}
}, function(err){

	// the booking is created for the resource

})
```

#### `lendb.removeBooking(resourcepath, bookingid, callback)`

Remove a booking from the schedule

```js
resource.removeBooking('project.1', 14, function(err){

	// the booking is removed

})
```

#### `lendb.getRange(resourcepath, [window], callback)`

Use this to get the start and end date for bookings in a resource

```js
lendb.getRange('projects.1', function(err, range){
	// range.start and range.end are timestamps
})
```

You can also pass a window to constrain the results:

```js
lendb.getRange('projects.1', {
	start:start,
	end:end
}, function(err, range){

	// range.start and range.end are timestamps

})
```

#### `lendb.createBookingStream(resourcepath, [window], callback)`

Use this to get an object stream of bookings for a given resource.

```js
var through = require('through');

lendb.createBookingStream('mechanics.bob', {
	start:start,
	end:end
}).pipe(through(function(booking){

	console.log('booking found');
	console.log(booking.id);
	
}))
```

You can also query the booking stream using a time-window:

```js
var through = require('through');
var start = new Date('03/01/2014');
var end = new Date('04/01/2014').getTime();

var bookings_in_month = 0;

lendb.createBookingStream('mechanics.bob', {
	start:start,
	end:end,
	inclusive:true
}).pipe(through(function(booking){

	// booking is an object with 'id', 'start', 'end' and 'meta' keys
	bookings_in_month++;
	
}, function(){
	console.log('there are: ' + bookings_in_month.length + ' bookings for bob in March');

}))
```

the inclusive option controls whether bookings have to start and end inside the time window (true) or if any part of it is in the time window (false)

## license

MIT
