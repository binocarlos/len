var EventEmitter = require('events').EventEmitter
var util = require('util')
var liveStream = require('level-live-stream');
var through = require('through');
var tools = require('./tools');
var datefloor = require('date-floor');
var async = require('async');

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

Len.prototype.createTimelineStream = function(path, options){

	var keys = tools.querykeys(path, options);

	console.log('-------------------------------------------');
	console.dir(keys);

}

Len.prototype.createBookingStream = function(path, window){
	var self = this;

	if(path && typeof(path)!=='string'){
		window = path;
		path = null;
	}

	var nextbookingstream = null;
	
	var bookingstream = es.readable(function (count, callback) {

		nextbookingstream = callback;
	  
	})

	async.series([

		// get the nodes below the search path
		function(next){

			self._db.createReadStream({
				start:'_t.' + path,
				end:'_t.' + path + '\xff',
				keyEncoding:'ascii',
				valueEncoding:'ascii',
				keys:true,
				values:true
			}).pipe(through(function(entry){

				self._db.createReadStream({
					start:'_t.' + path,
					end:'_t.' + path + '\xff',
					keyEncoding:'ascii',
					valueEncoding:'ascii',
					keys:true,
					values:true
				}).pipe(through(function(entry){


			}, function(){
				callback && callback();
				this.emit('end');
			}))
		}

	])


	var start_key = null;
	var end_key = null;

	var day_index_start = null;
	var day_index_end = null;




/*

	if(!path && !options){
		start_key = '_b.';
		end_key = '_b.\xff';
	}
	else if(options){

		if(!options.end){
			options.end = new Date();
		}

		if(!options.start){
			options.start = new Date('01/01/1980 00:00:00');
		}

		start_key = '_s.' + options.start.getTime() + '.' + (path || '') + '.';
		end_key = '_s.' + options.end.getTime() + '.' + (path || '') + '.';

		day_index_starttime = datefloor(options.start, 'day').getTime();
		day_index_endtime = datefloor(options.end, 'day').getTime() + (1000*60*60*24);
	}
	else if(path){
		start_key = '_b.' + path + '.';
		end_key = '_b.' + path + '.\xff';
	}
*/

	return this._db.createReadStream({
		start:start_key,
		end:end_key,
		keyEncoding:'ascii',
		valueEncoding:'ascii',
		keys:true,
		values:true
	}).pipe(through(function(entry){

		var key = entry.key.toString();
		var value = entry.value.toString();

		// it is a raw booking
		if(key.indexOf('_b.')==0){
			this.queue(JSON.parse(value));
		}

	}, function(){
		callback && callback();
		this.emit('end');
	}))
}