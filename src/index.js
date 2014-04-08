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
	var key = tools.bookingkey(path, id);

	this._db.get(key, function(err, val){
		if(err){
			return callback(err);
		}
		callback(null, val ? JSON.parse(val) : null);
	})
}

Len.prototype.saveBooking = function(path, options, callback){
	var self = this;

	options = options || {};

	var id = options.id;
	var meta = options.meta;
	var start = options.start;
	var end = options.end;

	var batch = [];

	function create_booking(){
		if(!id){
			id = tools.littleid();
		}

		var booking = {
			id:id,
			path:path,
			start:start,
			end:end,
			meta:meta || {}
		}

		var booking_string = JSON.stringify(booking);

		batch = batch.concat(self._schedule.addBatch(path, id, start, end));

		add_batch.push({
			type:'put',
			key:tools.bookingkey(path, id),
			value:JSON.stringify(booking || {})
		})

		var all_batch = [].concat(remove_batch).concat(add_batch);

		self._db.batch(add_batch, callback);
	}

	if(id){
		this.loadBooking(path, id, function(err, oldbooking){
			if(err){
				return callback(err);
			}
			batch = batch.concat(self._schedule.removeBatch(path, id, oldbooking.start, oldbooking.end));
			create_booking();
		})
	}
	else{
		create_booking();
	}	
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
			key:tools.bookingkey(path, id)
		})

		self._db.batch(remove_batch, callback);
	})
	
}

Len.prototype.createTimelineStream = function(path, options){

	var keys = tools.querykeys(path, options);

	return this._db.createReadStream({
		start:keys.start,
		end:keys.end,
		keyEncoding:'ascii',
		valueEncoding:'ascii',
		keys:true,
		values:true
	})
}

Len.prototype.createBookingStream = function(path, options, callback){
	var self = this;

	options = options || {};

	var keys = tools.querykeys(path, options);

	var hits = {};

	var timeline_stream = this.createTimelineStream(path, options);

	return timeline_stream.pipe(through(function(entry){

		var key = entry.key.toString();
		var value = entry.value.toString();

		var keyparts = key.split('.');
		var id = keyparts.pop();
		var timestamp = keyparts.pop();
		var valueparts = value.split(':');
		var path = valueparts[0];
		var type = valueparts[1];

		console.log('-------------------------------------------');
		console.dir('id: ' + id);
		console.dir('timestamp: ' + timestamp);
		console.dir('path: ' + path);
		console.dir('type: ' + type);

		if(options.inclusive){

		}

		this.queue({
			id:id,
			timestamp:timestamp,
			type:type
		})
	}, function(){
		callback && callback();
		this.emit('end');
	}))
}