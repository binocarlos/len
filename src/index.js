var EventEmitter = require('events').EventEmitter
var util = require('util')
var liveStream = require('level-live-stream');
var through = require('through');
var tools = require('./tools');
var datefloor = require('date-floor');
var async = require('async');
var es = require('event-stream');

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
	this._db.get('_b.' + path + '.' + id, function(err, val){
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

		self._db.batch(self._schedule.addBatch(booking), callback);
	}

	if(id){
		this.loadBooking(path, id, function(err, oldbooking){
			if(!err && oldbooking){
				batch = batch.concat(self._schedule.removeBatch({
					path:path,
					id:id,
					start:oldbooking.start,
					end:oldbooking.end
				}))
			}

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

		self._db.batch(self._schedule.removeBatch(booking), callback);
	})
	
}

Len.prototype.toStringStream = function(){
	return through(function(entry){
		entry.key = entry.key.toString();
		entry.value = entry.value.toString();
		this.queue(entry);
	})
}

Len.prototype.createScheduleStream = function(path, window){
	var self = this;

	var schedulestart = '_s.' + tools.pad_timestamp(window.start.getTime()) + '.' + path;;
	var scheduleend = '_s.' + tools.pad_timestamp(window.end.getTime()) + '.' + path;

	return self._db.createReadStream({
		start:schedulestart,
		end:scheduleend,
		keyEncoding:'ascii',
		valueEncoding:'ascii',
		keys:true,
		values:true
	})
	
}

Len.prototype.createDayStreams = function(path, window){
	var self = this;
	var start_day = datefloor(window.start, 'day');
	var end_day = datefloor(window.end, 'day');

	var daystart = '_d.' + tools.pad_timestamp(start_day.getTime()) + '.' + path;
	var dayend = '_d.' + tools.pad_timestamp(end_day.getTime()) + '.' + path;

	// all the bookings under the path for the single start day
	var start_stream = self._db.createReadStream({
		start:daystart,
		end:daystart + '\xff',
		keyEncoding:'ascii',
		valueEncoding:'ascii',
		keys:true,
		values:true
	})

	// all the bookings under the path for the single end day
	var end_stream = self._db.createReadStream({
		start:dayend,
		end:dayend + '\xff',
		keyEncoding:'ascii',
		valueEncoding:'ascii',
		keys:true,
		values:true
	})

	return {
		start:start_stream,
		end:end_stream
	}
}

Len.prototype.createBookingStream = function(path, window){
	var self = this;

	if(path && typeof(path)!=='string'){
		window = path;
		path = null;
	}

	path = path || '';

	window = window || {};

	if(!window.start){
		window.start = new Date('01/01/1980 00:00:00');
	}

	if(!window.end){
		window.end = new Date('01/01/2035 00:00:00');
	}

	var scheduleStream = this.createScheduleStream(path, {
		start:window.start,
		end:window.end
	})

	var dayStreams = this.createDayStreams(path, {
		start:window.start,
		end:window.end
	})

	var bookings_seen = {};
	var bookings_included = {};

	return es
		.merge(scheduleStream, dayStreams.start, dayStreams.end)
		.pipe(this.toStringStream())
		.pipe(es.map(function(data, callback){

			var bookingid = data.value;

			if(bookings_seen[bookingid]){
				return callback();
			}

			bookings_seen[bookingid] = true;

			self._db.get(bookingid, function(err, booking){
				if(err){
					return callback(err);
				}

				booking = JSON.parse(booking.toString());

				callback(null, booking);
			})


			

		}))


}