var EventEmitter = require('events').EventEmitter
var util = require('util')
var liveStream = require('level-live-stream');
var through = require('through');
var tools = require('./tools');

var Schedule = require('./schedule');

module.exports = function(db, options){

	if(!db){
		throw new Error('db required')
	}

	options = options || {}

	return new Len(db, options);
}

module.exports.tools = tools;

function Len(db, options){
	var self = this

	EventEmitter.call(this)

	this._db = db
	this._options = options

	this._schedule = new Schedule(this._db);

	this._livestream = liveStream(this._db);
	this._livestream.on('data', function(data){
		self.emit('data', data);
	})
}

util.inherits(Len, EventEmitter)

Len.prototype.loadBooking = function(path, id, callback){
	var key = tools.parsedots(tools.bookingkey(path, id));

	this._db.get(key, function(err, val){
		if(err){
			return callback(err);
		}
		callback(null, val ? JSON.parse(val) : null);
	})
}

Len.prototype.saveBooking = function(path, id, start, end, meta, callback){
	var self = this;
	this.removeBooking(path, id, function(err){
		if(err){
			return callback(err);
		}

		var booking = {
			id:id,
			resource:path,
			start:start,
			end:end,
			meta:meta || {}
		}

		var booking_string = JSON.stringify(booking);

		var add_batch = self._schedule.addBatch(path, id, start, end);
		add_batch.push({
			type:'put',
			key:tools.parsedots(tools.bookingkey(path, id)),
			value:JSON.stringify(booking || {})
		})

		self._db.batch(add_batch, callback);
	})
	
}

Len.prototype.removeBooking = function(path, id, callback){

	var self = this;
	this.loadBooking(path, id, function(err, booking){
		if(err){
			return callback();
		}

		var remove_batch = self._schedule.removeBatch(path, id, booking.start, booking.end);
		remove_batch.push({
			type:'del',
			key:tools.parsedots(tools.bookingkey(path, id))
		})

		self._db.batch(remove_batch, callback);
	})
	
}

Len.prototype.createBookingStream = function(path, window, callback){
	var self = this;

	if(arguments.length<2){
		callback = window;
		window = null;
	}


	console.log('-------------------------------------------');
	console.dir(start);
	console.dir(end);

	var counters = {};

	return this._db.createReadStream({
		start:start,
		end:end,
		keyEncoding:'ascii',
		valueEncoding:'ascii',
		keys:true,
		values:true
	}).pipe(through(function(key, data){

		var parts = data.split(':');
		var id = parts[0];
		var type = parts[1];

		if(inclusive){

		}
		

		console.log('-------------------------------------------');
		console.dir(key);
		console.dir(data);

	}))
}